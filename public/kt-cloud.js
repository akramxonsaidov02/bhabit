// Kun Tartibim — Cloud sync module
// Anonymous auth + real-time sync of tasks, settings, devices across devices.
// Exposes window.KTCloud with methods used by kun-tartibim.html.
(function () {
  // SECURITY: no sync credentials are embedded in client code. They are fetched from
  // /api/public/gate/sync-config, which verifies the device token server-side and
  // refuses to hand out credentials to read-only ("viewer") devices. A viewer therefore
  // has no way to write, even if the client-side flag is tampered with in devtools.
  let SYNC_CONFIG = null;

  async function loadSyncConfig() {
    if (SYNC_CONFIG) return SYNC_CONFIG;
    const token = localStorage.getItem("bh_device_token");
    const res = await fetch("/api/public/gate/sync-config", {
      headers: token ? { "x-device-token": token } : {},
    });
    if (!res.ok) throw new Error("Sinxronizatsiya ruxsati yo'q");
    const data = await res.json();
    if (data.readOnly || !data.url || !data.key) {
      window.__BH_VIEWER__ = true;
      throw new Error("readonly");
    }
    SYNC_CONFIG = { url: data.url, key: data.key };
    return SYNC_CONFIG;
  }


  const state = {
    sb: null,
    user: null,
    deviceId: null,
    ready: false,
    remoteApplying: false, // guards against feedback loops
    channels: [],
    listeners: {
      ready: [],
      remoteChange: [],
    },
  };

  const DEVICE_KEY = "kt5_device_id";
  const LOCAL_KEY = "kt5";

  function todayISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function parseUA(ua) {
    ua = ua || navigator.userAgent || "";
    let os = "Noma'lum",
      browser = "Brauzer";
    if (/Windows NT 10/.test(ua)) os = "Windows 10/11";
    else if (/Windows NT/.test(ua)) os = "Windows";
    else if (/Mac OS X ([\d_]+)/.test(ua)) os = "macOS";
    else if (/Android/.test(ua)) os = "Android";
    else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
    else if (/Linux/.test(ua)) os = "Linux";
    if (/Edg\//.test(ua)) browser = "Edge";
    else if (/OPR\//.test(ua) || /Opera/.test(ua)) browser = "Opera";
    else if (/Chrome\//.test(ua)) browser = "Chrome";
    else if (/Firefox\//.test(ua)) browser = "Firefox";
    else if (/Safari\//.test(ua)) browser = "Safari";
    return `${os} — ${browser}`;
  }

  function fire(event, payload) {
    (state.listeners[event] || []).forEach((cb) => {
      try {
        cb(payload);
      } catch (e) {
        console.error(e);
      }
    });
  }

  async function ensureSupabase() {
    if (state.sb) return state.sb;
    if (!window.supabase || !window.supabase.createClient) {
      throw new Error("Supabase SDK yuklanmadi");
    }
    const cfg = await loadSyncConfig();
    state.sb = window.supabase.createClient(cfg.url, cfg.key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: "kt5_auth",
      },
    });
    return state.sb;
  }

  async function ensureSession() {
    const sb = await ensureSupabase();
    const { data } = await sb.auth.getSession();
    if (data.session) {
      state.user = data.session.user;
      return state.user;
    }
    const { data: signIn, error } = await sb.auth.signInAnonymously();
    if (error) throw error;
    state.user = signIn.user;
    return state.user;
  }

  async function ensureDevice() {
    const sb = state.sb;
    let deviceId = localStorage.getItem(DEVICE_KEY);
    const deviceName = parseUA();
    const ua = navigator.userAgent || "";

    if (deviceId) {
      // update last_seen; if row is missing (deleted), recreate
      const { data: exists } = await sb
        .from("devices")
        .select("id")
        .eq("id", deviceId)
        .maybeSingle();
      if (exists) {
        await sb
          .from("devices")
          .update({ last_seen: new Date().toISOString(), device_name: deviceName, user_agent: ua })
          .eq("id", deviceId);
        state.deviceId = deviceId;
        return deviceId;
      }
    }
    // count existing devices to decide master flag
    const { data: existing } = await sb.from("devices").select("id").eq("user_id", state.user.id);
    const isFirst = !existing || existing.length === 0;
    const { data: ins, error } = await sb
      .from("devices")
      .insert({
        user_id: state.user.id,
        device_name: deviceName,
        user_agent: ua,
        is_master: isFirst,
      })
      .select("id")
      .single();
    if (error) throw error;
    localStorage.setItem(DEVICE_KEY, ins.id);
    state.deviceId = ins.id;
    if (isFirst) {
      await sb.from("profiles").update({ master_device_id: ins.id }).eq("id", state.user.id);
    }
    return ins.id;
  }

  // ---- Data mapping between local S and cloud tables ----
  function localTaskToRow(t, userId) {
    return {
      id: t.cloudId || undefined,
      user_id: userId,
      name: String(t.name || ""),
      category: String(t.cat || t.category || "other"),
      start_time: String(t.start || "00:00"),
      end_time: String(t.end || "00:00"),
      priority: String(t.priority || "orta"),
      auto_complete: !!t.autoComplete,
      note: t.note || null,
      sort_order: Number(t.order || 0),
    };
  }

  function rowToLocalTask(row) {
    return {
      cloudId: row.id,
      id: row.id,
      name: row.name,
      cat: row.category,
      start: row.start_time,
      end: row.end_time,
      priority: row.priority,
      autoComplete: !!row.auto_complete,
      note: row.note || "",
      order: row.sort_order || 0,
    };
  }

  function readLocalS() {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeLocalS(S) {
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(S));
    } catch {}
  }

  async function pullAll() {
    const sb = state.sb;
    const userId = state.user.id;
    const [tasksRes, settingsRes, complRes] = await Promise.all([
      sb.from("tasks").select("*").eq("user_id", userId).order("sort_order"),
      sb.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
      sb.from("task_completions")
        .select("task_id, done")
        .eq("user_id", userId)
        .eq("completion_date", (typeof window!=="undefined" && window.__KT_ACTIVE_DATE__) || todayISO()),
    ]);
    const tasks = (tasksRes.data || []).map(rowToLocalTask);
    const doneMap = {};
    (complRes.data || []).forEach((c) => {
      doneMap[c.task_id] = c.done;
    });
    tasks.forEach((t) => {
      t.done = !!doneMap[t.cloudId];
    });
    return {
      tasks,
      settings: settingsRes.data || null,
    };
  }

  // Fetch a specific day's snapshot from the cloud (tasks + completions of that date)
  async function fetchDay(date) {
    if (!state.ready) return null;
    const sb = state.sb;
    const userId = state.user.id;
    const [tasksRes, complRes] = await Promise.all([
      sb.from("tasks").select("*").eq("user_id", userId).order("sort_order"),
      sb
        .from("task_completions")
        .select("task_id, done")
        .eq("user_id", userId)
        .eq("completion_date", date),
    ]);
    const doneMap = {};
    (complRes.data || []).forEach((c) => {
      doneMap[c.task_id] = !!c.done;
    });
    const tasks = (tasksRes.data || []).map((row) => {
      const t = rowToLocalTask(row);
      t.done = !!doneMap[row.id];
      return t;
    });
    const total = tasks.length;
    const done = tasks.filter((t) => t.done).length;
    return {
      date,
      tasks,
      done,
      total,
      pct: total ? Math.round((done / total) * 100) : 0,
    };
  }

  async function seedFromLocalIfEmpty(localS) {

    if (!localS) return false;
    const sb = state.sb;
    const userId = state.user.id;
    const { data: existing } = await sb
      .from("tasks")
      .select("id")
      .eq("user_id", userId)
      .limit(1);
    if (existing && existing.length > 0) return false;
    // First-time cloud sync: push localStorage into cloud
    if (Array.isArray(localS.tasks) && localS.tasks.length) {
      const rows = localS.tasks.map((t, i) => ({
        user_id: userId,
        name: String(t.name || ""),
        category: String(t.cat || "other"),
        start_time: String(t.start || "06:00"),
        end_time: String(t.end || "07:00"),
        priority: String(t.priority || "orta"),
        auto_complete: !!t.autoComplete,
        note: t.note || null,
        sort_order: i,
      }));
      const { data: inserted } = await sb.from("tasks").insert(rows).select("id");
      if (inserted) {
        // write cloud ids back so UI can reference
        inserted.forEach((row, i) => {
          if (localS.tasks[i]) {
            localS.tasks[i].cloudId = row.id;
            localS.tasks[i].id = row.id;
          }
        });
      }
    }
    // seed settings
    const settingsPayload = {
      user_id: userId,
      day_start: localS.dayStart || "06:30",
      sleep_time: localS.sleep || "22:30",
      prayers: localS.prayers || {},
      notif_on: localS.notifOn !== false,
      auto_shift_on_day_change: localS.autoShiftOnDayChange !== false,
      auto_shift_on_prayer_change: localS.autoShiftOnPrayerChange !== false,
      ai_replan_on: localS.aiReplanOn !== false,
      extras: {
        theme: localS.theme,
        appName: localS.appName,
        accent: localS.accent,
        location: localS.location,
      },
    };
    await sb.from("user_settings").upsert(settingsPayload, { onConflict: "user_id" });
    return true;
  }

  // Viewer mode: block all writes; changes stay only in memory/UI.
  function isViewer() {
    return !!(typeof window !== "undefined" && window.__BH_VIEWER__);
  }

  // Track recent local writes so realtime pullAll doesn't clobber optimistic UI.
  const pendingWrites = new Map(); // key -> expiresAt (ms)
  function markPending(key, ms) {
    pendingWrites.set(key, Date.now() + (ms || 3000));
  }
  function hasPending(key) {
    const exp = pendingWrites.get(key);
    if (!exp) return false;
    if (Date.now() > exp) { pendingWrites.delete(key); return false; }
    return true;
  }

  // ---- Public API used by kun-tartibim.html ----
  async function pushTaskChange(task) {
    if (!state.ready || state.remoteApplying || isViewer()) return;
    const sb = state.sb;
    const row = localTaskToRow(task, state.user.id);
    markPending("tasks", 2500);
    if (task.cloudId) {
      await sb.from("tasks").update(row).eq("id", task.cloudId);
      return;
    }
    // No cloudId yet: adopt an existing identical row instead of inserting a
    // duplicate. Without this, every sync of a local-only task created a copy.
    const { data: same } = await sb
      .from("tasks")
      .select("id")
      .eq("user_id", state.user.id)
      .eq("name", row.name)
      .eq("start_time", row.start_time)
      .limit(1);
    if (same && same.length) {
      task.cloudId = same[0].id;
      task.id = same[0].id;
      await sb.from("tasks").update(row).eq("id", same[0].id);
      return;
    }
    const { data } = await sb.from("tasks").insert(row).select("id").single();
    if (data) {
      task.cloudId = data.id;
      task.id = data.id;
    }
  }

  // Bulutdagi barcha vazifalarni o'chirish (to'liq tozalash uchun).
  async function wipeTasks() {
    if (!state.ready || isViewer()) return 0;
    markPending("tasks", 6000);
    const { data } = await state.sb
      .from("tasks")
      .select("id")
      .eq("user_id", state.user.id);
    const ids = (data || []).map((r) => r.id);
    if (ids.length) {
      for (let i = 0; i < ids.length; i += 50) {
        await state.sb.from("tasks").delete().in("id", ids.slice(i, i + 50));
      }
      await state.sb.from("task_completions").delete().eq("user_id", state.user.id);
    }
    return ids.length;
  }


  async function deleteTaskCloud(task) {
    if (!state.ready || !task || !task.cloudId || isViewer()) return;
    markPending("tasks", 2500);
    await state.sb.from("tasks").delete().eq("id", task.cloudId);
  }

  async function saveTaskCompletion(task, done, date) {
    if (!state.ready || !task || !task.cloudId || isViewer()) return;
    markPending("completions:" + task.cloudId, 4000);
    markPending("completions", 2500);
    await state.sb.from("task_completions").upsert(
      {
        user_id: state.user.id,
        task_id: task.cloudId,
        completion_date: date || (typeof window!=='undefined' && window.__KT_ACTIVE_DATE__) || todayISO(),
        done: !!done,
        completed_at: done ? new Date().toISOString() : null,
      },
      { onConflict: "task_id,completion_date" },
    );
  }

  async function pushSettings(S) {
    if (!state.ready || state.remoteApplying || isViewer()) return;
    markPending("settings", 2500);
    await state.sb.from("user_settings").upsert(
      {
        user_id: state.user.id,
        day_start: S.dayStart || "06:30",
        sleep_time: S.sleep || "22:30",
        prayers: S.prayers || {},
        notif_on: S.notifOn !== false,
        auto_shift_on_day_change: S.autoShiftOnDayChange !== false,
        auto_shift_on_prayer_change: S.autoShiftOnPrayerChange !== false,
        ai_replan_on: S.aiReplanOn !== false,
        extras: {
          theme: S.theme,
          appName: S.appName,
          accent: S.accent,
          location: S.location,
        },
      },
      { onConflict: "user_id" },
    );
  }

  function applyCloudToLocal(S, cloud) {
    state.remoteApplying = true;
    try {
      if (cloud.tasks && !hasPending("tasks")) {
        // Merge tasks by cloudId so any in-flight local edits (drag/edit) survive.
        const cloudById = new Map(cloud.tasks.map((t) => [t.cloudId, t]));
        const prev = Array.isArray(S.tasks) ? S.tasks : [];
        const prevById = new Map(prev.filter((t) => t && t.cloudId).map((t) => [t.cloudId, t]));
        S.tasks = cloud.tasks.map((t) => {
          const local = prevById.get(t.cloudId);
          // If a completion write is in flight for this task, keep local `done`.
          if (local && hasPending("completions:" + t.cloudId)) {
            return Object.assign({}, t, { done: local.done });
          }
          return t;
        });
        // Keep local-only tasks (no cloudId) — but skip ones the cloud already has
        // (same name+start), otherwise every sync duplicates the whole list.
        const sig = (t) => String(t.name || "").trim().toLowerCase() + "|" + (t.start || "") + "|" + (t.end || "");
        const cloudSigs = new Set(S.tasks.map(sig));
        prev.forEach((t) => {
          if (!t || t.cloudId) return;
          if (cloudSigs.has(sig(t))) return;
          cloudSigs.add(sig(t));
          S.tasks.push(t);
        });
        void cloudById;
      } else if (cloud.tasks && hasPending("completions")) {
        // Only refresh `done` from cloud where no per-task pending exists.
        const doneByCloudId = new Map(cloud.tasks.map((t) => [t.cloudId, !!t.done]));
        (S.tasks || []).forEach((t) => {
          if (t && t.cloudId && !hasPending("completions:" + t.cloudId) && doneByCloudId.has(t.cloudId)) {
            t.done = doneByCloudId.get(t.cloudId);
          }
        });
      }
      const st = cloud.settings;
      if (st && !hasPending("settings")) {
        S.dayStart = st.day_start;
        S.sleep = st.sleep_time;
        S.prayers = st.prayers || S.prayers || {};
        S.notifOn = !!st.notif_on;
        S.autoShiftOnDayChange = !!st.auto_shift_on_day_change;
        S.autoShiftOnPrayerChange = !!st.auto_shift_on_prayer_change;
        S.aiReplanOn = !!st.ai_replan_on;
        if (st.extras) {
          if (st.extras.theme) S.theme = st.extras.theme;
          if (st.extras.appName) S.appName = st.extras.appName;
          if (st.extras.accent) S.accent = st.extras.accent;
          if (st.extras.location) S.location = st.extras.location;
        }
      }
      writeLocalS(S);
    } finally {
      state.remoteApplying = false;
    }
  }


  function subscribeRealtime(onChange) {
    const sb = state.sb;
    const userId = state.user.id;
    const filter = `user_id=eq.${userId}`;
    const ch = sb
      .channel("kt-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks", filter }, () => onChange("tasks"))
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_settings", filter },
        () => onChange("settings"),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_completions", filter },
        () => onChange("completions"),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "devices", filter },
        () => onChange("devices"),
      )
      .subscribe();
    state.channels.push(ch);
  }

  // ---- Cloud tozalash: dublikat va eski reja qatorlarini o'chirish ----
  async function listTaskRows() {
    if (!state.ready) return [];
    const { data } = await state.sb
      .from("tasks")
      .select("id, name, start_time, end_time")
      .eq("user_id", state.user.id)
      .order("sort_order");
    return data || [];
  }

  async function deleteTaskIds(ids) {
    if (!state.ready || isViewer() || !ids || !ids.length) return;
    markPending("tasks", 4000);
    await state.sb.from("tasks").delete().in("id", ids);
  }

  async function listDevices() {
    if (!state.ready) return [];
    const { data } = await state.sb
      .from("devices")
      .select("*")
      .eq("user_id", state.user.id)
      .order("last_seen", { ascending: false });
    return data || [];
  }

  async function removeDevice(deviceId) {
    if (!state.ready) return;
    await state.sb.from("devices").delete().eq("id", deviceId);
  }

  async function init(S) {
    try {
      await ensureSupabase();
    } catch (e) {
      // Viewer / unauthorised device: no credentials granted, cloud stays disabled.
      state.ready = false;
      fire("ready", { user: null, deviceId: null, readOnly: true });
      return { user: null, deviceId: null, readOnly: true };
    }
    await ensureSession();
    await ensureDevice();


    // First push local state to cloud if cloud has nothing yet
    await seedFromLocalIfEmpty(S);

    // Pull cloud → apply to S
    const cloud = await pullAll();
    if (cloud.tasks.length || cloud.settings) {
      applyCloudToLocal(S, cloud);
    }

    state.ready = true;

    // Wire up real-time (debounced so a burst of writes doesn't thrash the UI).
    let rtTimer = null;
    let lastKind = null;
    subscribeRealtime((kind) => {
      lastKind = kind;
      if (rtTimer) return;
      rtTimer = setTimeout(async () => {
        rtTimer = null;
        try {
          const fresh = await pullAll();
          applyCloudToLocal(S, fresh);
          fire("remoteChange", { kind: lastKind, S, cloud: fresh });
        } catch (e) {
          console.error("realtime pull failed", e);
        }
      }, 900);
    });

    // Tab qayta faollashganda ham bir marta tortib olamiz (uzilishdan keyin).
    document.addEventListener("visibilitychange", async () => {
      if (document.visibilityState !== "visible" || !state.ready) return;
      try {
        const fresh = await pullAll();
        applyCloudToLocal(S, fresh);
        fire("remoteChange", { kind: "visibility", S, cloud: fresh });
      } catch (e) {}
    });



    fire("ready", { user: state.user, deviceId: state.deviceId });
    return { user: state.user, deviceId: state.deviceId };
  }

  async function syncTasks(tasks) {
    if (!state.ready || isViewer() || !Array.isArray(tasks)) return;
    for (const t of tasks) {
      try { await pushTaskChange(t); } catch (e) { console.error(e); }
    }
  }

  window.KTCloud = {
    init,
    on(event, cb) {
      (state.listeners[event] = state.listeners[event] || []).push(cb);
    },
    pushTaskChange,
    deleteTaskCloud,
    saveTaskCompletion,
    pushSettings,
    syncTasks,
    fetchDay,

    listDevices,
    removeDevice,
    listTaskRows,
    deleteTaskIds,
    isViewer,
    getUser: () => state.user,
    getDeviceId: () => state.deviceId,
    isReady: () => state.ready,
  };
})();
