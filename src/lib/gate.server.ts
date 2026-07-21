// Server-only helpers for the device auth gate.
// SECURITY: All device/admin operations funnel through here. Callers must have
// already verified admin token or master PIN before privileged actions.
import { createHash, randomBytes } from "node:crypto";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function newToken(): string {
  return randomBytes(24).toString("base64url");
}

export function newQrCode(): string {
  return "bhq_" + randomBytes(18).toString("base64url");
}

export const DEFAULT_PERMISSIONS = {
  manage_devices: true,
  invite_admins: true,
  change_settings: true,
  manage_tasks: true,
  change_pin: false,
} as const;

export type PermissionKey = keyof typeof DEFAULT_PERMISSIONS;

export function fullAdminPermissions() {
  return {
    manage_devices: true,
    invite_admins: true,
    change_settings: true,
    manage_tasks: true,
    change_pin: true,
  };
}

export async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function findDeviceByToken(token: string | null) {
  if (!token) return null;
  const db = await getAdmin();
  const { data } = await db
    .from("app_devices")
    .select("*")
    .eq("token_hash", sha256(token))
    .eq("active", true)
    .maybeSingle();
  if (data) {
    // fire-and-forget last_seen
    db.from("app_devices").update({ last_seen: new Date().toISOString() }).eq("id", data.id).then(() => {});
  }
  return data as null | {
    id: string;
    role: "admin" | "sub_admin" | "user" | "viewer";
    permissions: Record<string, boolean>;
    name: string | null;
    active: boolean;
  };
}

export function extractToken(request: Request): string | null {
  return request.headers.get("x-device-token");
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function adminExists(): Promise<boolean> {
  const db = await getAdmin();
  const { count } = await db
    .from("app_devices")
    .select("id", { count: "exact", head: true })
    .in("role", ["admin"])
    .eq("active", true);
  return (count ?? 0) > 0;
}

export function hasPermission(
  device: { role: string; permissions: Record<string, boolean> } | null,
  key: PermissionKey,
): boolean {
  if (!device) return false;
  if (device.role === "admin") return true;
  if (device.role === "sub_admin") return !!device.permissions?.[key];
  return false;
}
