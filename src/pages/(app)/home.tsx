/**
 * The DocDrift case page (public route /home).
 *
 * Signed-out visitors read the latest stored snapshot and can try the decision
 * controls as an unsaved local preview. Only the owner sees the billed refresh
 * and the Save button; the server actions enforce that again regardless of UI.
 */

import { useState } from 'react'
import { getAuthToken, useAuthProfileReady, useQuery } from 'deepspace'
import { Button } from '@/components/ui'
import { CASE_ID, CASE_QUESTION, DECISIONS, RELATIONSHIPS, type Decision, type Relationship } from '../../core/case'
import type { SnapshotData } from '../../core/refresh'
import { deriveFreshness, reviewIsStale, type AttemptRow } from '../../core/view'

interface ReviewRow {
  snapshotId: string
  decision: Decision
  note?: string
  decidedAt: string
}

const DECISION_LABEL: Record<Decision, string> = { keep: 'Keep', revise: 'Revise', needs_review: 'Needs review' }
const fmt = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })

async function callAction(name: string, body: Record<string, unknown>) {
  const token = await getAuthToken()
  if (!token) return { success: false as const, error: 'Sign in first.' }
  const res = await fetch(`/api/actions/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null
  if (!res.ok || !json?.success) return { success: false as const, error: json?.error ?? `HTTP ${res.status}` }
  return { success: true as const }
}

export default function CasePage() {
  const { isSignedIn, user } = useAuthProfileReady({ requireUser: true })
  // The owner is pinned to admin in the RecordRoom. UI hint only: the
  // actions check OWNER_USER_ID server-side.
  const isOwner = isSignedIn && user?.role === 'admin'

  const snapshots = useQuery<SnapshotData>('evidence_snapshots', { where: { caseId: CASE_ID }, orderBy: 'capturedAt', orderDir: 'desc', limit: 1 })
  const attempts = useQuery<AttemptRow>('refresh_attempts', { where: { caseId: CASE_ID }, orderBy: 'attemptedAt', orderDir: 'desc', limit: 1 })
  const reviews = useQuery<ReviewRow>('reviews', { where: { caseId: CASE_ID }, limit: 1 })

  const loading = [snapshots, attempts, reviews].some((q) => q.status === 'loading')
  const loadError = [snapshots, attempts, reviews].find((q) => q.status === 'error')?.error

  const snapshotRow = snapshots.records[0] ?? null
  const snapshot = snapshotRow?.data ?? null
  const freshness = deriveFreshness(snapshot, attempts.records[0]?.data ?? null)
  const review = reviews.records[0]?.data ?? null

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 text-foreground">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">DocDrift · one case</p>
        <h1 className="text-2xl font-semibold">
          Can I still use <code>ReactDOM.render</code> in React 19?
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          A pinned legacy instruction compared with the React 19 Upgrade Guide. React 19 is the explicit upgrade
          target here, not a claim that it is the latest React. A model suggests how the two excerpts relate; a
          person makes the decision.
        </p>
      </header>

      {loading && <p className="text-sm text-muted-foreground">Loading evidence…</p>}
      {loadError && <p role="alert" className="text-sm text-destructive">Could not load stored evidence: {loadError}</p>}

      {!loading && !loadError && (
        <>
          <FreshnessBanner freshness={freshness} />
          {isOwner && <OwnerRefresh running={freshness.kind === 'running'} />}
          {snapshot && snapshotRow ? (
            <>
              <section className="grid gap-4 md:grid-cols-2" aria-label="Evidence">
                <ExcerptCard title="Legacy instruction" label={snapshot.legacyLabel} url={snapshot.legacySourceUrl}
                  meta={`Pinned commit ${snapshot.legacyRef.slice(0, 12)}`} text={snapshot.legacyExcerpt} />
                <ExcerptCard title="React 19 guidance" label={snapshot.targetLabel} url={snapshot.targetSourceUrl}
                  meta={`Fetched ${fmt(snapshot.capturedAt)} from react.dev ${snapshot.targetRef || 'main'}${
                    snapshot.targetBlobSha ? `, blob ${snapshot.targetBlobSha.slice(0, 12)}` : ''}`}
                  text={snapshot.targetExcerpt} />
              </section>
              <Suggestion snapshot={snapshot} />
              <ReviewPanel isOwner={!!isOwner} snapshotId={snapshotRow.recordId} saved={review}
                stale={reviewIsStale(review, snapshotRow.recordId)} />
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              No evidence has been captured yet. The app owner has to run the first refresh; nothing here is
              generated until then.
            </div>
          )}
        </>
      )}
      <p className="text-xs text-muted-foreground">Question: {CASE_QUESTION.replace(/`/g, '')}</p>
    </div>
  )
}

