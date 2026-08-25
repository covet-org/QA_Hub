# QA Brain — Handoff

Supersedes `QA-Hub-Claude-Handoff.pdf` (24 Aug 2026). That file lived outside the repo and
described a machine that no longer exists; this one lives beside the code so it can be updated in
the same commit as the change it describes.

**Last updated:** 24 Aug 2026, end of the working session described below.

- **Production:** https://qahub-ebon.vercel.app (Vercel project `qahub`, team `qa-2001`)
- **Repo:** https://github.com/clezama-QA/Co.Vet_QA — `main` auto-deploys on push
- **Owner / sole admin:** clezama@co.vet
- **For Claude sessions:** read `CLAUDE.md` first, it is the operational detail. This file is the
  state of play.

---

## 1. Who can get in

**The domain is the allowlist.** Any verified `@co.vet` Google account signs in and lands as `qa`,
which unlocks every section except the admin Access page. There is no approval step and no
database.

Three env vars are the entire permission model:

| Variable | Effect |
|---|---|
| `QA_ADMIN_EMAILS` | Full access including `/access` |
| `QA_VIEWER_EMAILS` | Demoted — no Manual Testing or Automation |
| `QA_BLOCKED_EMAILS` | Refused at sign-in; they land on `/no-access` |

Changing a role means editing the variable in Vercel and redeploying (about a minute). `/access` is
a read-only view of this policy.

**Why it works this way.** Access used to depend on an Upstash KV store. `kvGet`/`kvSet` throw when
it is unreachable, the Auth.js `signIn` callback awaited them without a catch, and Upstash had been
down — so the whole team hit `AccessDenied` on a dashboard that only reads Linear and Testiny. The
store was removed rather than replaced: configuration cannot have an outage.

**What went with it:** share links (`/share/<id>`), the approval flow, invites, and per-user role
edits in the UI. Only `@co.vet` accounts can reach QA Brain now; there is no guest access.

`NOTIFY_EMAIL` (defaults to clezama@co.vet) gets one mail per sign-in. Without a store there is no
way to know whether it is somebody's first, so it fires per session (30 days), fire-and-forget.

---

## 2. Where the data comes from

| Page | Source | Notes |
|---|---|---|
| Roadmap | Linear + Testiny | Labeled tickets, matched to Testiny folders by COV-id for coverage |
| Releases | Testiny | Run results; stories/bugs and descopes load on demand per card |
| Bugs / CS Bugs | Linear | Grouped by release project, active/closed derived from Testiny runs |
| Manual Testing | Testiny | Inventory by area/type/priority |
| Home | Linear + Testiny | Bug trends, effort split, testing time, cycle time |
| Automation | — | Placeholder; `AutomationProvider` is the extension point |

Both integrations degrade rather than fail: no API key → bundled sample data with a visible notice;
an API error → sample data plus a console warning. **Never let an integration outage 500 a page.**

**Linear is the source of truth for descoping** — a feature's own project moves. A Testiny run
description may also list descoped stories by hand; that note is deliberately not read, so
disagreements between the two are expected rather than bugs.

---

## 3. What changed in this session

Seventeen PRs, each merged to `main` and verified on production.

**Roadmap** — sub-issues nest under collapsible parent rows; Linear priority column beside the
ticket id; multi-select release and test-case filters with the selection in the URL.

**Releases** — full-width run panels; per-run dropdowns for failed/blocked/skipped cases (now with
Testiny assignees), release stories and bugs, and **descoped features**; release filter.

**Bugs** — Linear assignee per row; multi-select release filter replacing the three-way pills.

**Home** — the manual test-case count was removed (it paginated 4,600+ cases per load); **bugs
found per release** arrived as cumulative discovery curves with legend toggles, a 30-day default
window, hover focus and keyboard stepping.

**Access** — rewritten as described in §1.

**App-wide** — a visual refresh (wider shell, layered surfaces, tighter type scale) and then a
**component library** at `src/components/ui`, which replaced four filter implementations, six
collapsible sections, four chevrons, four empty states and the shell class string that had been
pasted into seven pages.

---

## 4. Open items

In the order worth doing them.

1. **Get a preview environment.** Every change this session went straight to production and was
   verified there. Three cosmetic bugs reached the team that way — truncated descope rows, a
   ragged Home row, and every bug showing "unassigned". Whitelisting one long-lived `preview`
   branch callback URL in Google Cloud Console would let changes be seen before `main`.
   **Highest-value fix outstanding, and it needs two clicks in Cloud Console that only an owner
   can make.**
2. **Commit the tests.** `roadmap-tree`, `descope-rules`, `bug-trend` and `smooth-path` are pure
   and were each covered by assertion scripts during development — but those scripts live in a
   scratch directory, not the repo. Port them to `node --test`.
3. **Rotate the API keys** shared in chat during setup: Testiny, Google client secret, Resend,
   Linear. Upstash is no longer used at all.
4. **Verify the Resend sender domain** (`co.vet`), so sign-in notifications reach addresses other
   than the Resend account owner.
5. **Fix the `release` URL param collision**: the roadmap writes group slugs (`3.36-release`),
   Releases writes bare versions (`3.36`). A filtered URL carried between them silently matches
   nothing.
6. **Manual Testing has no filters** — the only board without them; the library's `FilterGroup`
   makes this small once someone decides which facets matter.
7. **Automation page** is still a placeholder. The suite that would feed it is the
   `covet-qa-automation` repo.

## 5. Known limitations, stated plainly

- **Descope detection has a 180-day window** and the Linear query filters on `updatedAt`, so a
  feature parked in a squad project and untouched since then is not detected.
- **The bug trend chart caps at 7 releases** — the categorical palette has seven validated slots
  and an eighth would have to be invented.
- **Sign-in notifications fire per session, not per person** (see §1).
- **Role changes require a redeploy** (see §1). That is the accepted cost of having no database.
