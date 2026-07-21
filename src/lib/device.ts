// Client-side device identity helpers.
// The device token is a bearer secret; keep it in localStorage per-origin.

const TOKEN_KEY = "bh_device_token";
const FP_KEY = "bh_device_fp";

export function getDeviceToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setDeviceToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearDeviceToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}

export function getFingerprint(): string {
  if (typeof window === "undefined") return "server";
  let fp = window.localStorage.getItem(FP_KEY);
  if (fp) return fp;
  const seed =
    (window.navigator.userAgent || "") +
    "|" +
    (window.screen.width + "x" + window.screen.height) +
    "|" +
    Intl.DateTimeFormat().resolvedOptions().timeZone +
    "|" +
    Math.random().toString(36).slice(2) +
    Date.now().toString(36);
  fp = btoa(seed).slice(0, 40);
  window.localStorage.setItem(FP_KEY, fp);
  return fp;
}

export async function gateFetch(action: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json");
  const token = getDeviceToken();
  if (token) headers.set("x-device-token", token);
  const res = await fetch(`/api/public/gate/${action}`, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data } as {
    ok: boolean;
    status: number;
    data: Record<string, unknown> & { error?: string };
  };
}

export type DeviceRole = "admin" | "sub_admin" | "user" | "viewer";
export type DeviceInfo = {
  id: string;
  role: DeviceRole;
  name: string | null;
  permissions: Record<string, boolean>;
};
