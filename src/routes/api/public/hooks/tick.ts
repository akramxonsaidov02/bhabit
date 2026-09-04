import { createFileRoute } from "@tanstack/react-router";
import { json } from "@/lib/gate.server";

// Called every minute by pg_cron. Sends push/Telegram reminders for closed apps.
// Security: caller must present the project's publishable key in the `apikey` header.
export const Route = createFileRoute("/api/public/hooks/tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["SUPABASE_ANON_KEY"];
        const got = request.headers.get("apikey") || "";
        if (!expected || got !== expected) return json({ error: "forbidden" }, 403);
        try {
          const { runTick } = await import("@/lib/notify.server");
          const r = await runTick();
          return json({ ok: true, ...r });
        } catch (e) {
          console.error("[tick]", e);
          return json({ error: "server_error" }, 500);
        }
      },
    },
  },
});
