# CoVet QA Brain

The QA department's home page — roadmap, manual vs automation effort
allocation, release readiness and testing visibility. Modeled on the
[Product Brain](https://product-brain-blond.vercel.app/roadmap) page.

## Stack

- **Next.js (App Router) + TypeScript + Tailwind CSS** — server components,
  strict types
- **Auth.js v5 (NextAuth)** — Google SSO restricted to the `co.vet`
  Workspace domain, with hierarchical roles
- **Testiny REST API** — live manual-testing data (cases, folders, runs),
  cached server-side for 5 minutes
- **Vercel** — hosting and environment configuration

## Pages & access

| Page | Route | Minimum role |
| --- | --- | --- |
| Home | `/` | viewer |
| Roadmap (Linear releases × Testiny coverage) | `/roadmap` | viewer |
| Releases — Active / Closed (Testiny runs) | `/releases` | viewer |
| Bugs — Bugs / CS Bugs (Linear, by release) | `/bugs` | viewer |
| Manual Testing (Testiny inventory) | `/manual` | qa |
| Automation (phase 2) | `/automation` | qa |
| Access (permission policy) | `/access` | admin |

Roles: `admin ⊃ qa ⊃ viewer`. Locked pages show a lock icon in the
sidebar and are enforced **server-side** (`requireAccess`), not just
hidden.

### Who can sign in

**The domain is the allowlist.** Any verified `@co.vet` Google account
gets in with no approval step, landing as `qa` — every section except
the admin Access page. `NOTIFY_EMAIL` is told when somebody signs in.

Three environment variables are the whole permission model:

| Variable | Effect |
| --- | --- |
| `QA_ADMIN_EMAILS` | Full access, including `/access` |
| `QA_VIEWER_EMAILS` | Demoted — no Manual Testing or Automation |
| `QA_BLOCKED_EMAILS` | Refused at sign-in; they land on `/no-access` |

Changing a role means editing the variable in Vercel and redeploying
(about a minute). **/access** shows the current policy read-only.

There is deliberately no database. Access used to depend on an Upstash KV
store, and when that store became unreachable every sign-in failed with
"Access Denied" — on a dashboard that only reads Linear and Testiny.
Configuration cannot have an outage.

Share links and guest access were removed with it: only `@co.vet`
accounts can reach QA Brain.

## Local development

```bash
npm install
copy .env.example .env.local   # then fill in values
npm run dev
```

Required env vars (see [.env.example](.env.example)):

1. `AUTH_SECRET` — generate with `npx auth secret`
2. `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` — create an **OAuth client ID**
   (type: Web application) in
   [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   with redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<your-vercel-domain>/api/auth/callback/google`
3. `TESTINY_API_KEY` — Testiny → Account Settings → API Keys. Until set,
   the app shows clearly-labelled sample data, so the UI is fully demoable
   without credentials.
4. `RESEND_API_KEY` — sign up at [resend.com](https://resend.com) (free
   tier) to send the sign-in notifications. Without it they are logged to
   the server console instead, and sign-in still works.
5. `QA_ADMIN_EMAILS` / `QA_VIEWER_EMAILS` / `QA_BLOCKED_EMAILS` — the
   permission model. No database is involved; see "Who can sign in".
6. `APP_URL` — the public URL, used inside email links.

## Deploying to Vercel

1. Push this repo to GitHub and import it in Vercel.
2. Add the env vars from `.env.example` in **Project → Settings →
   Environment Variables** (set `AUTH_SECRET`, Google credentials,
   `TESTINY_API_KEY`, and the role email lists).
3. Add the production redirect URI to the Google OAuth client.
4. Deploy. Role changes later only require editing the env vars — they are
   read on every request, so no redeploy or re-login is needed.

### QA Roadmap (Linear × Testiny)

The Roadmap pulls every Linear ticket labeled with `QA_ROADMAP_LABELS`
(default: *Medium to Big Size Features*, *Quick wins*), groups them by
their release project ("3.32 Release", …), and checks each against
Testiny: a ticket **has test cases** when a Testiny folder whose title
mentions its id (e.g. "Cov-2230") contains test cases in its subtree.
Filter between covered and uncovered tickets to see where test design
is still needed. Requires `LINEAR_API_KEY` (Linear → Settings →
Security & access → Personal API keys); until set, a bundled workspace
snapshot is shown — coverage is checked live against Testiny either way.

## Maintaining the content

| What | Where |
| --- | --- |
| Effort allocation initiatives (Home / Automation) | [src/content/initiatives.ts](src/content/initiatives.ts) |
| Roadmap labels | `QA_ROADMAP_LABELS` env var |
| Sidebar sections & page access levels | [src/config/navigation.ts](src/config/navigation.ts) |
| Who is admin / QA team | `QA_ADMIN_EMAILS` / `QA_TEAM_EMAILS` env vars |
| Testiny project to read | `TESTINY_PROJECT_ID` env var |

Each initiative declares `effort: { manual, automation }` (sums to 100).
The Home page aggregates the split across active initiatives; the
Automation page lists everything with an automation share.

## Adding automation results (phase 2)

Implement `AutomationProvider` in
[src/lib/automation/provider.ts](src/lib/automation/provider.ts) against
your CI results source (Playwright JSON report, GitHub Actions artifact,
or an endpoint your pipeline pushes to) and swap it into
`getAutomationStatus()`. The Automation page renders suite pass rates and
durations as soon as `available: true` — no UI changes required.

## Architecture notes

- `src/lib/env.ts` — single validated entry point for environment config
- `src/lib/env.ts` aside, `src/lib/viewer.ts` answers "who is looking"
  and `requireAccess` is the server-side gate every page uses
- `src/lib/access/members.ts` — the whole permission model: domain check,
  env role lists, sign-in notification. There is no storage layer
- `src/lib/email.ts` — Resend sender with console fallback
- `src/auth.config.ts` (edge-safe) + `src/auth.ts` (node, sign-in
  notification); `src/proxy.ts` is the first gate for all routes
- `src/components/ui/` — the component library every page composes from.
  One `FilterGroup` serves every filter in the app, taking single/multi
  mode, counts, colour dots and what an empty selection means as props
- `src/lib/testiny/` — typed client (`client.ts`), aggregation queries
  (`queries.ts`, field names verified against the live API), graceful
  sample-data fallback (`sample-data.ts`)
- UI building blocks in `src/components/` are intentionally small and
  prop-driven; pages are server components that fetch and compose
