import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { clearDeviceToken, gateFetch, type DeviceInfo } from "@/lib/device";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "BHabits — Admin panel" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Admin,
});

type Device = {
  id: string;
  name: string | null;
  user_agent: string | null;
  role: "admin" | "sub_admin" | "user" | "viewer";
  permissions: Record<string, boolean>;
  active: boolean;
  created_at: string;
  last_seen: string;
};

const PERM_LABELS: Record<string, string> = {
  manage_devices: "Qurulmalarni boshqarish",
  invite_admins: "Yangi admin taklif qilish",
  change_settings: "Sozlamalarni o'zgartirish",
  manage_tasks: "Vazifalarni boshqarish",
  change_pin: "Maxfiy kodni o'zgartirish",
};

function Admin() {
  const [me, setMe] = useState<DeviceInfo | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [tab, setTab] = useState<"devices" | "scan" | "pin">("devices");
  const [msg, setMsg] = useState<string>("");

  const load = useCallback(async () => {
    const st = await gateFetch("status", { method: "GET" });
    if (!st.ok || !st.data.device) {
      window.location.replace("/");
      return;
    }
    setMe(st.data.device as DeviceInfo);
    const ds = await gateFetch("devices", { method: "GET" });
    if (ds.ok) setDevices((ds.data.devices as Device[]) || []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const signOut = () => {
    clearDeviceToken();
    window.location.replace("/");
  };

  const revoke = async (id: string) => {
    if (!confirm("Ushbu qurulmani chiqarib yuborasizmi?")) return;
    const r = await gateFetch("revoke", { method: "POST", body: JSON.stringify({ id }) });
    if (!r.ok) return setMsg((r.data.error as string) || "Xatolik");
    void load();
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0a0a0f",
        color: "#f2f2f8",
        fontFamily: "system-ui",
        padding: "1.5rem 1rem 4rem",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: "1.4rem", margin: 0 }}>Admin panel</h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, opacity: 0.6 }}>
              {me?.name} · {me?.role}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <a
              href="/kun-tartibim.html"
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                background: "#6366f1",
                color: "white",
                textDecoration: "none",
                fontSize: 14,
              }}
            >
              Ilovaga
            </a>
            <button
              onClick={signOut}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                background: "transparent",
                border: "1px solid #2a2a35",
                color: "#f2f2f8",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Chiqish
            </button>
          </div>
        </header>

        <nav style={{ display: "flex", gap: 8, marginTop: 24, borderBottom: "1px solid #1e1e28" }}>
          {(["devices", "scan", "pin"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "10px 16px",
                background: "transparent",
                border: "none",
                borderBottom: tab === t ? "2px solid #6366f1" : "2px solid transparent",
                color: tab === t ? "#f2f2f8" : "#8a8a99",
                cursor: "pointer",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {t === "devices" ? "Faol qurulmalar" : t === "scan" ? "QR skaner" : "Maxfiy kod"}
            </button>
          ))}
        </nav>

        {msg && (
          <p style={{ color: "#ff6b6b", marginTop: 16, fontSize: 14 }}>{msg}</p>
        )}

        {tab === "devices" && (
          <section style={{ marginTop: 20 }}>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 10 }}>
              {devices.map((d) => (
                <li
                  key={d.id}
                  style={{
                    background: "#12121a",
                    border: "1px solid #1e1e28",
                    borderRadius: 12,
                    padding: 14,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>
                        {d.name || "Qurulma"}{" "}
                        <span style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: d.role === "admin" ? "#4338ca" : d.role === "sub_admin" ? "#0e7490" : d.role === "viewer" ? "#57534e" : "#334155",
                          marginLeft: 6,
                        }}>{d.role}</span>
                        {d.id === me?.id && (
                          <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.6 }}>(bu qurulma)</span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, opacity: 0.55, marginTop: 4, wordBreak: "break-word" }}>
                        {d.user_agent}
                      </div>
                      <div style={{ fontSize: 11, opacity: 0.45, marginTop: 4 }}>
                        Oxirgi faollik: {new Date(d.last_seen).toLocaleString()}
                      </div>
                    </div>
                    {d.id !== me?.id && (
                      <button
                        onClick={() => revoke(d.id)}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: "1px solid #7f1d1d",
                          background: "transparent",
                          color: "#fca5a5",
                          cursor: "pointer",
                          fontSize: 12,
                          whiteSpace: "nowrap",
                        }}
                      >
                        Chiqarish
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === "scan" && <ScanPanel onDone={load} />}
        {tab === "pin" && <PinPanel canChange={!!me?.permissions?.change_pin || me?.role === "admin"} />}
      </div>
    </main>
  );
}

