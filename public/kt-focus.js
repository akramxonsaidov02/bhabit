/* Kun Tartibim — Focus Mode, escalation, soft-lock, defer-reason analytics.
   Depends on globals from kun-tartibim.html: S, persist, taskById, visibleTasks,
   activeDate, todayKey, isToday, t2m, CATS, MANDATORY_CATS, toast, renderSchedule. */
(function () {
  const REASONS = [
    'Charchadim',
    'Telefon / ijtimoiy tarmoq',
    'Boshqa ish chiqib qoldi',
    'Zerikarli / qiyin',
    'Kayfiyat yo‘q',
    'Boshqa sabab',
  ];

  const $ = (id) => document.getElementById(id);
  const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
  const pad = (n) => String(n).padStart(2, '0');
  const fmt = (m) => (m >= 60 ? Math.floor(m / 60) + ' soat ' + (m % 60) + ' daq' : m + ' daq');
  const ready = () => typeof S !== 'undefined' && Array.isArray(S.tasks);

  function css() {
    if ($('ktFocusCss')) return;
    const st = document.createElement('style');
    st.id = 'ktFocusCss';
    st.textContent = `
#focusCard{margin-bottom:12px;padding:14px;border-radius:var(--r,16px);border:1px solid var(--bdr2,rgba(255,255,255,.1));background:var(--gl,rgba(255,255,255,.05));backdrop-filter:blur(16px);position:relative;overflow:hidden}
#focusCard.late{border-color:rgba(239,68,68,.7);box-shadow:0 0 0 2px rgba(239,68,68,.14)}
#focusCard .fc-lbl{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--tx3,#8b93a7);margin-bottom:6px;display:flex;justify-content:space-between;align-items:center}
#focusCard .fc-name{font-size:17px;font-weight:700;color:var(--tx,#e8ecf5);line-height:1.25}
#focusCard .fc-meta{font-size:12px;color:var(--tx2,#a9b1c4);margin-top:4px}
#focusCard .fc-bar{height:5px;border-radius:99px;background:rgba(148,163,184,.22);margin-top:10px;overflow:hidden}
#focusCard .fc-bar i{display:block;height:100%;background:var(--A,#6366f1);width:0;transition:width .6s linear}
#focusCard .fc-acts{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
#focusCard .fc-acts button{flex:1;min-width:88px;padding:9px 8px;border-radius:12px;border:1px solid var(--bdr2,rgba(255,255,255,.12));background:rgba(148,163,184,.1);color:var(--tx,#e8ecf5);font:600 12px/1 inherit;cursor:pointer}
#focusCard .fc-acts button.pri{background:rgba(34,197,94,.16);border-color:rgba(34,197,94,.4);color:#22c55e}
#focusCard .fc-acts button.def{background:rgba(245,158,11,.14);border-color:rgba(245,158,11,.35);color:#f59e0b}
#ktLateBar{position:fixed;left:0;right:0;bottom:64px;z-index:60;margin:0 12px;padding:10px 12px;border-radius:14px;background:rgba(239,68,68,.94);color:#fff;font:600 12.5px/1.35 inherit;display:none;align-items:center;gap:10px;box-shadow:0 8px 26px rgba(239,68,68,.35)}
#ktLateBar.show{display:flex;animation:ktLatePulse 1.6s ease-in-out infinite}
#ktLateBar button{margin-left:auto;background:rgba(255,255,255,.2);border:0;color:#fff;padding:7px 11px;border-radius:10px;font:700 12px/1 inherit;cursor:pointer}
@keyframes ktLatePulse{0%,100%{box-shadow:0 8px 26px rgba(239,68,68,.3)}50%{box-shadow:0 8px 34px rgba(239,68,68,.65)}}
#ktReasonOv{position:fixed;inset:0;z-index:120;background:rgba(2,6,23,.72);backdrop-filter:blur(6px);display:none;align-items:flex-end;justify-content:center}
#ktReasonOv.open{display:flex}
#ktReasonOv .rs{width:100%;max-width:520px;background:var(--bg2,#131826);border-radius:20px 20px 0 0;padding:18px 16px 26px;border:1px solid var(--bdr2,rgba(255,255,255,.1))}
#ktReasonOv h4{margin:0 0 4px;font-size:15px;color:var(--tx,#e8ecf5)}
#ktReasonOv p{margin:0 0 12px;font-size:12px;color:var(--tx2,#a9b1c4)}
#ktReasonOv .rb{display:block;width:100%;text-align:left;margin-bottom:8px;padding:11px 12px;border-radius:12px;border:1px solid var(--bdr2,rgba(255,255,255,.1));background:rgba(148,163,184,.08);color:var(--tx,#e8ecf5);font:600 13px/1 inherit;cursor:pointer}
#ktReasonOv .rb:hover{background:rgba(148,163,184,.18)}
.tc.locked{position:relative}
.tc.locked .tc-body-name::after{content:' 🔒'}
`;
    document.head.appendChild(st);
  }

  function mount() {
    css();
    if (!$('focusCard')) {
      const host = $('pgHome');
      const list = $('schedList');
      if (host && list) {
        const d = document.createElement('div');
        d.id = 'focusCard';
        d.className = 'gl';
        host.insertBefore(d, $('filterBar') || list);
      }
    }
    if (!$('ktLateBar')) {
      const b = document.createElement('div');
      b.id = 'ktLateBar';
      b.innerHTML = '<span id="ktLateTxt"></span><button onclick="KTFocus.jump()">Ochish</button>';
      document.body.appendChild(b);
    }
    if (!$('ktReasonOv')) {
      const o = document.createElement('div');
      o.id = 'ktReasonOv';
      o.innerHTML =
        '<div class="rs"><h4 id="ktReasonTitle">Nega kechiktirdingiz?</h4><p>Sabab yozilsa, statistikada zaif nuqtalaringiz ko‘rinadi.</p><div id="ktReasonList"></div>' +
        '<button class="rb" style="text-align:center;opacity:.7" onclick="KTFocus.closeReason()">Bekor qilish</button></div>';
      o.addEventListener('click', (e) => { if (e.target === o) closeReason(); });
      document.body.appendChild(o);
    }
  }

  // ── Task helpers ────────────────────────────────────────────
  function todays() {
    try { return (typeof visibleTasks === 'function' ? visibleTasks() : S.tasks) || []; }
    catch (e) { return S.tasks || []; }
  }
  function mandatoryCats() {
    return (typeof MANDATORY_CATS !== 'undefined' && MANDATORY_CATS) || ['prayer', 'english', 'rtm', 'ibrat'];
  }
  function mins(t) { try { return t2m(t || '00:00'); } catch (e) { return 0; } }

  function currentTask() {
    const n = nowMin();
    const list = todays().filter((t) => !t.done && !t.deferred);
    const active = list
      .filter((t) => mins(t.start) <= n && mins(t.end || t.start) + 10 >= n)
      .sort((a, b) => mins(a.start) - mins(b.start));
    if (active.length) return active[active.length - 1];
    const overdue = list.filter((t) => mins(t.end || t.start) < n).sort((a, b) => mins(b.start) - mins(a.start));
    if (overdue.length) return overdue[0];
    const next = list.filter((t) => mins(t.start) > n).sort((a, b) => mins(a.start) - mins(b.start));
    return next[0] || null;
  }

  // ── Soft-lock ───────────────────────────────────────────────
  function pendingMandatory() {
    const n = nowMin();
    const mc = mandatoryCats();
    return todays().filter((t) => !t.done && !t.deferred && mc.indexOf(t.cat) >= 0 && mins(t.start) <= n);
  }
  function applyLocks() {
    if (!ready()) return;
    const on = S.softLock !== false && (typeof isToday !== 'function' || isToday());
    const blocked = on ? pendingMandatory() : [];
    document.querySelectorAll('#schedList .tc').forEach((card) => {
      const id = card.id.replace(/^tc-/, '');
      const t = (typeof taskById === 'function' && taskById(id)) || null;
      const lock = !!(t && t.free && blocked.length && !t.done);
      card.classList.toggle('locked', lock);
      let hint = card.querySelector('.kt-lock-note');
      if (lock && !hint) {
        hint = document.createElement('div');
        hint.className = 'tc-body-note kt-lock-note';
        hint.textContent = '🔒 Avval majburiy vazifalar: ' + blocked.slice(0, 2).map((x) => x.name).join(', ');
        (card.querySelector('.tc-body') || card).appendChild(hint);
      } else if (!lock && hint) hint.remove();
    });
    // Kech qolgan vazifalar
    const n = nowMin();
    document.querySelectorAll('#schedList .tc').forEach((card) => {
      const id = card.id.replace(/^tc-/, '');
      const t = (typeof taskById === 'function' && taskById(id)) || null;
      const late = !!(t && !t.done && !t.deferred && mins(t.end || t.start) < n && (typeof isToday !== 'function' || isToday()));
      card.classList.toggle('late', late);
    });
  }

  // ── Focus card ──────────────────────────────────────────────
  let cardTaskId = null;
  function renderCard() {
    if (!ready()) return;
    const el = $('focusCard');
    if (!el) return;
    if (typeof isToday === 'function' && !isToday()) {
      el.style.display = 'none';
      return;
    }
    el.style.display = '';
    const t = currentTask();
    if (!t) {
      cardTaskId = null;
      el.classList.remove('late');
      el.innerHTML = '<div class="fc-lbl">Fokus</div><div class="fc-name">🎉 Hozircha kutilayotgan vazifa yo‘q</div><div class="fc-meta">Barchasi bajarildi yoki kun tugadi.</div>';
      return;
    }
    cardTaskId = t.id;
    const n = nowMin(), st = mins(t.start), en = mins(t.end || t.start);
    let lbl = 'Hozirgi vazifa', meta = '', pct = 0, late = false;
    if (n < st) { lbl = 'Keyingi vazifa'; meta = fmt(st - n) + ' qoldi'; }
    else if (n <= en) { meta = 'Tugashiga ' + fmt(Math.max(0, en - n)); pct = en > st ? Math.round(((n - st) / (en - st)) * 100) : 100; }
    else { lbl = 'Kechikdi'; late = true; meta = fmt(n - en) + ' kechikdi'; pct = 100; }
    el.classList.toggle('late', late);
    const c = (typeof CATS !== 'undefined' && CATS[t.cat]) || { icon: '•', l: '' };
    el.innerHTML =
      `<div class="fc-lbl"><span>${late ? '🔴 ' : '🎯 '}${lbl}</span><span>${t.start}${t.end ? '–' + t.end : ''}</span></div>` +
      `<div class="fc-name">${esc2(t.name)}</div>` +
      `<div class="fc-meta">${c.icon} ${c.l} · ${meta}${t.note ? ' · ' + esc2(t.note) : ''}</div>` +
      `<div class="fc-bar"><i style="width:${Math.min(100, pct)}%"></i></div>` +
      `<div class="fc-acts">
         <button class="pri" onclick="KTFocus.done()">✅ Bajardim</button>
         <button onclick="KTFocus.start()">⏱ Fokus rejim</button>
         <button class="def" onclick="KTFocus.defer()">⏳ Kechiktirdim</button>
       </div>`;
  }
  function esc2(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  // ── Defer reason ────────────────────────────────────────────
  let reasonTaskId = null;
  function askReason(id) {
    reasonTaskId = id;
    const t = typeof taskById === 'function' ? taskById(id) : null;
    if (!t) return;
    $('ktReasonTitle').textContent = '«' + t.name + '» — nega kechiktirdingiz?';
    $('ktReasonList').innerHTML = REASONS.map((r) => `<button class="rb" onclick="KTFocus.pickReason('${r.replace(/'/g, "\\'")}')">${r}</button>`).join('');
    $('ktReasonOv').classList.add('open');
  }
  function closeReason() { $('ktReasonOv').classList.remove('open'); reasonTaskId = null; }
  function pickReason(r) {
    const id = reasonTaskId;
    closeReason();
    const t = typeof taskById === 'function' ? taskById(id) : null;
    if (!t) return;
    t.deferred = true; t.done = false;
    if (!S.deferLog) S.deferLog = [];
    S.deferLog.unshift({
      ts: Date.now(),
      date: typeof activeDate === 'function' ? activeDate() : '',
      taskId: String(t.cloudId || t.id),
      name: t.name,
      cat: t.cat || 'other',
      hour: new Date().getHours(),
      reason: r,
    });
    S.deferLog = S.deferLog.slice(0, 500);
    try { persist(); } catch (e) {}
    try { renderSchedule(); } catch (e) {}
    refresh();
    try { toast('⏳ Sabab yozildi: ' + r); } catch (e) {}
  }

  // ── Escalation notifications ────────────────────────────────
  const fired = {}; // key -> true
  function notify(title, body) {
    try {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        if (navigator.serviceWorker && navigator.serviceWorker.ready) {
          navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, { body, icon: '/favicon.ico', tag: title })).catch(() => {});
          return;
        }
        new Notification(title, { body });
        return;
      }
    } catch (e) {}
    try { toast(title); } catch (e) {}
  }
  function escalate() {
    if (!ready() || S.notifOn === false) return;
    if (typeof isToday === 'function' && !isToday()) return;
    const n = nowMin(), day = typeof todayKey === 'function' ? todayKey() : '';
    let lateTask = null;
    todays().forEach((t) => {
      if (t.done || t.deferred) return;
      if (S.notifOff && S.notifOff[t.id]) return;
      const st = mins(t.start), en = mins(t.end || t.start);
      const k = day + ':' + (t.cloudId || t.id) + ':';
      if (n === st - 5 && !fired[k + 'pre']) { fired[k + 'pre'] = 1; notify('⏳ 5 daqiqadan keyin: ' + t.name, t.start + ' — tayyorlaning'); }
      if (n === st && !fired[k + 'start']) { fired[k + 'start'] = 1; notify('▶️ Boshlash vaqti: ' + t.name, 'Hoziroq boshlang, keyinga qoldirmang'); }
      if (n >= en + 10 && !lateTask) lateTask = t;
      if (n === en + 10 && !fired[k + 'late']) { fired[k + 'late'] = 1; notify('🔴 Kechikdingiz: ' + t.name, '10 daqiqa o‘tdi. Bajaring yoki sabab yozing.'); }
    });
    const bar = $('ktLateBar');
    if (bar) {
      if (lateTask) {
        $('ktLateTxt').textContent = '🔴 ' + lateTask.name + ' — ' + fmt(n - mins(lateTask.end || lateTask.start)) + ' kechikdi';
        bar.dataset.id = String(lateTask.id);
        bar.classList.add('show');
      } else bar.classList.remove('show');
    }
  }

  // ── Stats extension ─────────────────────────────────────────
  function statsHtml() {
    const log = (S && S.deferLog) || [];
    if (!log.length) return '<div class="cat-progress-card gl"><b>🧠 Kechiktirish tahlili</b><div style="font-size:12px;color:var(--tx2);margin-top:8px">Hozircha kechiktirish yozuvi yo‘q. Zo‘r!</div></div>';
    const week = log.filter((x) => Date.now() - x.ts < 7 * 864e5);
    const byReason = {}, byHour = {}, byCat = {};
    week.forEach((x) => {
      byReason[x.reason] = (byReason[x.reason] || 0) + 1;
      byHour[x.hour] = (byHour[x.hour] || 0) + 1;
      byCat[x.cat] = (byCat[x.cat] || 0) + 1;
    });
    const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n);
    const max = Math.max(1, ...Object.values(byReason));
    const rows = top(byReason, 5).map(([r, c]) =>
      `<div style="margin-top:8px"><div style="display:flex;justify-content:space-between;font-size:12px;color:var(--tx2)"><span>${esc2(r)}</span><span>${c}</span></div>
       <div style="height:6px;border-radius:99px;background:rgba(148,163,184,.2);margin-top:4px"><i style="display:block;height:100%;border-radius:99px;background:#f59e0b;width:${Math.round((c / max) * 100)}%"></i></div></div>`).join('');
    const hr = top(byHour, 1)[0], ct = top(byCat, 1)[0];
    const catLbl = ct && typeof CATS !== 'undefined' && CATS[ct[0]] ? CATS[ct[0]].icon + ' ' + CATS[ct[0]].l : (ct ? ct[0] : '—');
    return `<div class="cat-progress-card gl"><b>🧠 Kechiktirish tahlili (7 kun)</b>
      <div style="font-size:12px;color:var(--tx2);margin-top:6px">Eng zaif soat: <b style="color:var(--tx)">${hr ? pad(hr[0]) + ':00' : '—'}</b> · Eng ko‘p kechikkan yo‘nalish: <b style="color:var(--tx)">${catLbl}</b> · Jami: <b style="color:var(--tx)">${week.length}</b></div>
      ${rows}</div>`;
  }

  function injectStats() {
    const host = $('statsContent');
    if (!host) return;
    let box = $('ktDeferStats');
    if (!box) { box = document.createElement('div'); box.id = 'ktDeferStats'; host.appendChild(box); }
    box.innerHTML = statsHtml();
    let tg = $('ktTgBox');
    if (!tg) {
      tg = document.createElement('div');
      tg.id = 'ktTgBox';
      tg.className = 'cat-progress-card gl';
      tg.innerHTML =
        '<b>📨 Telegramga haftalik hisobot</b>' +
        '<div style="font-size:12px;color:var(--tx2);margin:6px 0 8px">Bot orqali hisobot olish uchun chat ID kiriting.</div>' +
        '<div style="display:flex;gap:8px"><input id="ktTgChat" class="fi" placeholder="Telegram chat ID" style="flex:1" value="' + ((S && S.tgChatId) || '') + '">' +
        '<button onclick="KTFocus.sendTelegram()" style="padding:9px 12px;border-radius:12px;border:1px solid var(--bdr2);background:rgba(56,189,248,.14);color:#38bdf8;font:600 12px/1 inherit;cursor:pointer">Yuborish</button></div>';
      host.appendChild(tg);
    }
  }

  function weeklySummary() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const k = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
      const map = (S.completions && S.completions[k]) || {};
      const done = Object.values(map).filter(Boolean).length;
      days.push({ date: k, done });
    }
    const defers = ((S && S.deferLog) || []).filter((x) => Date.now() - x.ts < 7 * 864e5);
    const byReason = {};
    defers.forEach((x) => { byReason[x.reason] = (byReason[x.reason] || 0) + 1; });
    return {
      days,
      total: days.reduce((a, b) => a + b.done, 0),
      streak: (S && S.streak) || 0,
      defers: defers.length,
      reasons: byReason,
    };
  }

  async function sendTelegram() {
    const chat = ($('ktTgChat') && $('ktTgChat').value.trim()) || S.tgChatId || '';
    if (!chat) { toast('Chat ID kiriting'); return; }
    S.tgChatId = chat; try { persist(); } catch (e) {}
    try {
      const res = await fetch('/api/public/report/telegram', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-device-token': localStorage.getItem('bh_device_token') || '' },
        body: JSON.stringify({ chatId: chat, summary: weeklySummary() }),
      });
      const j = await res.json().catch(() => ({}));
      toast(res.ok ? '✅ Telegramga yuborildi' : '❌ ' + (j.error || 'Yuborilmadi'));
    } catch (e) { toast('❌ Tarmoq xatosi'); }
  }

  // ── Wiring ──────────────────────────────────────────────────
  function refresh() { try { renderCard(); applyLocks(); escalate(); } catch (e) {} }

  function wrap(name, after) {
    const orig = window[name];
    if (typeof orig !== 'function' || orig.__ktWrapped) return;
    const fn = function () { const r = orig.apply(this, arguments); try { after.apply(this, arguments); } catch (e) {} return r; };
    fn.__ktWrapped = true;
    window[name] = fn;
  }

  function boot() {
    if (!ready()) { setTimeout(boot, 400); return; }
    mount();
    wrap('renderSchedule', () => { applyLocks(); renderCard(); });
    wrap('toggleTask', () => { refresh(); });
    wrap('renderStats', () => { injectStats(); });
    refresh();
    setInterval(refresh, 15000);
    if (!window.__ktFocusTick) {
      window.__ktFocusTick = setInterval(escalate, 30000);
    }
  }

  window.KTFocus = {
    refresh,
    done() { if (cardTaskId != null && typeof toggleTask === 'function') toggleTask(cardTaskId); refresh(); },
    start() { if (cardTaskId != null && typeof openFocusMode === 'function') openFocusMode(cardTaskId); },
    defer() { if (cardTaskId != null) askReason(cardTaskId); },
    askReason,
    pickReason,
    closeReason,
    jump() {
      const bar = $('ktLateBar');
      const id = bar && bar.dataset.id;
      if (id && typeof openFocusMode === 'function') openFocusMode(id);
    },
    sendTelegram,
    weeklySummary,
    stats: statsHtml,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
