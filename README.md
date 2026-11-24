# Exam Question Review

**Live demo:** https://docdrift.app.space/home · **Source:** this repo (`docdrift`, the URL and repo keep the original project name)

A Calc II teaching assistant has two candidate questions and one learning
objective. This app helps them decide whether the harder question is worth
assigning, given the tools students may use:

- **Calculator-allowed exam:** in person, with a non-CAS calculator and no AI.
- **AI-allowed take-home.**

For each policy it shows:

- what each question asks students to understand
- what the allowed tool can do for them
- whether the extra answering and grading effort is justified

The TA makes and saves the final recommendation; the app never does. It does
not claim a question is AI-proof or that an answer proves independent
understanding.

The demo is one original case. **Question A** asks directly whether the
harmonic series converges. **Question B** (6 points, split 2/3/1) gives a
student's claim that the series converges because 1/n → 0 and supplies the
grouping strategy. Students must explain the flaw, justify the ½ bound on
each block, and say what that implies about the partial sums. Neither
question comes from a real exam.

## What you can do

| Who | What | Cost |
|---|---|---|
| Anyone (signed out) | Read both questions and the B rubric. Switch the tool policy: the hand-authored suggestion changes from **Assign B** (calculator exam) to **Revise B** (AI take-home), with the reasoning. | Free. The switch sends no action or integration request. |
| App owner (signed in) | **Run Jev comparison**: fetches the versioned sample from GitHub at a pinned commit, then asks Jev which recommendation fits the selected policy. The result is saved per policy and labeled as a model suggestion. | One GitHub call ($0.0026) plus one Jev call (~$0.00005) |
| App owner | Save a recommendation (Assign A/B, Revise A/B, Assign neither) with a required reason, separately for each policy. | Free |
| App owner | **Export saved PDF**: the server compiles the *stored* recommendation through LaTeX and the browser downloads it. Unsaved edits are not exported. | One LaTeX compile ($0.0065) |

## Architecture

DeepSpace app: React/Vite UI, a Cloudflare Worker, platform auth, and
SQLite-backed RecordRooms.

- `src/core/calc2-demo.v1.json`: the **single versioned source** for the
  objective, both questions, the B point split and the rubric. The UI, the
  Jev request and the PDF are all built from it.
- `src/core/calc2-content.ts`: the policy texts, the hand-authored preview
  analysis, and the LaTeX document builder, which escapes all user text.
- `src/core/calc2-analysis.ts`: `runCalc2Analysis`, the GitHub fetch and Jev
  comparison, with the integration caller injected so tests make no paid
  calls.
- `src/core/calc2-jev.ts`: builds the typed Jev request and validates the
  response against `assign_a | assign_b | revise_b | inconclusive`.
- `src/actions/calc2-actions.ts`: thin, owner-gated server actions
  `getCalc2Review`, `saveCalc2Review`, `exportCalc2Review`,
  `getCalc2Analysis` and `analyzeCalc2`.
- `src/components/Calc2*.tsx`: the question view, the signed-out policy
  review, and the owner-only comparison and recommendation panels. The
  comparison panel is separate from save/export, so a failed model call
  can't block either.

### Managed integrations

| Integration | Job | Status |
|---|---|---|
| `github/get-repository-contents` | Fetches `calc2-demo.v1.json` from this public repo at commit `60c2689`. The server requires blob `88f3771` and content identical to the sample the UI renders, so Jev judges exactly what the TA sees. On a mismatch it stops before calling Jev. | Verified locally and on the live site |
| `cloudflare/jev` | Gets a typed recommendation for the fetched sample under the selected policy. Out-of-set answers are rejected. | Verified locally (`revise_b`, `jev-1.13.0`, AI take-home) and on the live site |
| `latex-compiler/compile` | Compiles the saved recommendation into a PDF. No caller-supplied LaTeX reaches the compiler. | Verified on the live site |

### Billing and access guards

- Every paid action is owner-only and **fails closed** when the owner ID is
  missing.
- Each paid action requires an explicit `confirmBilling: true`, matched by a
  confirm checkbox in the UI.
- Each paid action records a `running` attempt before spending and waits one
  minute between attempts.
- The analysis stops at the first failed stage, so a failed fetch never
  triggers a Jev call.
- The scaffold's browser integration proxy is closed. `/api/integrations/*`
  refuses developer-billed integrations unless they are explicitly marked
  for browser use, so a signed-in visitor can't spend the owner's credits.
- Recommendation, comparison and attempt collections deny all direct client
  reads and writes. Only the owner-gated actions can access them.

## Verification

Results as of Nov 24, 2026. "Jeremiah verified" means the author checked it
himself; details are in [`AGENT_LOG.md`](AGENT_LOG.md).

| Check | Result |
|---|---|
| Type-check, lint, build | Pass |
| Unit tests (vitest, provider doubles) | 79 pass |
| Playwright smoke/API tests against the live site | 11 pass: the signed-out policy switch sends no action or integration request, the 5 actions return 401 when signed out, and the 3 integration proxies return 403 |
| Live site, signed out: policy switch changes the suggestion, nothing saved or billed | Jeremiah verified |
| Live site, signed in: save → reload → export → open the downloaded PDF, which contains the saved recommendation | Jeremiah verified |
| Local app, signed in: GitHub fetch + Jev comparison shows `Revise B`, fetched at commit `60c2689`, and persists after reload | Jeremiah verified |
| Live site, signed in: GitHub fetch + Jev comparison | Jeremiah verified (one run; logs and usage show one GitHub and one Jev charge) |

Total account usage, including the pre-project baseline and the React
prototype probes, is **$0.0406**, under the $0.50 budget.

## Scope decisions

- **No uploads or question bank.** One original case is enough to show the
  decision; arbitrary questions would need moderation and evaluation work
  this deadline can't cover.
- **Hand-authored signed-out analysis.** Visitors get a meaningful, free
  policy comparison. The live model result is owner-only and labeled
  separately, so preview text is never presented as model output.
- **No Exa or other search.** The content is known and versioned; search
  would add ranking uncertainty and metered calls.
- **No general text generation.** The model's job is a constrained choice,
  not prose. A typed Jev answer is easier to validate.
- **No R2 or cron.** Small text records fit in RecordRooms, and comparisons
  run only on demand.
- **No custom auth or database.** Platform auth and RecordRooms cover owner
  access and persistence.

## Known gaps and history

- **Prototype code still in the repo:** this repo started as **DocDrift**, a
  React-documentation drift checker. Its owner-only `refreshEvidence` and
  `saveReview` actions and `src/core/{case,extract,classify,refresh,view}.ts`
  are still in the repo. The current UI doesn't use them; they're kept for
  the history in `AGENT_LOG.md`.
- **Firecrawl:** the platform's shared Firecrawl account was out of credits
  (`402 insufficient_credits`) during the React prototype, and it was not
  retried. The Calc II app doesn't use it.
- **Signed-out analysis is static.** It is hand-authored for the two
  policies; there is no model call in the free preview.
- **Single owner.** Recommendations are private to the app owner, one per
  policy. There are no team accounts.
- **Next steps:** let the TA choose
  among saved model results; support additional original question pairs from
  versioned files.

## Run locally

Requires Node 22.15+/24/26 and npm 11.6+.

```bash
npm install
npx deepspace login     # once
npm run dev             # deepspace dev start
npm run validate        # tsc + vitest
npm run lint && npm run build
npm run test            # Playwright smoke/API (starts its own server)
```

`.dev.vars` holds a local owner token and is git-ignored. Deploy with
`npx deepspace deploy` from a clean tree.
