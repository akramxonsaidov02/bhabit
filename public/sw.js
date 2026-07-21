// Kun Tartibim — Service Worker
// Handles scheduled task notifications via setTimeout while the SW is alive.
// NOTE: setTimeout in a Service Worker is best-effort — it fires reliably
// while the browser/PWA is running or recently used. For fully-in-background
// notifications when the app is fully closed on mobile, use Capacitor's
// LocalNotifications plugin (see settings info).

const TIMERS = new Map(); // key -> timeoutId

self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });

function clearAll() {
  for (const id of TIMERS.values()) clearTimeout(id);
  TIMERS.clear();
}

async function showNotif(task, isCheck) {
  const title = isCheck
    ? '⏰ ' + task.name + ' — bajardingizmi?'
    : '🔔 ' + task.name;
  const body = isCheck
    ? 'Vaqt tugadi. Bajarilgan bo\'lsa belgilang.'
    : (task.start ? task.start + (task.end ? ' – ' + task.end : '') : '') +
      (task.note ? '\n' + task.note : '');
  const actions = isCheck
    ? [
        { action: 'done',   title: '✅ Bajarildi' },
        { action: 'snooze', title: '⏱ 10 daq' },
      ]
    : [
        { action: 'done', title: '✅ Bajarildi' },
      ];
  try {
    await self.registration.showNotification(title, {
      body,
      tag: 'kt-' + task.id + (isCheck ? '-check' : '-start'),
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: { taskId: task.id, isCheck },
      actions,
      renotify: true,
    });
  } catch (e) { /* noop */ }
}

self.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg.type === 'CLEAR_ALL') { clearAll(); return; }
  if (msg.type === 'SCHEDULE') {
    const { task, delayMs, isCheck } = msg;
    if (!task || typeof delayMs !== 'number' || delayMs <= 0) return;
    const key = task.id + (isCheck ? ':c' : ':s');
    if (TIMERS.has(key)) { clearTimeout(TIMERS.get(key)); }
    const id = setTimeout(() => {
      TIMERS.delete(key);
      showNotif(task, !!isCheck);
    }, Math.min(delayMs, 24 * 3600 * 1000));
    TIMERS.set(key, id);
  }
});

self.addEventListener('notificationclick', (event) => {
  const { action, notification } = event;
  const data = notification.data || {};
  notification.close();
  event.waitUntil((async () => {
    const clientsArr = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const target = clientsArr[0];
    if (action === 'done') {
      if (target) target.postMessage({ type: 'TASK_DONE', taskId: data.taskId });
    } else if (action === 'snooze') {
      if (target) target.postMessage({ type: 'SHOW_SNOOZE', taskId: data.taskId });
    } else {
      // Default click — focus the app and show the check dialog
      if (target) {
        target.postMessage({ type: 'SHOW_SNOOZE', taskId: data.taskId });
        try { await target.focus(); } catch(e){}
      } else {
        try { await self.clients.openWindow('/kun-tartibim.html'); } catch(e){}
      }
    }
  })());
});