function ScanPanel({ onDone }: { onDone: () => void }) {
  const [qr, setQr] = useState<string>("");
  const [role, setRole] = useState<"user" | "viewer" | "sub_admin">("user");
  const [name, setName] = useState<string>("");
  const [perms, setPerms] = useState<Record<string, boolean>>({
    manage_devices: false,
    invite_admins: false,
    change_settings: true,
    manage_tasks: true,
    change_pin: false,
  });
  const [scanning, setScanning] = useState(false);
  const [msg, setMsg] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);

  const startScan = useCallback(async () => {
    setMsg("");
    setScanning(true);
    const mod = await import("html5-qrcode");
    const { Html5Qrcode } = mod;
    const el = containerRef.current!;
    el.innerHTML = "";
    const region = document.createElement("div");
    region.id = "bh-qr-region";
    region.style.width = "100%";
    el.appendChild(region);
    const scanner = new Html5Qrcode("bh-qr-region");
    scannerRef.current = scanner as unknown as { stop: () => Promise<void>; clear: () => void };
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        async (decoded: string) => {
          if (!decoded.startsWith("bhq_")) return;
          try {
            await scanner.stop();
            scanner.clear();
          } catch {
            /* noop */
          }
          setScanning(false);
          setQr(decoded);
        },
        () => {},
      );
    } catch (err) {
      setScanning(false);
      setMsg("Kamerani ochib bo'lmadi: " + String((err as Error).message ?? err));
    }
  }, []);

  const stopScan = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        /* noop */
      }
    }
    setScanning(false);
  }, []);

  useEffect(() => {
    return () => {
      void stopScan();
    };
  }, [stopScan]);

  const approve = async () => {
    if (!qr) return;
    const res = await gateFetch("approve", {
      method: "POST",
      body: JSON.stringify({
        qr,
        role,
        name: name || undefined,
        permissions: role === "sub_admin" ? perms : undefined,
      }),
    });
    if (!res.ok) return setMsg((res.data.error as string) || "Xatolik");
    setMsg("✓ Qurulma tasdiqlandi");
    setQr("");
    onDone();
  };

  return (
    <section style={{ marginTop: 20 }}>
      {!qr && !scanning && (
        <div style={{ textAlign: "center" }}>
          <p style={{ opacity: 0.7, marginBottom: 16 }}>
            Yangi qurulmaning ekranidagi QR kodni skaner qiling.
          </p>
          <button
            onClick={startScan}
            style={{
              padding: "12px 24px",
              borderRadius: 12,
              background: "#6366f1",
              color: "white",
              border: "none",
              fontSize: 15,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            📷 Kamerani ochish
          </button>
        </div>
      )}

      {scanning && (
        <div>
          <div ref={containerRef} style={{ background: "#000", borderRadius: 12, overflow: "hidden" }} />
          <button
            onClick={stopScan}
            style={{
              marginTop: 12,
              padding: "10px 20px",
              borderRadius: 10,
              background: "transparent",
              border: "1px solid #2a2a35",
              color: "#f2f2f8",
              cursor: "pointer",
            }}
          >
            Bekor qilish
          </button>
        </div>
      )}

      {qr && !scanning && (
        <div>
          <p style={{ opacity: 0.8, fontSize: 14 }}>
            QR o'qildi. Ushbu qurulmaga qanday ruxsat berasiz?
          </p>
          <div style={{ marginTop: 12 }}>
            <label style={{ display: "block", fontSize: 13, marginBottom: 6, opacity: 0.7 }}>Nom (ixtiyoriy)</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Masalan: Ish noutbuki"
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid #2a2a35",
                background: "#12121a",
                color: "#f2f2f8",
                fontSize: 14,
                boxSizing: "border-box",
              }}
            />
          </div>
          <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
            {(
              [
                { v: "user", label: "Oddiy foydalanuvchi (vazifalarni belgilay oladi)" },
                { v: "viewer", label: "Faqat ko'ruvchi (hech narsa o'zgartira olmaydi)" },
                { v: "sub_admin", label: "Ikkinchi admin (huquqlarni pastda tanlang)" },
              ] as const
            ).map((opt) => (
              <label
                key={opt.v}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: 12,
                  borderRadius: 10,
                  border: role === opt.v ? "1px solid #6366f1" : "1px solid #2a2a35",
                  background: role === opt.v ? "rgba(99,102,241,0.1)" : "transparent",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                <input
                  type="radio"
                  name="role"
                  checked={role === opt.v}
                  onChange={() => setRole(opt.v)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>

          {role === "sub_admin" && (
            <div style={{ marginTop: 16, padding: 14, border: "1px solid #2a2a35", borderRadius: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10, opacity: 0.8 }}>
                Ruxsat etilgan imkoniyatlar
              </div>
              <div style={{ display: "grid", gap: 8 }}>
                {Object.keys(PERM_LABELS).map((k) => (
                  <label key={k} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14 }}>
                    <input
                      type="checkbox"
                      checked={!!perms[k]}
                      onChange={(e) => setPerms((p) => ({ ...p, [k]: e.target.checked }))}
                    />
                    {PERM_LABELS[k]}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
            <button
              onClick={approve}
              style={{
                flex: 1,
                padding: "12px 20px",
                borderRadius: 10,
                background: "#22c55e",
                color: "white",
                border: "none",
                fontSize: 15,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Tasdiqlash
            </button>
            <button
              onClick={() => setQr("")}
              style={{
                padding: "12px 20px",
                borderRadius: 10,
                background: "transparent",
                border: "1px solid #2a2a35",
                color: "#f2f2f8",
                cursor: "pointer",
              }}
            >
              Bekor
            </button>
          </div>
          {msg && <p style={{ marginTop: 10, fontSize: 14 }}>{msg}</p>}
        </div>
      )}
    </section>
  );
}

function PinPanel({ canChange }: { canChange: boolean }) {
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [msg, setMsg] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);

  if (!canChange) {
    return (
      <p style={{ marginTop: 20, opacity: 0.7 }}>
        Sizga maxfiy kodni o'zgartirish uchun ruxsat berilmagan.
      </p>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg("");
    const r = await gateFetch("change-pin", {
      method: "POST",
      body: JSON.stringify({ oldPin, newPin }),
    });
    if (!r.ok) return setMsg((r.data.error as string) || "Xatolik");
    setMsg("✓ Maxfiy kod yangilandi");
    setOldPin("");
    setNewPin("");
  };

  const inputStyle = {
    width: "100%",
    padding: "12px 44px 12px 14px",
    borderRadius: 10,
    border: "1px solid #2a2a35",
    background: "#12121a",
    color: "#f2f2f8",
    fontSize: 14,
    boxSizing: "border-box" as const,
  };
  const eyeStyle = {
    position: "absolute" as const,
    right: 8,
    top: "50%",
    transform: "translateY(-50%)",
    background: "transparent",
    border: "none",
    color: "#8a8a99",
    cursor: "pointer",
    padding: 8,
  };

  return (
    <form onSubmit={submit} style={{ marginTop: 20, display: "grid", gap: 12, maxWidth: 380 }}>
      <div style={{ position: "relative" }}>
        <input
          type={showOld ? "text" : "password"}
          value={oldPin}
          onChange={(e) => setOldPin(e.target.value)}
          placeholder="Joriy maxfiy kod"
          style={inputStyle}
        />
        <button type="button" onClick={() => setShowOld((v) => !v)} style={eyeStyle}>{showOld ? "🙈" : "👁"}</button>
      </div>
      <div style={{ position: "relative" }}>
        <input
          type={showNew ? "text" : "password"}
          value={newPin}
          onChange={(e) => setNewPin(e.target.value)}
          placeholder="Yangi maxfiy kod (kamida 8 belgi)"
          style={inputStyle}
        />
        <button type="button" onClick={() => setShowNew((v) => !v)} style={eyeStyle}>{showNew ? "🙈" : "👁"}</button>
      </div>
      <button
        type="submit"
        disabled={!oldPin || newPin.length < 8}
        style={{
          padding: "12px 20px",
          borderRadius: 10,
          background: "#6366f1",
          color: "white",
          border: "none",
          fontSize: 15,
          fontWeight: 600,
          cursor: "pointer",
          opacity: !oldPin || newPin.length < 8 ? 0.5 : 1,
        }}
      >
        Yangilash
      </button>
      {msg && <p style={{ fontSize: 14 }}>{msg}</p>}
    </form>
  );
}
