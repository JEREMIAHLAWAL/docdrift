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
- **Decisions (11:50 p.m.):**
  - Approved a **$0.50 cap** for paid provider calls across the whole build
    (probes, owner refreshes, hosted verification). Spent so far: $0.
  - Agreed to stop for the night and do the provider probes in the
    Tue 2–3:15 p.m. slot.

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

---

## Session 2 — Tue 2026-11-24, from ~10:15 a.m.

### Agent did (real provider probes, within the $0.50 cap)

- The CLI session was still valid (`auth whoami` ok), so no re-login was
  needed for the probes. Starting usage: 0.0022836 credits used. DeepSpace
  credits are 1¢ units: 0.26 credits = the $0.0026 GitHub charge.
- **`github/get-repository-contents`** (pinned legacy file): ok. The `data`
  is a standard contents-API file object (`type: file`, `encoding: base64`,
  `sha`, `size: 10600`). The decoded bytes are identical to
  `fixtures/legacy-reference-react-dom.md`, and the git blob SHA recomputes
  to the returned `sha`. `decodeGithubFile` needed no change. $0.0026.
- **`firecrawl/scrape`**: **failed upstream.** It returned a
  `upstream_provider_error`, wrapping Firecrawl `402 insufficient_credits`
  ("your team has 0 left"). That is DeepSpace's shared Firecrawl account,
  not ours. `billing: released`: a **$0.65 hold** was charged, then settled
  back to $0. A single scrape's hold is larger than the whole $0.50 cap. The
  response also warned that the platform still calls Firecrawl `/v1/scrape`
  (deprecated).
- **`cloudflare/jev`**: ok. The request was built with `buildJevRequest`
  from the real legacy excerpt plus the then-provisional target fixture
  (shape probe only). It returned `{model: "jev-1.13.0", answers:
  {relationship: {type: "choice", choice: "conflicts", probabilities:
  {agrees: 0.08, conflicts: 0.92, inconclusive: 0}, confidence: 0.88}},
  usage: {input_tokens: 769, ...}}`. `parseJevResponse` accepts it
  unchanged. $0.000044.
- **Spend after the probes: $0.00264 of $0.50.**

### Jeremiah decided

- Firecrawl was blocked upstream. Jeremiah chose to fetch the React 19
  Upgrade Guide's **markdown source** from `reactjs/react.dev` through the
  already-verified GitHub integration. It tracks `main` and records the blob
  SHA. Firecrawl is dropped, and the README will say why.

### Agent did (switch target source)

- `case.ts`: `TARGET` now holds the owner, repo, path and ref (`main`) of
  `src/content/blog/2024/04/25/react-19-upgrade-guide.md`. The card still
  links to the rendered react.dev page anchor.
- `extract.ts`:
  - `decodeGithubFile` takes a stage, so target failures are reported as
    `target`, not `legacy`.
  - `extractTargetRender` strips MDX heading IDs (`{/*…*/}`) and drops
    whole-line MDX component tags such as `<Note>`, but not inside code
    fences.
  - `readFirecrawlMarkdown` is removed.
- `refresh.ts`: the pipeline is now GitHub (legacy) → GitHub (target) →
  Jev, still stopping at the first failure. Snapshots gain `targetRef` and
  `targetBlobSha`. The schema columns are added at the end (additive; the
  SDK auto-migrates them; no snapshot rows exist yet).
- **Fixture replaced:** `fixtures/upgrade-guide.md` is now lines 355–440 of
  the real react.dev source at commit `d4b82435…`, copied verbatim. It is no
  longer hand-written. Today's `main` is byte-identical to that commit
  (checked via raw.githubusercontent, free).
- UI copy: "Scraped" became "Fetched … from react.dev main, blob …", and the
  refresh text's cost estimate is now about $0.006 per refresh.
- Tests were updated for the two-GitHub-call pipeline: fakes are routed by
  repo, and there are new tests for target-stage errors, MDX stripping and
  the code-fence guard.
- **Checks:**
  - `vitest`: 58/58 passed. Four Firecrawl tests were removed and four new
    ones added.
  - `tsc --noEmit`: clean.
  - `eslint src`: clean.
  - `npm run build`: passed.
  - `npm run test`: 8/8 on the second run. The first run hit the known
    60 s cold-start timeout.

### Jeremiah verified

- *(none yet)*

### Not yet verified by anyone

- That `github/get-repository-contents` accepts `ref: "main"` for react.dev
  through the hosted proxy. This first runs in the hosted owner refresh.
- Hosted owner refresh and save; that `probabilities` round-trips through
  the `json` column.
- Hosted signed-out view of a real snapshot.

---

## Session 3 — Tue 2026-11-24, Calc II pivot kickoff

### Agent did

- Read the approved direction in the private handoff and confirmed a clean
  `main` at `b5382a6` before any changes. Reusing the existing app.
- Proposed an original direct harmonic-series question (A) and a question
  requiring students to explain the zero-term-limit error via a block bound
  (B). Walked through objective fit, evidence of reasoning, permitted tool
  contribution, and effort versus assessment value under both policies. A
  full-credit answer to B needs both the logical distinction and the bound.
- **LaTeX compiler gate passed.** Checked live usage first. Installed CLI
  `0.44.2` catalog listed `latex-compiler/compile` at $0.0065 per request.
  Made one paid call with `{compiler: "pdflatex", document: ...}` and no real
  exam material. It returned `data.compiled: true`, `data.contentType:
  "application/pdf"`, and `data.pdfBase64`. Strictly decoded 109,001 bytes,
  checked the PDF signature and trailer, extracted the sample text, and
  rendered the single PDF page. This was a CLI probe, not a saved review or
  a hosted export. Probe files stayed out of Git. No Firecrawl retry.
