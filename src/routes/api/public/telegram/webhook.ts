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
        const { telegramApi, sendTelegram } = await import("@/lib/notify.server");
        const db = await getAdmin();

        // ── Inline button pressed ──
        const cq = upd.callback_query;
        if (cq?.data) {
          const chatId = String(cq.message?.chat?.id ?? "");
          if (allowedChat && chatId !== allowedChat) return json({ ok: true });
          const m = /^(done|skip):([0-9a-f-]{36}):(.{1,64})$/.exec(cq.data);
          if (m) {
            const [, act, deviceId, taskId] = m;
            await db.from("device_inbox").insert({ device_id: deviceId, task_id: taskId, action: act, source: "telegram" });
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
          const text = msg.text.trim().toLowerCase();
          if (text === "/start" || text === "/id") {
            await sendTelegram(`Salom! Chat ID: ${chatId}\nVazifa vaqti tugaganda shu yerga savol keladi.`, { chatId });
            return json({ ok: true });
          }
          const yes = /^(ha|xa|bajardim|done|\+|✅)/.test(text);
          const no = /^(yo'q|yoq|yo‘q|yo’q|skip|-|❌)/.test(text);
          if (yes || no) {
            const { data: st } = await db.from("telegram_state").select("*").eq("chat_id", chatId).maybeSingle();
            if (st?.last_task_id && st.last_device_id) {
              await db.from("device_inbox").insert({
                device_id: st.last_device_id,
                task_id: st.last_task_id,
                action: yes ? "done" : "skip",
                source: "telegram",
              });
              await sendTelegram(yes ? `✅ "${st.last_task_name}" bajarildi deb belgilandi.` : `❌ "${st.last_task_name}" bajarilmadi.`, { chatId });
            } else {
              await sendTelegram("Hozircha ochiq savol yo‘q.", { chatId });
            }
          }
        }
        return json({ ok: true });
      },
    },
  },
});
