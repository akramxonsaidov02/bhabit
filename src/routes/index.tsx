import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  gateFetch,
  getFingerprint,
  setDeviceToken,
  type DeviceInfo,
} from "@/lib/device";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "BHabits — Kirish" },
      { name: "description", content: "Qurulmangizni admin tomonidan tasdiqlashi kerak." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Gate,
});

type Screen = "loading" | "pin" | "qr" | "approved" | "error";

function Gate() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [message, setMessage] = useState<string>("");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [qrCode, setQrCode] = useState<string>("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<number | null>(null);

  const goToApp = useCallback((device: DeviceInfo) => {
    // Admin ham asosiy ilovaga kiradi. Admin panelga sozlamalardagi
    // "⚙️ Admin panel" tugmasi orqali o'tiladi.
    if (device.role === "viewer") {
      window.location.replace("/kun-tartibim.html?viewer=1");
    } else {
      window.location.replace("/kun-tartibim.html");
    }
  }, []);

  const bootstrapQr = useCallback(async () => {
    const fp = getFingerprint();
    const res = await gateFetch("request-approval", {
      method: "POST",
      body: JSON.stringify({
        fingerprint: fp,
        ua: navigator.userAgent,
      }),
    });
    if (!res.ok) {
      setScreen("error");
      setMessage("Server bilan bog'lanib bo'lmadi. Sahifani yangilang.");
      return;
    }
    const qr = res.data.qr as string;
    setQrCode(qr);
    const dataUrl = await QRCode.toDataURL(qr, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 340,
      color: { dark: "#0a0a0f", light: "#ffffff" },
    });
    setQrDataUrl(dataUrl);
    setScreen("qr");
  }, []);

  const checkStatus = useCallback(async () => {
    const res = await gateFetch("status", { method: "GET" });
    if (!res.ok) {
      setScreen("error");
      setMessage("Server javob bermayapti.");
      return;
    }
    const device = res.data.device as DeviceInfo | null;
    if (device) {
      setScreen("approved");
      goToApp(device);
      return;
    }
    if (!res.data.hasAdmin) {
      setScreen("pin");
      return;
    }
    await bootstrapQr();
  }, [bootstrapQr, goToApp]);

  useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  // Poll approval status once we're on the QR screen.
  useEffect(() => {
    if (screen !== "qr" || !qrCode) return;
    let cancelled = false;
    const tick = async () => {
      const res = await gateFetch(`approval-status?qr=${encodeURIComponent(qrCode)}`, { method: "GET" });
      if (cancelled) return;
      if (res.ok && res.data.status === "approved" && typeof res.data.token === "string") {
        setDeviceToken(res.data.token);
        setScreen("approved");
        const device = {
          id: "self",
          role: res.data.role as DeviceInfo["role"],
          name: null,
          permissions: (res.data.permissions as Record<string, boolean>) || {},
        };
        goToApp(device);
        return;
      }
      if (res.ok && (res.data.status === "expired" || res.data.status === "rejected")) {
        setMessage("QR kod muddati o'tdi. Sahifani yangilang.");
        setScreen("error");
        return;
      }
      pollRef.current = window.setTimeout(tick, 2500);
    };
    pollRef.current = window.setTimeout(tick, 2500);
    return () => {
      cancelled = true;
      if (pollRef.current) window.clearTimeout(pollRef.current);
    };
  }, [screen, qrCode, goToApp]);

  const submitPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || busy) return;
    setBusy(true);
    setMessage("");
    const res = await gateFetch("verify-pin", {
      method: "POST",
      body: JSON.stringify({
        pin,
        name: "Admin qurulma",
        ua: navigator.userAgent,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setMessage(
        res.data.error === "invalid_pin"
          ? "Maxfiy kod noto'g'ri."
          : "Xatolik: " + (res.data.error || "noma'lum"),
      );
      return;
    }
    setDeviceToken(res.data.token as string);
    setScreen("approved");
    goToApp((res.data.device as DeviceInfo) || { id: "self", role: "admin", name: null, permissions: {} });
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0a0a0f",
        color: "#f2f2f8",
        fontFamily: "system-ui, -apple-system, sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: 460, textAlign: "center" }}>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 700, margin: 0, letterSpacing: "-0.02em" }}>
          BHabits
        </h1>

        {screen === "loading" && (
          <p style={{ marginTop: 24, opacity: 0.7 }}>Yuklanmoqda…</p>
        )}

        {screen === "pin" && (
          <form onSubmit={submitPin} style={{ marginTop: 28 }}>
            <p style={{ opacity: 0.8, lineHeight: 1.5 }}>
              Bu sayt shaxsiy. Kirish uchun admin maxfiy kodini kiriting.
            </p>
            <div style={{ position: "relative", marginTop: 20 }}>
              <input
                type={showPin ? "text" : "password"}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                autoFocus
                autoComplete="off"
                placeholder="Maxfiy kod"
                style={{
                  width: "100%",
                  padding: "14px 44px 14px 16px",
                  borderRadius: 12,
                  border: "1px solid #2a2a35",
                  background: "#12121a",
                  color: "#f2f2f8",
                  fontSize: 16,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              <button
                type="button"
                onClick={() => setShowPin((v) => !v)}
                aria-label={showPin ? "Yashirish" : "Ko'rsatish"}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: "#8a8a99",
                  cursor: "pointer",
                  padding: 8,
                  fontSize: 18,
                }}
              >
                {showPin ? "🙈" : "👁"}
              </button>
            </div>
            {message && (
              <p style={{ color: "#ff6b6b", marginTop: 12, fontSize: 14 }}>{message}</p>
            )}
            <button
              type="submit"
              disabled={busy || !pin}
              style={{
                marginTop: 16,
                width: "100%",
                padding: "14px 16px",
                borderRadius: 12,
                border: "none",
                background: busy ? "#3a3a4a" : "#6366f1",
                color: "white",
                fontSize: 16,
                fontWeight: 600,
                cursor: busy || !pin ? "not-allowed" : "pointer",
              }}
            >
              {busy ? "Tekshirilmoqda…" : "Kirish"}
            </button>
          </form>
        )}

        {screen === "qr" && (
          <div style={{ marginTop: 28 }}>
            <p style={{ opacity: 0.85, lineHeight: 1.5, marginBottom: 20 }}>
              Bu qurulma hali ruxsat etilmagan. Admin qurulmasi bilan quyidagi QR kodni skaner qiling:
            </p>
            <div
              style={{
                background: "white",
                padding: 16,
                borderRadius: 20,
                display: "inline-block",
              }}
            >
              {qrDataUrl && (
                <img src={qrDataUrl} alt="QR" width={300} height={300} style={{ display: "block" }} />
              )}
            </div>
            <p style={{ marginTop: 20, opacity: 0.5, fontSize: 13 }}>
              Admin tasdiqlaganidan so'ng avtomatik kirasiz.
            </p>
          </div>
        )}

        {screen === "approved" && (
          <p style={{ marginTop: 28, opacity: 0.8 }}>Ruxsat berildi. Yo'naltirilmoqda…</p>
        )}

        {screen === "error" && (
          <div style={{ marginTop: 28 }}>
            <p style={{ color: "#ff6b6b" }}>{message}</p>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: 12,
                padding: "10px 20px",
                borderRadius: 10,
                border: "1px solid #2a2a35",
                background: "transparent",
                color: "#f2f2f8",
                cursor: "pointer",
              }}
            >
              Qayta urinish
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
