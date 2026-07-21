import { createFileRoute } from "@tanstack/react-router";

// Lovable AI Gateway proxy for the Kun Tartibim static app.
// Supports two modes:
//   - "suggest": suggest category/time/note for a single new task
//   - "replan":  redistribute all tasks around prayer times, dayStart & sleep
//
// Called from public/kun-tartibim.html as fetch('/api/ai-plan', {...}).

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

async function callGateway(messages: unknown, apiKey: string) {
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      response_format: { type: "json_object" },
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    return { ok: false as const, status: res.status, body: text };
  }
  let data: any = null;
  try { data = JSON.parse(text); } catch { /* keep null */ }
  const content = data?.choices?.[0]?.message?.content ?? "";
  return { ok: true as const, content };
}

export const Route = createFileRoute("/api/ai-plan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
          return new Response(
            JSON.stringify({ error: "AI xizmati sozlanmagan" }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }

        let payload: any = {};
        try { payload = await request.json(); } catch { /* empty */ }
        const mode = payload?.mode;

        if (mode === "suggest") {
          const name: string = String(payload.name || "").slice(0, 200);
          if (!name) {
            return new Response(JSON.stringify({ error: "Nom kerak" }), {
              status: 400, headers: { "Content-Type": "application/json" },
            });
          }
          const dayStart = payload.dayStart || "06:30";
          const sleep = payload.sleep || "22:30";
          const prayers = payload.prayers || {};
          const system = [
            "Sen kun tartibi yordamchisi. Foydalanuvchi Marg'ilon shahridan, namoz o'qiydi.",
            `Kun ${dayStart} da boshlanadi, ${sleep} da tugaydi.`,
            `Namoz vaqtlari: ${JSON.stringify(prayers)}.`,
            "Faqat sof JSON qaytar, boshqa matn yozma. Format:",
            '{"category":"morning|work|prayer|food|sport|medicine|other|night","start":"HH:MM","end":"HH:MM","priority":"yuqori|o\'rta|past","note":"qisqa maslahat"}',
          ].join("\n");
          const r = await callGateway(
            [
              { role: "system", content: system },
              { role: "user", content: `Vazifa: "${name}"` },
            ],
            apiKey,
          );
          if (!r.ok) {
            return new Response(JSON.stringify({ error: "AI xatoligi", status: r.status }), {
              status: 502, headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(
            JSON.stringify({ ok: true, content: r.content }),
            { headers: { "Content-Type": "application/json" } },
          );
        }

        if (mode === "replan") {
          const tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
          const prayers = payload.prayers || {};
          const dayStart = payload.dayStart || "06:30";
          const sleep = payload.sleep || "22:30";
          const system = [
            "Sen kun tartibi rejalashtiruvchisan. Vazifalarni qayta taqsimlaysan.",
            "Qoidalar:",
            `- Kun ${dayStart} da boshlanadi, ${sleep} da tugaydi.`,
            "- Namoz (cat='prayer') vazifalarini SIRA siljitma. Ular tayanch nuqta.",
            "- Boshqa vazifalarni namoz vaqtlariga to'qnashmaydigan qilib joylashtir.",
            "- Vazifa davomiyligini iloji boricha saqla.",
            "- Ovqat (food) namozdan oldin/keyin mos joyga; sport (sport) ertalabki/kechki bo'sh oralig'ga; ish (work) uzun bo'laklarga.",
            "- Har bir vazifa uchun HH:MM formatida start va end qaytar.",
            "Faqat JSON qaytar, boshqa matn yo'q. Format:",
            '{"tasks":[{"id":<number>,"start":"HH:MM","end":"HH:MM"}, ...]}',
          ].join("\n");
          const slim = tasks.map((t: any) => ({
            id: t.id, name: t.name, cat: t.cat,
            start: t.start, end: t.end,
          }));
          const user = JSON.stringify({ prayers, tasks: slim });
          const r = await callGateway(
            [
              { role: "system", content: system },
              { role: "user", content: user },
            ],
            apiKey,
          );
          if (!r.ok) {
            return new Response(JSON.stringify({ error: "AI xatoligi", status: r.status }), {
              status: 502, headers: { "Content-Type": "application/json" },
            });
          }
          return new Response(
            JSON.stringify({ ok: true, content: r.content }),
            { headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response(JSON.stringify({ error: "Noma'lum rejim" }), {
          status: 400, headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
