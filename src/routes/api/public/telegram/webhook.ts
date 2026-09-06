import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "node:crypto";
import { json, getAdmin } from "@/lib/gate.server";

// Telegram → app. Handles "✅ Ha, bajardim" / "❌ Yo‘q" buttons and plain "ha"/"yo'q" replies.
// Security: X-Telegram-Bot-Api-Secret-Token must equal sha256("kt-webhook:" + BOT_TOKEN).
export function webhookSecret(botToken: string) {
  return createHash("sha256").update(`kt-webhook:${botToken}`).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

type Update = {
  update_id?: number;
  message?: { chat?: { id?: number }; text?: string };
  callback_query?: { id?: string; data?: string; message?: { chat?: { id?: number }; message_id?: number; text?: string } };
};

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const botToken = process.env["TELEGRAM_BOT_TOKEN"];
        const allowedChat = String(process.env["TELEGRAM_CHAT_ID"] || "");
        if (!botToken) return json({ error: "not_configured" }, 503);
        const got = request.headers.get("x-telegram-bot-api-secret-token") || "";
        if (!safeEqual(got, webhookSecret(botToken))) return json({ error: "unauthorized" }, 401);

        let upd: Update = {};
        try {
          upd = (await request.json()) as Update;
        } catch {
          return json({ ok: true });
        }
        const { telegramApi, sendTelegram, markTaskInSchedule, formatTaskList, localNow } = await import("@/lib/notify.server");
        const db = await getAdmin();

        type Task = import("@/lib/notify.server").SchedTask;
        // Most recently updated device schedule for today — the bot works against it.
        async function todaySchedule() {
          const { data } = await db.from("device_schedules").select("*").order("updated_at", { ascending: false }).limit(5);
          for (const r of data || []) {
            const now = localNow(Number(r.tz_offset ?? 300));
            if (String(r.day) === now.date) return { row: r, now, tasks: (Array.isArray(r.tasks) ? r.tasks : []) as Task[] };
          }
          return null;
        }
        async function applyAction(deviceId: string, taskId: string, act: "done" | "skip") {
          await db.from("device_inbox").insert({ device_id: deviceId, task_id: taskId, action: act, source: "telegram" });
          if (act === "done") await markTaskInSchedule(deviceId, taskId, true);
        }

        // ── Inline button pressed ──
        const cq = upd.callback_query;
        if (cq?.data) {
          const chatId = String(cq.message?.chat?.id ?? "");
          if (allowedChat && chatId !== allowedChat) return json({ ok: true });
          const m = /^(done|skip):([0-9a-f-]{36}):(.{1,64})$/.exec(cq.data);
          if (m) {
            const [, act, deviceId, taskId] = m;
            await applyAction(deviceId, taskId, act as "done" | "skip");
            await telegramApi("answerCallbackQuery", { callback_query_id: cq.id, text: act === "done" ? "✅ Belgilandi" : "Keyinroq eslataman" });
            if (cq.message?.message_id) {
              await telegramApi("editMessageText", {
                chat_id: chatId,
                message_id: cq.message.message_id,
                text: (cq.message.text || "") + (act === "done" ? "\n\n✅ Bajarildi" : "\n\n❌ Bajarilmadi"),
              });
            }
          } else {
            await telegramApi("answerCallbackQuery", { callback_query_id: cq.id });
          }
          return json({ ok: true });
        }

        // ── Plain text reply ──
        const msg = upd.message;
        if (msg?.text && msg.chat?.id != null) {
          const chatId = String(msg.chat.id);
          if (allowedChat && chatId !== allowedChat) {
            await sendTelegram("Bu bot faqat egasi uchun.", { chatId });
            return json({ ok: true });
          }
          const raw = msg.text.trim();
          const text = raw.toLowerCase();
          const cmd = text.split(/[\s@]/)[0];

          if (cmd === "/start" || cmd === "/yordam" || cmd === "/help") {
            await sendTelegram(
              `Salom! Men Kun Tartibim botiman.\n\n/bugun — bugungi reja va holat\n/keyingi — navbatdagi vazifa\n/qolgan — bajarilmaganlar\n/bajardim <nom> — vazifani belgilash\n/id — Chat ID\n\nVazifa vaqti tugaganda o‘zim so‘rayman; "ha" yoki "yo‘q" deb javob bering.`,
              { chatId },
            );
            return json({ ok: true });
          }
          if (cmd === "/id") {
            await sendTelegram(`Chat ID: ${chatId}`, { chatId });
            return json({ ok: true });
          }
          if (cmd === "/bugun" || cmd === "/qolgan" || cmd === "/keyingi") {
            const s = await todaySchedule();
            if (!s || !s.tasks.length) {
              await sendTelegram("Bugungi jadval hali serverga kelmagan — ilovani bir marta oching.", { chatId });
              return json({ ok: true });
            }
            const done = s.tasks.filter((t) => t.done).length;
            if (cmd === "/bugun") {
              await sendTelegram(`📋 Bugun: ${done}/${s.tasks.length} bajarildi\n\n${formatTaskList(s.tasks, s.now.dayMin)}`, { chatId });
            } else if (cmd === "/qolgan") {
              const left = s.tasks.filter((t) => !t.done);
              await sendTelegram(left.length ? `⬜ Qolgan (${left.length}):\n\n${formatTaskList(left)}` : "🏆 Hammasi bajarilgan!", { chatId });
            } else {
              const toMin = (t?: string) => (t && /^\d{1,2}:\d{2}$/.test(t) ? +t.split(":")[0] * 60 + +t.split(":")[1] : 9999);
              const next = s.tasks.filter((t) => !t.done && toMin(t.start) >= s.now.dayMin).sort((a, b) => toMin(a.start) - toMin(b.start))[0];
              await sendTelegram(next ? `⏭ Keyingi: ${next.start} — ${next.name}` : "Bugun boshqa vazifa qolmadi.", { chatId });
            }
            return json({ ok: true });
          }
          if (cmd === "/bajardim") {
            const q = raw.slice(cmd.length).trim().toLowerCase();
            const s = await todaySchedule();
            const hit = q && s ? s.tasks.find((t) => !t.done && t.name.toLowerCase().includes(q)) : null;
            if (hit && s) {
              await applyAction(s.row.device_id, hit.id, "done");
              await sendTelegram(`✅ "${hit.name}" bajarildi deb belgilandi.`, { chatId });
            } else {
              await sendTelegram(q ? `"${q}" nomli bajarilmagan vazifa topilmadi. /qolgan` : "Foydalanish: /bajardim <vazifa nomi>", { chatId });
            }
            return json({ ok: true });
          }

          const yes = /^(ha|xa|bajardim|done|\+|✅)/.test(text);
          const no = /^(yo'q|yoq|yo‘q|yo’q|skip|-|❌)/.test(text);
          if (yes || no) {
            const { data: st } = await db.from("telegram_state").select("*").eq("chat_id", chatId).maybeSingle();
            if (st?.last_task_id && st.last_device_id) {
              await applyAction(st.last_device_id, st.last_task_id, yes ? "done" : "skip");
              await db.from("telegram_state").update({ last_task_id: null, updated_at: new Date().toISOString() }).eq("chat_id", chatId);
              await sendTelegram(yes ? `✅ "${st.last_task_name}" bajarildi deb belgilandi.` : `❌ "${st.last_task_name}" bajarilmadi.`, { chatId });
            } else {
              await sendTelegram("Hozircha ochiq savol yo‘q. /bugun — holatni ko‘rish", { chatId });
            }
          } else {
            await sendTelegram("Tushunmadim. /yordam", { chatId });
          }
        }
        return json({ ok: true });
      },
    },
  },
});
