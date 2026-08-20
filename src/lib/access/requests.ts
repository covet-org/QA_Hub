import "server-only";

import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { roleForEmail, type Role } from "@/lib/roles";
import { kvDelete, kvGet, kvList, kvSet } from "@/lib/store";
import { signToken } from "@/lib/access/token";

/**
 * Access permissions.
 *
 * The allowlist lives in the KV store as one record per email. Admins
 * manage it on /access: approve pending sign-ins, set roles (incl.
 * admin), invite people ahead of time, and revoke (remove) access.
 * `QA_ADMIN_EMAILS` is an always-on bootstrap admin set so an admin can
 * never be locked out.
 */

export type AccessStatus = "pending" | "approved" | "denied";

export interface AccessRecord {
  email: string;
  name: string;
  status: AccessStatus;
  /** Effective role once approved. */
  role: Role;
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  lastNotifiedAt?: string;
  /** Pre-authorized by an admin before ever signing in. */
  invited?: boolean;
  /** False once the person has actually signed in at least once. */
  signedIn?: boolean;
}

const key = (email: string) => `access:${email.toLowerCase()}`;
const NOTIFY_THROTTLE_MS = 60 * 60 * 1000;
const DECISION_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export async function getAccessRecord(
  email: string,
): Promise<AccessRecord | null> {
  return kvGet<AccessRecord>(key(email));
}

export async function listAccessRecords(): Promise<AccessRecord[]> {
  const records = await kvList<AccessRecord>("access:");
  return records.sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
}

/** Bootstrap admins from env — always admin, cannot be removed via UI. */
export function isAdminEmail(email: string): boolean {
  return env.adminEmails.includes(email.toLowerCase());
}

/**
 * Called on every sign-in. Honors an existing decision (approved or
 * invited users go straight in); creates a pending request on first
 * unknown sign-in and notifies the admin (throttled).
 */
export async function ensureAccessRequest(
  email: string,
  name: string,
): Promise<AccessRecord> {
  const normalized = email.toLowerCase();

  // Bootstrap admins are the approvers — never gated behind themselves.
  if (isAdminEmail(normalized)) {
    return {
      email: normalized,
      name,
      status: "approved",
      role: "admin",
      requestedAt: new Date().toISOString(),
      signedIn: true,
    };
  }

  let record = await kvGet<AccessRecord>(key(normalized));

  if (record) {
    // Already known — keep the admin's decision (incl. invitations).
    // Just record the display name and that they've now signed in.
    let changed = false;
    if (name && record.name !== name) {
      record.name = name;
      changed = true;
    }
    if (!record.signedIn) {
      record.signedIn = true;
      changed = true;
    }
    if (record.status === "pending") {
      const last = record.lastNotifiedAt ? Date.parse(record.lastNotifiedAt) : 0;
      if (Date.now() - last > NOTIFY_THROTTLE_MS) {
        record.lastNotifiedAt = new Date().toISOString();
        changed = true;
        await notifyAdminOfRequest(record);
      }
    }
    if (changed) await kvSet(key(normalized), record);
    return record;
  }

  // First time we've seen this email — create a pending request.
  record = {
    email: normalized,
    name,
    status: "pending",
    role: roleForEmail(normalized),
    requestedAt: new Date().toISOString(),
    signedIn: true,
    lastNotifiedAt: new Date().toISOString(),
  };
  await kvSet(key(normalized), record);
  await notifyAdminOfRequest(record);
  return record;
}

/** Approve a user (pending or existing) with a role. */
export async function decideAccess(options: {
  email: string;
  action: "approve" | "deny";
  role?: Role;
  decidedBy: string;
}): Promise<AccessRecord | null> {
  // "deny" removes the user entirely (revoke semantics).
  if (options.action === "deny") {
    await removeAccess(options.email);
    return null;
  }

  const normalized = options.email.toLowerCase();
  const existing = await kvGet<AccessRecord>(key(normalized));
  const record: AccessRecord = {
    email: normalized,
    name: existing?.name ?? "",
    status: "approved",
    role: options.role ?? existing?.role ?? "viewer",
    requestedAt: existing?.requestedAt ?? new Date().toISOString(),
    invited: existing?.invited,
    signedIn: existing?.signedIn,
    decidedAt: new Date().toISOString(),
    decidedBy: options.decidedBy,
  };
  await kvSet(key(normalized), record);
  return record;
}

