// Kun Tartibim — Server push (VAPID) + schedule mirror + Telegram inbox.
// Lets the server send reminders while the app/PWA is closed.
(function () {
  const API = "/api/public/gate/";
  let cfg = null; // {publicKey, pushReady, telegramReady}
  let disabled = false; // viewer / no token
  let syncTimer = null;
  let lastSig = "";

  function tok() { return localStorage.getItem("bh_device_token") || ""; }
  async function call(action, init) {
    const headers = Object.assign({ "content-type": "application/json", "x-device-token": tok() }, (init && init.headers) || {});
    const res = await fetch(API + action, Object.assign({}, init, { headers }));
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }

  async function loadConfig() {
    if (cfg || disabled) return cfg;
    if (!tok()) { disabled = true; return null; }
    const r = await call("push-config");
    if (!r.ok) { disabled = true; return null; }
    cfg = r.data;
    return cfg;
  }

  function b64ToU8(b64) {
    const pad = "=".repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  }

  async function enable() {
    const c = await loadConfig();
    if (!c || !c.pushReady || !c.publicKey) { toast("Server push sozlanmagan"); return false; }
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) { toast("Bu brauzer push’ni qo‘llamaydi"); return false; }
    const perm = await Notification.requestPermission();
    if (perm !== "granted") { toast("Bildirishnoma ruxsati berilmadi"); return false; }
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(c.publicKey) });
    const r = await call("push-subscribe", { method: "POST", body: JSON.stringify({ subscription: sub.toJSON() }) });
    if (!r.ok) { toast("Obuna saqlanmadi"); return false; }
    window.S && (window.S.pushOn = true, window.persist && persist());
    lastSig = "";
    syncSchedule(true);
    toast("✅ Server eslatmalari yoqildi");
    return true;
  }

  async function disable() {
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = reg && (await reg.pushManager.getSubscription());
      if (sub) await sub.unsubscribe();
    } catch (e) {}
    window.S && (window.S.pushOn = false, window.persist && persist());
    lastSig = "";
    syncSchedule(true);
    toast("Server eslatmalari o‘chirildi");
  }

  async function test() {
    const r = await call("push-test", { method: "POST", body: "{}" });
    toast(r.ok && r.data.ok ? "📨 Test yuborildi" : "Yuborilmadi — avval yoqing");
  }

  // Mirror today's task list to the server (debounced, only when changed).
  function syncSchedule(force) {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(async () => {
      if (disabled || !tok() || !window.S) return;
      const S = window.S;
      const day = typeof todayKey === "function" ? todayKey() : new Date().toISOString().slice(0, 10);
      const tasks = (S.tasks || []).map((t) => ({ id: String(t.id), name: t.name, start: t.start, end: t.end, cat: t.cat, done: !!t.done }));
      const body = { day, tzOffset: -new Date().getTimezoneOffset(), tasks, telegramOn: !!S.telegramOn, pushOn: !!S.pushOn };
      const sig = JSON.stringify(body);
      if (!force && sig === lastSig) return;
      const r = await call("schedule-sync", { method: "POST", body: sig });
      if (r.ok) lastSig = sig; else if (r.status === 403) disabled = true;
    }, force ? 50 : 1500);
  }

  // Actions that arrived from Telegram while the app was closed.
  async function pollInbox() {
    if (disabled || !tok() || document.hidden) return;
    const r = await call("inbox");
    if (!r.ok) return;
    (r.data.items || []).forEach((it) => {
      if (it.action === "done" && typeof markTaskDone === "function") {
        const S = window.S;
        const t = (S.tasks || []).find((x) => String(x.id) === String(it.task_id));
        if (t && !t.done) { markTaskDone(t.id); }
      }
    });
  }

  // Hook persist() so schedule changes are mirrored automatically.
  function hookPersist() {
    if (!window.persist || window.persist.__ktPush) return;
    const orig = window.persist;
    const wrapped = function () { const r = orig.apply(this, arguments); try { syncSchedule(false); } catch (e) {} return r; };
    wrapped.__ktPush = true;
    window.persist = wrapped;
  }

  function toast(m) { try { window.toast ? window.toast(m) : console.log(m); } catch (e) {} }

  window.KTPush = { enable, disable, test, syncSchedule, loadConfig, isDisabled: () => disabled, config: () => cfg };

  window.addEventListener("load", () => {
    hookPersist();
    setTimeout(() => { loadConfig().then(() => { syncSchedule(false); pollInbox(); }); }, 1500);
    setInterval(pollInbox, 60000);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) { pollInbox(); syncSchedule(false); } });
  });
})();
