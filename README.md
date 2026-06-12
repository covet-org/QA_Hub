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
| Releases (Testiny runs) | `/releases` | viewer |
| Manual Testing (Testiny inventory) | `/manual` | qa |
| Automation (phase 2) | `/automation` | qa |
| Access (approvals, links, roles) | `/access` | admin |

Roles: `admin ⊃ qa ⊃ viewer`. Locked pages show a lock icon in the
sidebar and are enforced **server-side** (`requireAccess`), not just
hidden.

### Sign-in approval flow

Google SSO is restricted to the allowed domain, and on top of that every
account (except admins in `QA_ADMIN_EMAILS`) must be **approved**:

1. Someone signs in → an access request is stored and an email goes to
   `NOTIFY_EMAIL` with one-click **Approve as Viewer / Approve as QA /
   Deny** links (re-sent at most once per hour while pending).
2. Until approved, the user only sees the "Waiting for approval" screen.
3. Admins can also decide (and later revoke/re-approve, or change roles)
   on the **/access** page. Decisions apply immediately — no redeploy.

### Share links (guest access)

Admins create links on **/access**, choosing exactly which sections each
link unlocks (admin pages are never shareable) and an optional expiry.
Anyone opening `/share/<id>` browses those sections as a guest — no
Google account needed. Revoking a link locks out existing visitors
immediately, because every request re-validates the link server-side.

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
   tier) to send the approval emails. Without it, the emails are logged
   to the server console instead.
5. `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — **required in
   production** (stores access requests and share links). Provision
   Upstash Redis from the Vercel Marketplace; locally a `.data/store.json`
   file is used automatically.
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
- `src/lib/viewer.ts` — unified viewer model (member or link guest) and
  the `requireAccess` server-side gate every page uses
- `src/lib/access/` — approval requests (`requests.ts`), share links
  (`links.ts`), HMAC-signed tokens for email links & guest cookies
  (`token.ts`)
- `src/lib/store.ts` — tiny KV abstraction: Upstash Redis in production,
  local JSON file in dev
- `src/lib/email.ts` — Resend sender with console fallback
- `src/auth.config.ts` (edge-safe) + `src/auth.ts` (node, approval side
  effects); `src/proxy.ts` is the first gate for all routes
- `src/lib/testiny/` — typed client (`client.ts`), aggregation queries
  (`queries.ts`, field names verified against the live API), graceful
  sample-data fallback (`sample-data.ts`)
- UI building blocks in `src/components/` are intentionally small and
  prop-driven; pages are server components that fetch and compose
