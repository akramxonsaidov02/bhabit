import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BHabits — Kun tartibi va odatlar nazorati" },
      { name: "description", content: "Namoz vaqtlari, ish, sport va kundalik odatlaringizni bitta joyda rejalashtiring. AI yordamida kun tartibingizni avtomatik moslashtiradi." },
      { property: "og:title", content: "BHabits — Kun tartibi va odatlar nazorati" },
      { property: "og:description", content: "Namoz vaqtlari, ish, sport va kundalik odatlaringizni bitta joyda rejalashtiring." },
      { property: "og:url", content: "https://bhabits.lovable.app/" },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/a1162bd8-1ccb-42b9-9525-7740f124befb" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/a1162bd8-1ccb-42b9-9525-7740f124befb" },
    ],
    links: [{ rel: "canonical", href: "https://bhabits.lovable.app/" }],
  }),
  component: Index,
});

function Index() {
  useEffect(() => {
    window.location.replace("/kun-tartibim.html");
  }, []);
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0f", color: "#f2f2f8", fontFamily: "system-ui", padding: "2rem" }}>
      <div style={{ maxWidth: 640, textAlign: "center" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 700, margin: 0 }}>
          BHabits — Kun tartibi va odatlar nazorati
        </h1>
        <p style={{ marginTop: "1rem", opacity: 0.85, lineHeight: 1.6 }}>
          Namoz vaqtlari, ish, sport va kundalik odatlaringizni bitta joyda
          rejalashtiring. AI yordamida kun tartibingiz avtomatik moslashadi,
          bildirishnomalar sizni har bir vazifa uchun eslatib turadi.
        </p>
        <p style={{ marginTop: "1.5rem", opacity: 0.6, fontSize: "0.9rem" }}>
          Ilova yuklanmoqda…
        </p>
      </div>
    </main>
  );
}
