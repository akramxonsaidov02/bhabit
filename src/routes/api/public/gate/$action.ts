import { createFileRoute } from "@tanstack/react-router";
import {
  sha256,
  newToken,
  newQrCode,
  fullAdminPermissions,
  findDeviceByToken,
  extractToken,
  json,
  adminExists,
  hasPermission,
  getAdmin,
  syncCredentials,
} from "@/lib/gate.server";

// One splat route handles every gate action: /api/public/gate/<action>
// Keeps the auth surface small and easy to audit.
export const Route = createFileRoute("/api/public/gate/$action")({
  server: {
    handlers: {
      GET: async (ctx) => handle(ctx.request, ctx.params.action, "GET"),
      POST: async (ctx) => handle(ctx.request, ctx.params.action, "POST"),
    },
  },
});

async function handle(request: Request, action: string, method: string): Promise<Response> {
  try {
    if (action === "status" && method === "GET") return await status(request);
    if (action === "verify-pin" && method === "POST") return await verifyPin(request);
    if (action === "request-approval" && method === "POST") return await requestApproval(request);
    if (action === "approval-status" && method === "GET") return await approvalStatus(request);
    if (action === "approve" && method === "POST") return await approve(request);
    if (action === "devices" && method === "GET") return await listDevices(request);
    if (action === "revoke" && method === "POST") return await revoke(request);
    if (action === "change-pin" && method === "POST") return await changePin(request);
    if (action === "check-master-pin" && method === "POST") return await checkMasterPin(request);
    if (action === "sync-config" && method === "GET") return await syncConfig(request);
    return json({ error: "not_found" }, 404);
  } catch (err) {
    console.error("[gate]", action, err);
    return json({ error: "server_error" }, 500);
  }
}

async function status(request: Request) {
  const token = extractToken(request);
  const device = await findDeviceByToken(token);
  const hasAdmin = await adminExists();
  return json({
    hasAdmin,
    device: device
      ? {
          id: device.id,
          role: device.role,
          name: device.name,
          permissions: device.permissions,
        }
      : null,
  });
}

async function verifyPin(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { pin, name, ua } = body as { pin?: string; name?: string; ua?: string };
  if (!pin) return json({ error: "missing_pin" }, 400);

  const db = await getAdmin();
  const { data: cfg } = await db.from("app_admin_config").select("pin_hash").eq("id", 1).maybeSingle();
  if (!cfg || cfg.pin_hash !== sha256(pin)) {
    return json({ error: "invalid_pin" }, 401);
  }

  // Master PIN grants a fresh admin device (used for first-time setup or admin recovery).
  const token = newToken();
  const { data: dev, error } = await db
    .from("app_devices")
    .insert({
      token_hash: sha256(token),
      name: name || "Admin qurulma",
      user_agent: ua || null,
      role: "admin",
      permissions: fullAdminPermissions(),
    })
    .select("id, role, name, permissions")
    .single();
  if (error) return json({ error: "insert_failed" }, 500);
  return json({ token, device: dev });
}

async function requestApproval(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { fingerprint, ua, name } = body as { fingerprint?: string; ua?: string; name?: string };
  if (!fingerprint) return json({ error: "missing_fingerprint" }, 400);

  const db = await getAdmin();
  // Reuse a still-pending row for this fingerprint so the same device sees the same QR on refresh.
  const { data: existing } = await db
    .from("app_pending_approvals")
    .select("*")
    .eq("device_fingerprint", fingerprint)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();

  if (existing) return json({ qr: existing.qr_code, expiresAt: existing.expires_at });

  const qr = newQrCode();
  const { data, error } = await db
    .from("app_pending_approvals")
    .insert({
      qr_code: qr,
      device_fingerprint: fingerprint,
      user_agent: ua || null,
      status: "pending",
    })
    .select("qr_code, expires_at")
    .single();
  if (error) return json({ error: "insert_failed" }, 500);
  // name is captured on approval side; ignored here to keep payload minimal
  void name;
  return json({ qr: data.qr_code, expiresAt: data.expires_at });
}

async function approvalStatus(request: Request) {
  const url = new URL(request.url);
  const qr = url.searchParams.get("qr");
  if (!qr) return json({ error: "missing_qr" }, 400);
  const db = await getAdmin();
  const { data } = await db
    .from("app_pending_approvals")
    .select("status, approved_role, approved_permissions, approved_token_hash")
    .eq("qr_code", qr)
    .maybeSingle();
  if (!data) return json({ status: "unknown" });
  if (data.status !== "approved") return json({ status: data.status });
  // Return the plaintext token once, then null the hash so it can't be replayed.
  // The approve() endpoint stores the plaintext temporarily via a small trick:
  // approved_token_hash contains `plain:<token>` until first fetch; then swap to sha256.
  const raw = data.approved_token_hash || "";
  if (raw.startsWith("plain:")) {
    const token = raw.slice(6);
    await db
      .from("app_pending_approvals")
      .update({ approved_token_hash: null })
      .eq("qr_code", qr);
    return json({
      status: "approved",
      token,
      role: data.approved_role,
      permissions: data.approved_permissions,
    });
  }
  return json({ status: "approved" });
}

