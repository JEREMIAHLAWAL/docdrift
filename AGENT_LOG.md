# AGENT_LOG

How DocDrift was built: what the AI agent did, what Jeremiah changed or
corrected, and what Jeremiah personally verified. Entries are only moved into
"Jeremiah verified" after he confirms them.

Times are ET.

---

## Session 1 — Mon 2026-11-23, ~6:55–7:20 p.m.

### Agent did

- **Read the brief** (`project idea.md` / `IDEA.md`) and the DeepSpace docs:
  `llms.txt`, the agent skill, installation, quickstart, source control,
  external APIs, server actions, authentication, permissions, and data storage.
- **Preflight (read-only, free):**
  - Node v22.23.2, npm 12.0.2 and DeepSpace CLI 0.44.2, all within the
    supported range.
  - `npx deepspace auth whoami --json` returned `not_authenticated`.
  - `gh` is not installed.
  - `github.com/JEREMIAHLAWAL/docdrift` returned 404 (does not exist yet).
- **Pinned the legacy source.** Used the public GitHub commits API (free, not
  the managed integration) to find the last commit touching
  `content/docs/reference-react-dom.md`: `b4f72e1ef00a346b519f0649ae36942bcde93120`
  (2023-03-18).
- **Read the integration catalog (free):**
  - `github/get-repository-contents`: $0.0026 per request, no output schema.
  - `firecrawl/scrape`: actual cost, output `{data, creditsUsed, costUsd}`.
  - `cloudflare/jev`: per input token; `choice` answers return
    `{choice, probabilities, confidence}`.
  - These are catalog schemas, not executed calls.
- **Scaffolded** with `npm create deepspace@latest docdrift -- --with-skill`
  into `C:\Users\2880441\dev\docdrift`, which is not Syncthing-synced. The
  synced project folder would otherwise propagate `node_modules` and the
  owner-JWT `.dev.vars`. Renamed the unborn branch `master` to `main`.
  - Not yet done: app registration, commit, remote, deploy.
- **Core logic (`src/core/`):**
  - Fixed one-case config.
  - Deterministic excerpt extraction for both sources.
  - Jev request builder and response validator.
  - Refresh pipeline with an injectable integration caller; it stops at the
    first failure so later paid calls are skipped.
  - Owner, billing-confirmation and cooldown gate.
  - Review validation.
  - Freshness / stale-review view logic.
- **Schemas:** `evidence_snapshots`, `refresh_attempts` and `reviews` are
  readable by everyone, including signed-out visitors (`'*'`). No client role
  can write; only server actions write.
- **Server actions:**
  - `refreshEvidence` is owner-only (fails closed when `OWNER_USER_ID` is
    missing), requires `confirmBilling: true`, has a 60 s cooldown that also
    covers in-flight runs, and saves the snapshot and attempt together. On
    failure it records the attempt and leaves the old snapshot untouched.
  - `saveReview` is owner-only, validates its input and requires an existing
    snapshot. It upserts the single current review.
- **Security fix in scaffold code.** `/api/integrations/:name/:endpoint`
  forwarded any developer-billed integration for any signed-in user, with any
  body. That would have let anyone who signs in spend the owner's credits,
  including arbitrary Firecrawl URLs. It now refuses developer-billed
  integrations unless they are marked `browser: true` (`src/integrations.ts`,
  `src/server/http-routes.ts`).
- **UI (`/home`):**
  - Two dated, source-linked excerpt cards.
  - The model suggestion with its probabilities, labelled as a suggestion.
  - A separate keep / revise / needs-review decision. Owner saves; everyone
    else gets a labelled "Preview only, not saved".
  - An owner-only refresh with an explicit billing confirmation step.
  - Empty state, plus a failure banner that keeps the original snapshot date.
- **Tests:** 55 unit tests across 5 files pass (vitest). `tsc --noEmit` and
  `eslint src` are clean.
  - The scaffold's `vitest.config.ts` refuses to load until the app has a
    real `DEEPSPACE_APP_ID`, so these ran with a temporary config under
    `node_modules/.cache`.
  - The legacy extraction tests use the real pinned file.
  - The upgrade-guide fixture is **hand-written** in the shape Firecrawl is
    expected to return. It must be replaced by a real scrape before it counts
    as evidence.

