import "server-only";

import { sendEmail } from "@/lib/email";
import { env } from "@/lib/env";
import { roleForEmail, type Role } from "@/lib/roles";
import { kvGet, kvList, kvSet } from "@/lib/store";
import { signToken } from "@/lib/access/token";

/**
 * Sign-in approval flow.
 *
 * Every sign-in by a non-admin creates (or refreshes) an access request.
 * While the request is pending, each attempt notifies the QA lead by
 * email (throttled to once per hour per user) with one-click
 * approve/deny links. Admins decide here or on the /access page.
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

export function isAdminEmail(email: string): boolean {
  return env.adminEmails.includes(email.toLowerCase());
}

/**
 * Called on every sign-in. Creates the request on first attempt and
 * notifies the QA lead on each attempt while pending (throttled).
 */
export async function ensureAccessRequest(
  email: string,
  name: string,
): Promise<AccessRecord> {
  const normalized = email.toLowerCase();

  // Admins are the approvers — never gated behind themselves.
  if (isAdminEmail(normalized)) {
    return {
      email: normalized,
      name,
      status: "approved",
      role: "admin",
      requestedAt: new Date().toISOString(),
    };
  }

  let record = await kvGet<AccessRecord>(key(normalized));
  if (!record) {
    record = {
      email: normalized,
      name,
      status: "pending",
      role: roleForEmail(normalized),
      requestedAt: new Date().toISOString(),
    };
    await kvSet(key(normalized), record);
  }

  if (record.status === "pending") {
    const last = record.lastNotifiedAt ? Date.parse(record.lastNotifiedAt) : 0;
    if (Date.now() - last > NOTIFY_THROTTLE_MS) {
      record.lastNotifiedAt = new Date().toISOString();
      await kvSet(key(normalized), record);
      await notifyAdminOfRequest(record);
    }
  }

  return record;
}

export async function decideAccess(options: {
  email: string;
  action: "approve" | "deny";
  role?: Role;
  decidedBy: string;
}): Promise<AccessRecord | null> {
  const record = await kvGet<AccessRecord>(key(options.email));
  if (!record) return null;

  record.status = options.action === "approve" ? "approved" : "denied";
  if (options.action === "approve" && options.role) {
    record.role = options.role;
  }
  record.decidedAt = new Date().toISOString();
  record.decidedBy = options.decidedBy;
  await kvSet(key(options.email), record);
  return record;
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
