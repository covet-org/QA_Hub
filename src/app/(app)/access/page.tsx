import type { Metadata } from "next";
import { env } from "@/lib/env";
import { requireAccess } from "@/lib/viewer";
import {
  Card,
  CardBody,
  CardHeader,
  PageHeader,
  PageShell,
  Tag,
} from "@/components/ui";

export const metadata: Metadata = { title: "Access" };

/**
 * Read-only view of the access policy.
 *
 * Permissions are configuration, not data: there is no database to click
 * against. Changing a role means editing the env vars listed here and
 * redeploying — about a minute — in exchange for an access system that
 * cannot be taken down by a third-party outage.
 */
function EmailList({
  emails,
  empty,
  tone,
}: {
  emails: string[];
  empty: string;
  tone: "brand" | "danger" | "neutral";
}) {
  if (emails.length === 0) {
    return <p className="text-[13px] text-slate-500">{empty}</p>;
  }
  return (
    <ul className="flex flex-wrap gap-1.5">
      {emails.map((email) => (
        <li key={email}>
          <Tag tone={tone}>{email}</Tag>
        </li>
      ))}
    </ul>
  );
}

function EnvVar({ name }: { name: string }) {
  return (
    <code className="rounded bg-surface-sunken px-1.5 py-0.5 font-mono text-[11px] text-slate-700 ring-1 ring-hairline ring-inset">
      {name}
    </code>
  );
}

export default async function AccessPage() {
  await requireAccess("/access");

  return (
    <div>
      <PageHeader
        kicker="Admin"
        title="Access"
        description="Who can open QA Brain, and with which role. Permissions come from configuration — there is no database behind this page, so access cannot break when a service goes down."
        footnote={`Domain · @${env.allowedEmailDomain}`}
      />
      <PageShell>
        <Card>
          <CardHeader
            title="Everyone on the domain"
            subtitle={`Any verified Google account on @${env.allowedEmailDomain} can sign in, with no approval step. New people land as QA team, which unlocks every section except this one. Each sign-in emails ${env.notifyEmail}.`}
          />
        </Card>

        <div className="grid items-start gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader
              title="Admins"
              subtitle="Full access, including this page."
            />
            <CardBody className="space-y-2">
              <EmailList
                emails={env.adminEmails}
                empty="None configured."
                tone="brand"
              />
              <p className="text-[11px] text-slate-500">
                Set <EnvVar name="QA_ADMIN_EMAILS" />
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Restricted to viewer"
              subtitle="Signed in, but Manual Testing and Automation stay locked."
            />
            <CardBody className="space-y-2">
              <EmailList
                emails={env.viewerEmails}
                empty="Nobody is restricted — everyone on the domain is QA team."
                tone="neutral"
              />
              <p className="text-[11px] text-slate-500">
                Set <EnvVar name="QA_VIEWER_EMAILS" />
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Blocked"
              subtitle="Refused at sign-in, even on the domain."
            />
            <CardBody className="space-y-2">
              <EmailList
                emails={env.blockedEmails}
                empty="Nobody is blocked."
                tone="danger"
              />
              <p className="text-[11px] text-slate-500">
                Set <EnvVar name="QA_BLOCKED_EMAILS" />
              </p>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Changing access"
            subtitle="Edit the variable in Vercel → Settings → Environment Variables, then redeploy. Changes apply on the next deployment, usually within a minute."
          />
          <CardBody>
            <p className="text-[13px] leading-relaxed text-slate-600">
              Share links were removed along with the KV store: only @
              {env.allowedEmailDomain} accounts can reach QA Brain now. If
              somebody outside the domain needs a view, that needs a deliberate
              feature rather than a link.
            </p>
          </CardBody>
        </Card>
      </PageShell>
    </div>
  );
}
