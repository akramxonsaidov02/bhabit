import { createFileRoute } from "@tanstack/react-router";
import { extractToken, findDeviceByToken } from "@/lib/gate.server";

// Lovable AI STT proxy — o'zbek tilida ovozni matnga aylantirish.
// Client MediaRecorder blob yuboradi (webm/mp4/wav), biz uni gateway'ga uzatamiz.

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/voice-transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = extractToken(request);
        const device = await findDeviceByToken(token).catch(() => null);
        if (!device) return json({ error: "unauthorized" }, 401);

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) return json({ error: "AI xizmati sozlanmagan" }, 500);

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return json({ error: "multipart/form-data kutildi" }, 400);
        }
        const file = form.get("file");
        if (!(file instanceof Blob)) return json({ error: "Audio fayl yo'q" }, 400);
        if (file.size < 512) return json({ error: "Yozuv juda qisqa" }, 400);
        if (file.size > 24 * 1024 * 1024) return json({ error: "Yozuv juda katta (24MB dan oshdi)" }, 413);

        // Fayl kengaytmasini mimeType bo'yicha aniqlaymiz — OpenAI kengaytmadan formatni o'qiydi.
        const type = (file.type || "").split(";")[0].toLowerCase();
        const extMap: Record<string, string> = {
          "audio/webm": "webm",
          "audio/ogg": "ogg",
          "audio/mp4": "mp4",
          "audio/x-m4a": "m4a",
          "audio/m4a": "m4a",
          "audio/mpeg": "mp3",
          "audio/mp3": "mp3",
          "audio/wav": "wav",
          "audio/x-wav": "wav",
          "audio/wave": "wav",
        };
        const ext = extMap[type] || "webm";
        const filename = `recording.${ext}`;

        async function callGateway(model: string) {
          const upstream = new FormData();
          upstream.append("file", file as Blob, filename);
          upstream.append("model", model);
          // Diqqat: `language` yubormaymiz — model o'zi aniqlaydi.
          // (ba'zi kodlar, jumladan "uz", provider tomonidan 400 bilan rad etiladi)
          upstream.append(
            "prompt",
            "Ovoz o'zbek tilida. Matnni o'zbek lotin alifbosida yozing.",
          );
          const r = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
            method: "POST",
            headers: { Authorization: `Bearer ${apiKey}` },
            body: upstream,
          });
          return { r, body: await r.text() };
        }

        let res: Response;
        let text: string;
        try {
          const first = await callGateway("openai/gpt-4o-transcribe");
          res = first.r;
          text = first.body;
          if (!res.ok && res.status === 400) {
            // Ba'zi audio formatlarda katta model rad etadi — mini bilan qayta urinamiz
            const second = await callGateway("openai/gpt-4o-mini-transcribe");
            res = second.r;
            text = second.body;
          }
        } catch (e) {
          console.error("voice-transcribe fetch failed", e);
          return json({ error: "AI xizmatiga ulanib bo'lmadi" }, 503);
        }

        if (!res.ok) {
          console.error("voice-transcribe gateway error", res.status, text.slice(0, 500));
          const msg =
            res.status === 402
              ? "AI krediti tugagan"
              : res.status === 429
                ? "Juda ko'p so'rov — biroz kuting"
                : "Transkripsiya xatoligi";
          return json(
            { error: msg, status: res.status, detail: text.slice(0, 300) },
            res.status >= 400 && res.status < 500 ? res.status : 502,
          );
        }

        try {
          const data = JSON.parse(text);
          return json({ ok: true, text: String(data.text || "").trim() });
        } catch {
          return json({ ok: true, text: text.trim() });
        }
      },
    },
  },
});