### Blocked on Jeremiah

1. Choose where the repo lives (non-synced `dev/` folder recommended).
2. Create an empty public GitHub repo (`JEREMIAHLAWAL/docdrift` proposed).
3. Complete `npx deepspace auth login` (browser OAuth).
4. Approve a budget for paid calls.
5. Confirm the subdomain.

### Jeremiah changed or corrected

- *(none yet)*

### Jeremiah verified

- *(none yet)*

### Not yet verified by anyone

- Real output shape of all three provider calls.
- Hosted deploy.
- Hosted owner refresh.
- Hosted signed-out review.

---

## Session 1, continued — Mon 2026-11-23, ~11:30 p.m.

### Agent did

- At Jeremiah's instruction ("create it"), opened `github.com/new` in the
  Hermes preview pane and created the **public, empty** repo
  `JEREMIAHLAWAL/docdrift` (no README, .gitignore or license). The GitHub API
  confirmed `visibility: public`, `size: 0`, `default_branch: main`.
- Added `origin` before any registration or deploy, so the first deploy
  makes GitHub the app's source.
- Ran `npx deepspace auth login` in a PTY (it refuses a non-interactive
  shell) and opened the one-time login URL in the preview pane.
  `auth whoami` reports Jeremiah Lawal, a developer account.
- `npx deepspace app init --json` → registered
  `app_01M85XM7VVNC0GXMQVEC7AXT2V`. The CLI made the first commit (`1456955`,
  101 files, author Jeremiah Lawal <lawaltise@gmail.com>).
  - Checked the tracked files for secrets: no `.dev.vars`, `.env` or
    `node_modules`, and no token-shaped strings.
- Real checks with the registered ID:
  - `npm run build`: passed.
  - `npx vitest run`: 58/58 passed.
  - `npm run test` (Playwright smoke + API): 8/8 passed on the second run.
    The first run timed out after 60 s while the Vite dev server ran its
    cold dependency scan; only the cache state changed between runs.

### Jeremiah changed or corrected

- Completed the DeepSpace sign-in in the preview pane himself. The
  pane then showed "Session expired". That is expected once the CLI has
  claimed the one-time link; whoami confirmed the session.
- Approved the Git Credential Manager GitHub sign-in so `git push` could run.

### Agent did (deploy)

- Pushed `1456955` and `c002c57` to `origin/main`.
- First deploy, `npx deepspace deploy --json`:
  - `ok: true`, `url: https://docdrift.app.space`.
  - `serving` and `dataPlane` both `confirmed`.
  - Release `rel_01M85Y81PRR7N8AT6WXDAQ0YTB`.
  - `source: {provider: github, repository: jeremiahlawal/docdrift}`, so
    GitHub is now the app's source.
  - The JSON also said `"dirty": true`. My own stderr capture file
    (`deploy.err.log`) was in the working tree during the deploy; it was
    deleted right after. It isn't a source file and isn't in the 17 uploaded
    assets. Later deploys run from a clean tree.
- Hosted checks with curl:
  - `/` and `/home` return 200.
  - The landing `<title>` is "docdrift | Legacy docs vs React 19 evidence".
  - A signed-out `POST /api/integrations/firecrawl/scrape` returns 403
    "This integration is only available through server actions", confirming
    the proxy lock is deployed.
  - A signed-out `POST /api/actions/refreshEvidence` returns `Unauthorized`.
- Clean signed-out browser (a separate browser session with no cookies):
  `/home` renders the case header and the empty state ("No evidence has been
  captured yet…"). The RecordRoom anonymous read works; no error banner.
- The preview-pane page bridge stopped answering
  during this check, so the clean-browser check ran in the separate session.

### Jeremiah verified

- *(none yet)*

### Not yet verified by anyone

- Real provider output for `github/get-repository-contents`,
  `firecrawl/scrape` and `cloudflare/jev`. Paid calls are waiting for
  Jeremiah's budget approval.
- Hosted owner refresh and save.
- Hosted signed-out view of a real snapshot.
