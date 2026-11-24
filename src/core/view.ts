/**
 * What the page should say about freshness, derived only from stored rows.
 * Pure so the empty / failed / stale-review states are unit-tested.
 */

export interface AttemptRow {
  attemptedAt: string
  status: 'running' | 'succeeded' | 'failed'
  stage?: string
  error?: string
  snapshotId?: string
}

export type Freshness =
  | { kind: 'empty' }
  | { kind: 'empty-failed'; attempt: AttemptRow }
  | { kind: 'current'; capturedAt: string }
  | { kind: 'failed-after'; capturedAt: string; attempt: AttemptRow }
  | { kind: 'running'; capturedAt: string | null }

/** A failure counts only if it happened after the snapshot being shown. */
export function deriveFreshness(snapshot: { capturedAt: string } | null, latest: AttemptRow | null): Freshness {
  const newer = (a: AttemptRow) => !snapshot || Date.parse(a.attemptedAt) > Date.parse(snapshot.capturedAt)
  if (latest?.status === 'running' && newer(latest)) return { kind: 'running', capturedAt: snapshot?.capturedAt ?? null }
  if (!snapshot) return latest?.status === 'failed' ? { kind: 'empty-failed', attempt: latest } : { kind: 'empty' }
  if (latest?.status === 'failed' && newer(latest)) {
    return { kind: 'failed-after', capturedAt: snapshot.capturedAt, attempt: latest }
  }
  return { kind: 'current', capturedAt: snapshot.capturedAt }
}

/** True when the saved review was made against an older snapshot than the one shown. */
export function reviewIsStale(review: { snapshotId: string } | null, shownSnapshotId: string | null): boolean {
  return !!review && !!shownSnapshotId && review.snapshotId !== shownSnapshotId
}