async function approve(request: Request) {
  const token = extractToken(request);
  const admin = await findDeviceByToken(token);
  if (!hasPermission(admin, "manage_devices") && !hasPermission(admin, "invite_admins")) {
    return json({ error: "forbidden" }, 403);
  }
  const body = await request.json().catch(() => ({}));
  const { qr, role, permissions, name } = body as {
    qr?: string;
    role?: "admin" | "sub_admin" | "user" | "viewer";
    permissions?: Record<string, boolean>;
    name?: string;
  };
  if (!qr || !role) return json({ error: "missing_params" }, 400);

  // Only a top-level admin (or a sub_admin with invite_admins) may create admins/sub_admins.
  if ((role === "admin" || role === "sub_admin") && !hasPermission(admin, "invite_admins")) {
    return json({ error: "forbidden" }, 403);
  }

  const db = await getAdmin();
  const { data: pending } = await db
    .from("app_pending_approvals")
    .select("*")
    .eq("qr_code", qr)
    .maybeSingle();
  if (!pending) return json({ error: "unknown_qr" }, 404);
  if (pending.status !== "pending") return json({ error: "already_processed" }, 409);
  if (new Date(pending.expires_at) < new Date()) return json({ error: "expired" }, 410);

  const newDeviceToken = newToken();
  const perms = role === "admin" ? fullAdminPermissions() : permissions || {};

  const { data: dev, error: insErr } = await db
    .from("app_devices")
    .insert({
      token_hash: sha256(newDeviceToken),
      name: name || `Qurulma (${role})`,
      user_agent: pending.user_agent,
      role,
      permissions: perms,
      approved_by: admin!.id,
    })
    .select("id")
    .single();
  if (insErr) return json({ error: "insert_failed" }, 500);

  const { error: updErr } = await db
    .from("app_pending_approvals")
    .update({
      status: "approved",
      approved_role: role,
      approved_permissions: perms,
      // Store plaintext token temporarily; approval-status fetches once and nulls it.
      approved_token_hash: "plain:" + newDeviceToken,
    })
    .eq("qr_code", qr);
  if (updErr) return json({ error: "update_failed" }, 500);

  return json({ ok: true, deviceId: dev.id });
}

async function listDevices(request: Request) {
  const token = extractToken(request);
  const admin = await findDeviceByToken(token);
  if (!hasPermission(admin, "manage_devices")) return json({ error: "forbidden" }, 403);
  const db = await getAdmin();
  const { data, error } = await db
    .from("app_devices")
    .select("id, name, user_agent, role, permissions, active, created_at, last_seen")
    .eq("active", true)
    .order("created_at", { ascending: false });
  if (error) return json({ error: "server_error" }, 500);
  return json({ devices: data, me: admin!.id });
}

async function revoke(request: Request) {
  const token = extractToken(request);
  const admin = await findDeviceByToken(token);
  if (!hasPermission(admin, "manage_devices")) return json({ error: "forbidden" }, 403);
  const body = await request.json().catch(() => ({}));
  const { id } = body as { id?: string };
  if (!id) return json({ error: "missing_id" }, 400);
  if (id === admin!.id) return json({ error: "cannot_revoke_self" }, 400);
  const db = await getAdmin();
  const { error } = await db.from("app_devices").update({ active: false }).eq("id", id);
  if (error) return json({ error: "server_error" }, 500);
  return json({ ok: true });
}

async function changePin(request: Request) {
  const token = extractToken(request);
  const admin = await findDeviceByToken(token);
  if (!hasPermission(admin, "change_pin")) return json({ error: "forbidden" }, 403);
  const body = await request.json().catch(() => ({}));
  const { oldPin, newPin } = body as { oldPin?: string; newPin?: string };
  if (!oldPin || !newPin || newPin.length < 8) return json({ error: "invalid_params" }, 400);
  const db = await getAdmin();
  const { data: cfg } = await db.from("app_admin_config").select("pin_hash").eq("id", 1).maybeSingle();
  if (!cfg || cfg.pin_hash !== sha256(oldPin)) return json({ error: "invalid_old_pin" }, 401);
  const { error } = await db
    .from("app_admin_config")
    .update({ pin_hash: sha256(newPin), updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return json({ error: "server_error" }, 500);
  return json({ ok: true });
}

// Verifies the master PIN WITHOUT minting a device token. Used for local PIN recovery,
// so no recovery secret has to ship inside client-side JavaScript.
async function checkMasterPin(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { pin } = body as { pin?: string };
  if (!pin) return json({ error: "invalid_params" }, 400);
  const db = await getAdmin();
  const { data: cfg } = await db.from("app_admin_config").select("pin_hash").eq("id", 1).maybeSingle();
  if (!cfg || cfg.pin_hash !== sha256(pin)) return json({ error: "invalid_pin" }, 401);
  return json({ ok: true });
}

// Sync credentials are handed out server-side only, after the device token has been
// checked against the database. Read-only ("viewer") devices never receive the
// credentials, so the read-only restriction can no longer be flipped from devtools.
async function syncConfig(request: Request) {
  const token = extractToken(request);
  const device = await findDeviceByToken(token);
  if (!device) return json({ error: "forbidden" }, 403);
  if (device.role === "viewer") {
    return json({ readOnly: true, role: device.role });
  }
  const cfg = syncCredentials();
  if (!cfg) return json({ error: "not_configured" }, 503);
  return json({ readOnly: false, role: device.role, url: cfg.url, key: cfg.key });
}