/** Set the role of an already-approved user. */
export async function setUserRole(email: string, role: Role, by: string) {
  return decideAccess({ email, action: "approve", role, decidedBy: by });
}

/** Remove a user from the allowlist entirely. */
export async function removeAccess(email: string): Promise<void> {
  await kvDelete(key(email));
}

/**
 * Invite (pre-authorize) an email before they sign in: creates an
 * approved record and emails them a sign-in link. When they sign in
 * they skip the pending step.
 */
export async function inviteUser(options: {
  email: string;
  role: Role;
  invitedBy: string;
}): Promise<AccessRecord> {
  const normalized = options.email.toLowerCase();
  const existing = await kvGet<AccessRecord>(key(normalized));
  const record: AccessRecord = {
    email: normalized,
    name: existing?.name ?? "",
    status: "approved",
    role: options.role,
    requestedAt: existing?.requestedAt ?? new Date().toISOString(),
    invited: true,
    signedIn: existing?.signedIn ?? false,
    decidedAt: new Date().toISOString(),
    decidedBy: options.invitedBy,
  };
  await kvSet(key(normalized), record);
  await sendInviteEmail(record);
  return record;
}

async function sendInviteEmail(record: AccessRecord): Promise<void> {
  const html = `
  <div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px">
    <p style="font-size:18px;font-weight:700;color:#0b4a60;margin:0">co·vet <span style="font-weight:400;color:#64748b">QA Brain</span></p>
    <h2 style="font-size:16px;color:#0f172a">You've been invited</h2>
    <p style="font-size:14px;color:#334155;line-height:1.6">
      You have been granted <strong>${record.role}</strong> access to CoVet
      QA Brain. Sign in with your @${env.allowedEmailDomain} Google account to
      get started.
    </p>
    <div style="margin:18px 0">
      <a href="${env.appUrl}" style="display:inline-block;padding:10px 18px;border-radius:10px;background:#0f5a74;color:#ffffff;font-weight:600;text-decoration:none;font-size:14px">Open QA Brain</a>
    </div>
    <p style="font-size:12px;color:#94a3b8">${env.appUrl}</p>
  </div>`;

  await sendEmail({
    to: record.email,
    subject: "You've been invited to CoVet QA Brain",
    html,
  });
}

function decisionUrl(email: string, action: "approve" | "deny", role?: Role) {
  const token = signToken({ email, action, role }, DECISION_TOKEN_TTL_SECONDS);
  return `${env.appUrl}/api/access/decision?token=${encodeURIComponent(token)}`;
}

async function notifyAdminOfRequest(record: AccessRecord): Promise<void> {
  const button = (href: string, label: string, color: string) =>
    `<a href="${href}" style="display:inline-block;margin:4px 6px 4px 0;padding:10px 18px;border-radius:10px;background:${color};color:#ffffff;font-weight:600;text-decoration:none;font-size:14px">${label}</a>`;

  const html = `
  <div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px">
    <p style="font-size:18px;font-weight:700;color:#0b4a60;margin:0">co·vet <span style="font-weight:400;color:#64748b">QA Brain</span></p>
    <h2 style="font-size:16px;color:#0f172a">Access request</h2>
    <p style="font-size:14px;color:#334155;line-height:1.6">
      <strong>${record.name || record.email}</strong> (${record.email})
      tried to sign in to QA Brain and is waiting for your approval.
    </p>
    <div style="margin:18px 0">
      ${button(decisionUrl(record.email, "approve", "viewer"), "Approve as Viewer", "#0f5a74")}
      ${button(decisionUrl(record.email, "approve", "qa"), "Approve as QA team", "#0b4a60")}
      ${button(decisionUrl(record.email, "deny"), "Deny", "#9f1239")}
    </div>
    <p style="font-size:12px;color:#94a3b8">
      You can also manage requests on the
      <a href="${env.appUrl}/access" style="color:#0f5a74">Access page</a>.
      Links are valid for 7 days.
    </p>
  </div>`;

  await sendEmail({
    to: env.notifyEmail,
    subject: `QA Brain access request — ${record.name || record.email}`,
    html,
  });
}
