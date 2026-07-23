import { createFileRoute } from "@tanstack/react-router";

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

        const upstream = new FormData();
        upstream.append("file", file, filename);
        upstream.append("model", "openai/gpt-4o-transcribe");
        // Uzbek — ISO-639-1
        upstream.append("language", "uz");

        const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: upstream,
        });
        const text = await res.text();
        if (!res.ok) {
          return json(
            { error: "Transkripsiya xatoligi", status: res.status, detail: text.slice(0, 500) },
            res.status === 429 ? 429 : 502,
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
