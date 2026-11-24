import { describe, expect, it } from 'vitest'
import { deriveFreshness, reviewIsStale, type AttemptRow } from './view'

const snap = { capturedAt: '2026-11-24T20:00:00.000Z' }
const at = (attemptedAt: string, status: AttemptRow['status']): AttemptRow => ({ attemptedAt, status, stage: 'target', error: 'boom' })

describe('deriveFreshness', () => {
  it('is empty with no snapshot and no attempts', () => {
    expect(deriveFreshness(null, null)).toEqual({ kind: 'empty' })
  })

  it('reports a failed first refresh without inventing a result', () => {
    expect(deriveFreshness(null, at('2026-11-24T20:00:00Z', 'failed')).kind).toBe('empty-failed')
  })

  it('keeps the original snapshot date when a later refresh fails', () => {
    const out = deriveFreshness(snap, at('2026-11-24T21:00:00Z', 'failed'))
    expect(out).toMatchObject({ kind: 'failed-after', capturedAt: snap.capturedAt })
  })

  it('ignores a failure older than the snapshot', () => {
    expect(deriveFreshness(snap, at('2026-11-24T19:00:00Z', 'failed'))).toEqual({ kind: 'current', capturedAt: snap.capturedAt })
  })

  it('shows a running refresh', () => {
    expect(deriveFreshness(snap, at('2026-11-24T21:00:00Z', 'running')).kind).toBe('running')
  })
})

describe('reviewIsStale', () => {
  it('flags a review saved against a different snapshot', () => {
    expect(reviewIsStale({ snapshotId: 'a' }, 'b')).toBe(true)
    expect(reviewIsStale({ snapshotId: 'a' }, 'a')).toBe(false)
    expect(reviewIsStale(null, 'a')).toBe(false)
  })
})
