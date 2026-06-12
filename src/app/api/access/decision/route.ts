import { decideAccess } from "@/lib/access/requests";
import { verifyToken } from "@/lib/access/token";
import { env } from "@/lib/env";
import type { Role } from "@/lib/roles";

interface DecisionPayload {
  email: string;
  action: "approve" | "deny";
  role?: Role;
  exp: number;
}

function page(title: string, body: string, ok: boolean): Response {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head>
<body style="font-family:Segoe UI,Arial,sans-serif;background:#f4f6f8;display:flex;justify-content:center;padding:64px 16px">
  <div style="background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;max-width:440px">
    <p style="font-size:18px;font-weight:700;color:#0b4a60;margin:0 0 16px">co·vet <span style="font-weight:400;color:#64748b">QA Brain</span></p>
    <h1 style="font-size:17px;color:${ok ? "#047857" : "#9f1239"};margin:0 0 8px">${title}</h1>
    <p style="font-size:14px;color:#334155;line-height:1.6">${body}</p>
    <p style="margin-top:20px"><a href="${env.appUrl}/access" style="color:#0f5a74;font-size:14px">Open the Access page</a></p>
  </div>
</body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

/** One-click approve/deny endpoint used by the notification emails. */
export async function GET(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token");
  const payload = token ? verifyToken<DecisionPayload>(token) : null;

  if (!payload) {
    return page(
      "Link expired or invalid",
      "This decision link is no longer valid. Use the Access page to manage requests.",
      false,
    );
  }

  const record = await decideAccess({
    email: payload.email,
    action: payload.action,
    role: payload.role,
    decidedBy: "email-link",
  });

  if (!record) {
    return page(
      "Request not found",
      `No access request exists for ${payload.email}.`,
      false,
    );
  }

  return payload.action === "approve"
    ? page(
        "Access approved",
        `${record.name || record.email} can now sign in with the <strong>${record.role}</strong> role.`,
        true,
      )
    : page(
        "Access denied",
        `${record.name || record.email} has been denied. They will be blocked at sign-in.`,
        true,
      );
}
