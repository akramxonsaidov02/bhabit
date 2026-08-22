import { createFileRoute } from "@tanstack/react-router";
import { extractToken, findDeviceByToken, json } from "@/lib/gate.server";

type Summary = {
  days?: { date: string; done: number }[];
  total?: number;
  streak?: number;
  defers?: number;
  reasons?: Record<string, number>;
};

function buildText(s: Summary) {
  const lines: string[] = [];
  lines.push("📊 *Haftalik hisobot — Kun Tartibim*", "");
  (s.days || []).forEach((d) => {
    lines.push(`${d.date}: ${d.done} ta bajarildi`);
  });
  lines.push("", `Jami: ${s.total ?? 0} ta · 🔥 Streak: ${s.streak ?? 0} kun`);
  lines.push(`⏳ Kechiktirishlar: ${s.defers ?? 0} ta`);
  const reasons = Object.entries(s.reasons || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (reasons.length) {
    lines.push("", "Sabablar:");
    reasons.forEach(([r, c]) => lines.push(`• ${r} — ${c}`));
  }
  return lines.join("\n");
}

export const Route = createFileRoute("/api/public/report/telegram")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const device = await findDeviceByToken(extractToken(request));
        if (!device || device.role === "viewer") return json({ error: "Ruxsat yo'q" }, 403);

        const token = process.env["TELEGRAM_BOT_TOKEN"];
        if (!token) return json({ error: "Telegram bot sozlanmagan" }, 400);

        let body: { chatId?: string; summary?: Summary } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return json({ error: "Noto'g'ri so'rov" }, 400);
        }
        const chatId = String(body.chatId || "").trim();
        if (!/^-?\d{3,20}$/.test(chatId)) return json({ error: "Chat ID noto'g'ri" }, 400);

        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text: buildText(body.summary || {}),
            parse_mode: "Markdown",
          }),
        });
        if (!res.ok) return json({ error: "Telegram xabarni qabul qilmadi" }, 502);
        return json({ ok: true });
      },
    },
  },
});