- Re-read DeepSpace usage: exactly one compiler call at $0.0065. Itemized
  provider usage across the build is $0.00914408677; total account usage is
  $0.00917200477 including the pre-project baseline, under the $0.50 cap.
- Added the versioned Calc II sample, a shared renderer for the question and
  rubric, and a LaTeX request builder. The layout, title, and landing now
  show the Calc II draft locally. Verified `/home` signed out in the Hermes
  preview, including expanding the rubric and reading each row. Type-check,
  all 62 unit tests, lint, and production build passed. The first Playwright
  run timed out during server startup; the second was stopped at Jeremiah’s
  request. Neither counts as a browser suite pass.
- The approved version compiled on one retry after a billed D1 overload.
  Decoded, rendered, and checked the one-page PDF with the 6 total and 2/3/1
  labels. The recommendation is explicitly an example, not an in-app export.
  Usage after the retry: $0.02214408677 itemized, $0.02217200477 account total
  including baseline. No deploy. Policy comparison, owner save/export, and
  live Calc II GitHub/Jev remain open.

### Jeremiah changed or corrected

- Approved the revised Question B in `HANDOFF.md`: give the grouping, ask
  students to explain it, and show the 6-point total and 2/3/1 split.

### Jeremiah verified

- Confirmed in the local preview that Question B(b) and its rubric ask
  students to justify the bound, not invent the grouping.
- Signed in as owner and saw the TA recommendation panel; confirmed the
  saved `Assign B` and reason survived reload, then opened the downloaded
  PDF and confirmed it contained the saved recommendation and reason.
  These are local checks. Hosted behavior has not been verified.

### Policy preview increment

- Added a signed-out tool-policy switch with a local, hand-authored analysis.
  The calculator exam suggests Assign B; the AI-allowed take-home suggests
  Revise B if assessing individual reasoning. The comparison explains what
  each question assesses, what tools can do, and the effort tradeoff.
- The new Playwright test failed before the UI was added and passed after.
  All 10 smoke/API tests passed using the running local dev server via an
  ignored Playwright config (the standard webServer bootstrap timed out).
  The policy test switched both ways and observed no action or integration
  requests. No paid calls or deploy in this increment. Jev and owner save/PDF
  export are not wired into this view yet.

### Owner save/export increment

- Wired private per-policy recommendations into the existing action and record
  layers. Save reads back the stored reason. Export compiles that stored
  recommendation rather than the draft, requires owner identity and explicit
  billing confirmation, records an attempt before invoking the compiler, and
  waits one minute between attempts. No caller-supplied LaTeX goes to the compiler.
- Seven new action tests passed (provider double); 69 total unit tests, 11
  Playwright smoke/API checks, type-check, lint, and build passed. Signed-out
  action requests returned 401 and the compiler proxy returned 403.
- Jeremiah confirmed that the saved `Assign B` and reason reappeared after
  reloading. Read back both fields in the signed-in preview. Triggered one
  local browser export; the app displayed `PDF generated from your saved
  recommendation.` and live usage confirmed one $0.0065 compiler charge
  ($0.02868681077 total account usage including baseline, below $0.50).
  Jeremiah opened the downloaded PDF and confirmed it contained the saved
  recommendation and reason. This verifies the local browser flow, not a
  hosted export. No deploy.
  Jeremiah prioritized the working hosted flow over polishing demo
  explanations; policy copy was not separately signed off.

### Calc II Jev probe

- Ran the live Jev CLI call using the approved versioned sample, take-home
  policy, and `buildCalc2JevRequest`. Validated the response: `revise_b`,
  model `jev-1.13.0`. Live account spend increased by $0.00005027841 to
  $0.02873708918, below the $0.50 cap. This is one policy in a CLI probe,
  not a live comparison in the app. GitHub sample fetch needs the versioned
  file published on the existing repo. Neither integration is wired yet.

## Session 4 — Tue 2026-11-24, from ~2:15 p.m.

### Agent did (publish sample, wire GitHub + Jev)

- Committed the Calc II pivot as `60c2689` and pushed it to `origin/main`.
  That published `src/core/calc2-demo.v1.json` (blob `88f3771`). Before any
  paid call, confirmed for free that the raw file at that commit hashes to
  the same blob.
- Added an owner-only comparison action pair: `getCalc2Analysis` and
  `analyzeCalc2`. `analyzeCalc2` requires `confirmBilling: true`, records a
  `running` attempt before spending, and waits one minute between attempts.
  It fetches the sample through `github/get-repository-contents`, pinned to
  commit `60c2689`. It rejects a different blob or content that differs from
  the sample the UI renders, then stops before Jev. Otherwise it sends the
  fetched sample and the selected policy to `cloudflare/jev`. The result is
  validated, saved per policy, and read back before it is shown. The
  comparison panel is separate from the TA save/export panel, so a failed
  model call can't block saving or exporting.
- 10 new unit tests use a provider double; 79 unit tests passed in total.
  Type-check, lint, and build passed. All 11 Playwright smoke/API checks
  passed against the running local server. Signed-out calls to the two new
  actions returned 401. The GitHub and Jev integration proxies returned 403.
  The signed-out policy switch still sends no action or integration requests.

### Jeremiah verified

- Local signed-in preview, AI-allowed take-home policy: ran one Jev
  comparison. The app showed `Revise B · jev-1.13.0`, sample
  `calc2-harmonic-v1` fetched from GitHub at commit `60c2689`
  (blob `88f3771`), and the result persisted after reload. Live usage
  showed one GitHub charge ($0.0026) and one Jev charge (~$0.00005).
  Total account usage is now $0.03138736759, below the $0.50 cap. This is
  the local app, not yet the hosted URL.