function FreshnessBanner({ freshness }: { freshness: ReturnType<typeof deriveFreshness> }) {
  switch (freshness.kind) {
    case 'empty':
      return null
    case 'current':
      return <p className="text-sm text-muted-foreground">Evidence captured {fmt(freshness.capturedAt)} from live calls.</p>
    case 'running':
      return <p className="text-sm text-muted-foreground">A refresh is in progress…</p>
    case 'empty-failed':
    case 'failed-after':
      return (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p className="font-medium">
            The last refresh failed at {fmt(freshness.attempt.attemptedAt)} ({freshness.attempt.stage} step).
          </p>
          <p className="text-muted-foreground">{freshness.attempt.error}</p>
          {freshness.kind === 'failed-after' && (
            <p className="mt-1">Showing the last valid snapshot, captured {fmt(freshness.capturedAt)}.</p>
          )}
        </div>
      )
  }
}

function OwnerRefresh({ running }: { running: boolean }) {
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const run = async () => {
    setBusy(true)
    setMessage(null)
    const r = await callAction('refreshEvidence', { confirmBilling: true })
    setBusy(false)
    setConfirming(false)
    setMessage(r.success ? 'Refresh saved a new snapshot.' : `Refresh failed: ${r.error}`)
  }

  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border p-4" aria-label="Owner refresh">
      <p className="text-sm font-medium">Owner: refresh evidence</p>
      <p className="text-xs text-muted-foreground">
        Runs GitHub twice (pinned legacy file, upgrade guide source) and Cloudflare Jev. Billed to your DeepSpace
        credits, about $0.006 per refresh. Limited to one per minute.
      </p>
      {!confirming ? (
        <Button size="sm" variant="outline" className="self-start" disabled={busy || running} onClick={() => setConfirming(true)}>
          Refresh evidence…
        </Button>
      ) : (
        <div className="flex gap-2">
          <Button size="sm" loading={busy} disabled={busy} onClick={run}>Confirm billed refresh</Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>Cancel</Button>
        </div>
      )}
      {message && <p role="status" className="text-sm">{message}</p>}
    </section>
  )
}

function ExcerptCard(props: { title: string; label: string; url: string; meta: string; text: string }) {
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-border p-4">
      <h2 className="text-sm font-semibold">{props.title}</h2>
      <p className="text-xs text-muted-foreground">{props.label} · {props.meta}</p>
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded bg-muted p-3 text-xs leading-relaxed">{props.text}</pre>
      <a className="text-xs text-primary underline-offset-4 hover:underline" href={props.url} target="_blank" rel="noreferrer">
        Open source ↗
      </a>
    </article>
  )
}

function Suggestion({ snapshot }: { snapshot: SnapshotData }) {
  const probs = (typeof snapshot.probabilities === 'string'
    ? JSON.parse(snapshot.probabilities)
    : snapshot.probabilities) as Record<Relationship, number>
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border p-4" aria-label="Model suggestion">
      <p className="text-sm">
        Model suggestion: <strong data-testid="suggestion">{snapshot.suggestion}</strong>{' '}
        <span className="text-muted-foreground">(confidence {Math.round(snapshot.confidence * 100)}%, {snapshot.model})</span>
      </p>
      <ul className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {RELATIONSHIPS.map((r) => <li key={r}>{r}: {Math.round((probs?.[r] ?? 0) * 100)}%</li>)}
      </ul>
      <p className="text-xs text-muted-foreground">
        Based only on the two excerpts shown above. It is a suggestion, not the review decision.
      </p>
    </section>
  )
}

function ReviewPanel(props: { isOwner: boolean; snapshotId: string; saved: ReviewRow | null; stale: boolean }) {
  const [choice, setChoice] = useState<Decision | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const save = async () => {
    if (!choice) return
    setBusy(true)
    const r = await callAction('saveReview', { snapshotId: props.snapshotId, decision: choice, note })
    setBusy(false)
    setMessage(r.success ? 'Review saved against this snapshot.' : `Save failed: ${r.error}`)
  }

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4" aria-label="Review decision">
      <h2 className="text-sm font-semibold">Your decision about the legacy instruction</h2>
      {props.saved ? (
        <p className="text-sm">
          Saved review: <strong>{DECISION_LABEL[props.saved.decision]}</strong>, {fmt(props.saved.decidedAt)}
          {props.saved.note ? ` — “${props.saved.note}”` : ''}
          {props.stale && <span className="text-destructive"> (made against an earlier snapshot)</span>}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">No saved review yet.</p>
      )}
      <div role="radiogroup" className="flex flex-wrap gap-2">
        {DECISIONS.map((d) => (
          <Button key={d} size="sm" variant={choice === d ? 'default' : 'outline'} role="radio" aria-checked={choice === d}
            onClick={() => { setChoice(d); setMessage(null) }}>
            {DECISION_LABEL[d]}
          </Button>
        ))}
      </div>
      {props.isOwner ? (
        <>
          <textarea className="rounded border border-input bg-background p-2 text-sm" maxLength={500} rows={2}
            placeholder="Optional note" value={note} onChange={(e) => setNote(e.target.value)} />
          <Button size="sm" className="self-start" disabled={!choice || busy} loading={busy} onClick={save}>Save review</Button>
        </>
      ) : (
        choice && (
          <p role="status" className="text-sm text-muted-foreground">
            Preview only: you picked “{DECISION_LABEL[choice]}”. This is not saved; only the app owner can save a review.
          </p>
        )
      )}
      {message && <p role="status" className="text-sm">{message}</p>}
    </section>
  )
}
