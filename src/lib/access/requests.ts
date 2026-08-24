import "server-only";

import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { roleForEmail, type Role } from "@/lib/roles";
import { kvDelete, kvGet, kvList, kvSet } from "@/lib/store";

/**
 * Access permissions.
 *
 * Anyone with a verified Google account on ALLOWED_EMAIL_DOMAIN gets in:
 * the domain IS the allowlist. Signing in creates an approved record and
 * emails NOTIFY_EMAIL once, so the QA lead knows who arrived without
 * anybody waiting on an approval.
 *
 * Records in the KV store still carry ROLES (viewer / qa / admin), which
 * admins set on /access, plus an explicit `denied` state to shut someone
 * out. `QA_ADMIN_EMAILS` is an always-on bootstrap admin set so an admin
 * can never be locked out.
 *
 * Access does NOT depend on the store being reachable — see getViewer()
 * in lib/viewer.ts. A store outage used to send every non-admin to
 * /pending, which is exactly the rejection this replaced.
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
 * Called on every sign-in. Domain members are approved on the spot; the
 * only decision honored is an explicit `denied`. The first sign-in (and
 * the upgrade of anyone left `pending` by the old approval flow) emails
 * the QA lead.
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
    // An explicit denial is the one thing that still blocks a domain
    // member; everything else is let straight through.
    if (record.status === "denied") return record;

    let changed = false;
    if (name && record.name !== name) {
      record.name = name;
      changed = true;
    }
    const firstSignIn = !record.signedIn;
    if (firstSignIn) {
      record.signedIn = true;
      changed = true;
    }
    // Anyone left pending by the old approval flow is approved now.
    const wasPending = record.status === "pending";
    if (wasPending) {
      record.status = "approved";
      record.role = record.role ?? roleForEmail(normalized);
      record.decidedAt = new Date().toISOString();
      record.decidedBy = "domain";
      changed = true;
    }
    if (changed) await kvSet(key(normalized), record);
    // Notify on the first real arrival only, so this is not a per-login
    // mail. Throttled in case a record write keeps failing.
    if (firstSignIn || wasPending) await notifyAdminOfSignIn(record);
    return record;
  }

  // First time we have seen this email — approved because the domain
  // matched, which the Auth.js signIn callback already enforced.
  record = {
    email: normalized,
    name,
    status: "approved",
    role: roleForEmail(normalized),
    requestedAt: new Date().toISOString(),
    decidedAt: new Date().toISOString(),
    decidedBy: "domain",
    signedIn: true,
    lastNotifiedAt: new Date().toISOString(),
  };
  await kvSet(key(normalized), record);
  await notifyAdminOfSignIn(record);
  return record;
}

/** Approve a user (pending or existing) with a role, or block them. */
export async function decideAccess(options: {
  email: string;
  action: "approve" | "deny";
  role?: Role;
  decidedBy: string;
}): Promise<AccessRecord | null> {
  const normalizedEmail = options.email.toLowerCase();

  // "deny" must now PERSIST a denied record. Deleting the record used to
  // be enough, because an unknown email landed in pending. With the
  // domain acting as the allowlist, a deleted record means "let them
  // in", so revoking somebody would have silently stopped working.
  if (options.action === "deny") {
    const existing = await kvGet<AccessRecord>(key(normalizedEmail));
    const denied: AccessRecord = {
      email: normalizedEmail,
      name: existing?.name ?? "",
      status: "denied",
      role: existing?.role ?? "viewer",
      requestedAt: existing?.requestedAt ?? new Date().toISOString(),
      signedIn: existing?.signedIn,
      decidedAt: new Date().toISOString(),
      decidedBy: options.decidedBy,
    };
    await kvSet(key(normalizedEmail), denied);
    return denied;
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

/**
 * Tells the QA lead somebody new arrived. Not an approval request —
 * they are already in — so the only action offered is revoking.
 *
 * Never throws: a mail failure must not stop somebody signing in.
 */
async function notifyAdminOfSignIn(record: AccessRecord): Promise<void> {
  const roleLabel =
    record.role === "admin"
      ? "admin"
      : record.role === "qa"
        ? "QA team"
        : "viewer";
  const html = `
  <div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:16px">
    <p style="font-size:18px;font-weight:700;color:#0b4a60;margin:0">co·vet <span style="font-weight:400;color:#64748b">QA Brain</span></p>
    <h2 style="font-size:16px;color:#0f172a">New sign-in</h2>
    <p style="font-size:14px;color:#334155;line-height:1.6">
      <strong>${record.name || record.email}</strong> (${record.email})
      signed in to QA Brain for the first time and was let in automatically
      as <strong>${roleLabel}</strong>, because the address is on the
      ${env.allowedEmailDomain} domain.
    </p>
    <p style="font-size:13px;color:#334155;line-height:1.6">
      No action needed. To change their role or remove them, use the
      <a href="${env.appUrl}/access" style="color:#0f5a74">Access page</a>.
    </p>
  </div>`;

  try {
    await sendEmail({
      to: env.notifyEmail,
      subject: `QA Brain — ${record.name || record.email} just signed in`,
      html,
    });
  } catch (error) {
    console.error(
      `Sign-in notification failed for ${record.email}: ${error instanceof Error ? error.message : error}`,
    );
  }
}

