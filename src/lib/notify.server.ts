// Server-only: Web Push (VAPID) + Telegram delivery and the per-minute scheduler tick.
import { buildPushPayload } from "@block65/webcrypto-web-push";
import { getAdmin } from "@/lib/gate.server";

export type SchedTask = {
  id: string;
  name: string;
  start?: string;
  end?: string;
  cat?: string;
  done?: boolean;
};

function t2m(t?: string): number | null {
  if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function vapidConfigured() {
  return !!(process.env["VAPID_PUBLIC_KEY"] && process.env["VAPID_PRIVATE_KEY"]);
}

export async function sendPushTo(
  sub: { endpoint: string; p256dh: string; auth: string },
  data: Record<string, unknown>,
): Promise<{ ok: boolean; gone: boolean }> {
  try {
    const payload = await buildPushPayload(
      { data: JSON.stringify(data), options: { ttl: 300, urgency: "high" } },
      { endpoint: sub.endpoint, expirationTime: null, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      {
        subject: process.env["VAPID_SUBJECT"] || "mailto:admin@bhabit.lovable.app",
        publicKey: process.env["VAPID_PUBLIC_KEY"]!,
        privateKey: process.env["VAPID_PRIVATE_KEY"]!,
      },
    );
    const res = await fetch(sub.endpoint, payload);
    return { ok: res.ok, gone: res.status === 404 || res.status === 410 };
  } catch (e) {
    console.error("[push]", e);
    return { ok: false, gone: false };
  }
}

export async function pushToDevice(deviceId: string, data: Record<string, unknown>) {
  const db = await getAdmin();
  const { data: subs } = await db.from("push_subscriptions").select("*").eq("device_id", deviceId);
  let sent = 0;
  for (const s of subs || []) {
    const r = await sendPushTo(s, data);
    if (r.gone) await db.from("push_subscriptions").delete().eq("id", s.id);
    else if (r.ok) {
      sent++;
      await db.from("push_subscriptions").update({ last_used: new Date().toISOString() }).eq("id", s.id);
    }
  }
  return sent;
}

export function telegramConfigured() {
  return !!(process.env["TELEGRAM_BOT_TOKEN"] && process.env["TELEGRAM_CHAT_ID"]);
}

export async function sendTelegram(
  text: string,
  opts?: { chatId?: string; buttons?: { text: string; data: string }[][]; markdown?: boolean },
): Promise<boolean> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  const chatId = opts?.chatId || process.env["TELEGRAM_CHAT_ID"];
  if (!token || !chatId) return false;
  const body: Record<string, unknown> = { chat_id: chatId, text };
  if (opts?.markdown) body["parse_mode"] = "Markdown";
  if (opts?.buttons) {
    body["reply_markup"] = {
      inline_keyboard: opts.buttons.map((row) => row.map((b) => ({ text: b.text, callback_data: b.data }))),
    };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) console.error("[telegram] sendMessage failed", res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error("[telegram]", e);
    return false;
  }
}

export async function telegramApi(method: string, body: Record<string, unknown>) {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return (await res.json().catch(() => null)) as Record<string, unknown> | null;
  } catch {
    return null;
  }
}

// Called every minute by pg_cron. Decides which reminders are due and sends them.
export async function runTick(): Promise<{ checked: number; pushes: number; telegram: number }> {
  const db = await getAdmin();
  const { data: rows } = await db.from("device_schedules").select("*");
  const nowUtcMin = Math.floor(Date.now() / 60000);
  let pushes = 0,
    telegram = 0;

  for (const row of rows || []) {
    const tz = Number(row.tz_offset ?? 300);
    const localMin = nowUtcMin + tz; // minutes since epoch, local
    const localDayMin = ((localMin % 1440) + 1440) % 1440;
    // local date
    const localDate = new Date(localMin * 60000).toISOString().slice(0, 10);
    if (String(row.day) !== localDate) continue; // stale snapshot from another day

    const tasks = (Array.isArray(row.tasks) ? row.tasks : []) as SchedTask[];
    const sent = { ...((row.sent as Record<string, number>) || {}) };
    let changed = false;

    for (const t of tasks) {
      if (!t || !t.id || t.done) continue;
      const s = t2m(t.start);
      const e = t2m(t.end);
      const timeStr = (t.start || "") + (t.end ? " – " + t.end : "");

      // 5 minutes before start
      if (s !== null) {
        const key = `${t.id}:pre`;
        const diff = s - localDayMin;
        if (!sent[key] && diff <= 5 && diff >= 3) {
          sent[key] = Date.now();
          changed = true;
          if (row.push_on) {
            pushes += await pushToDevice(row.device_id, {
              title: "⏳ 5 daqiqadan so‘ng: " + t.name,
              body: timeStr,
              tag: "pre-" + t.id,
              taskId: t.id,
              kind: "pre",
            });
          }
        }
        const keyS = `${t.id}:start`;
        if (!sent[keyS] && diff <= 0 && diff >= -2) {
          sent[keyS] = Date.now();
          changed = true;
          if (row.push_on) {
            pushes += await pushToDevice(row.device_id, {
              title: "🔔 Boshlandi: " + t.name,
              body: timeStr,
              tag: "start-" + t.id,
              taskId: t.id,
              kind: "start",
            });
          }
        }
      }

      // at end: ask "did you do it?"
      if (e !== null && e > (s ?? -1)) {
        const key = `${t.id}:end`;
        const diff = localDayMin - e;
        if (!sent[key] && diff >= 0 && diff <= 2) {
          sent[key] = Date.now();
          changed = true;
          if (row.push_on) {
            pushes += await pushToDevice(row.device_id, {
              title: "⏰ " + t.name + " — bajardingizmi?",
              body: "Vaqt tugadi. Bajarilgan bo‘lsa belgilang.",
              tag: "end-" + t.id,
              taskId: t.id,
              kind: "check",
            });
          }
          if (row.telegram_on && telegramConfigured()) {
            const ok = await sendTelegram(`⏰ *${t.name}* (${timeStr}) vaqti tugadi.\nBajardingizmi?`, {
              markdown: true,
              buttons: [
                [
                  { text: "✅ Ha, bajardim", data: `done:${row.device_id}:${t.id}` },
                  { text: "❌ Yo‘q", data: `skip:${row.device_id}:${t.id}` },
                ],
              ],
            });
            if (ok) {
              telegram++;
              await db.from("telegram_state").upsert({
                chat_id: String(process.env["TELEGRAM_CHAT_ID"]),
                last_task_id: t.id,
                last_task_name: t.name,
                last_device_id: row.device_id,
                asked_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              });
            }
          }
        }
      }
    }

    if (changed) await db.from("device_schedules").update({ sent }).eq("device_id", row.device_id);
  }
  return { checked: (rows || []).length, pushes, telegram };
}
