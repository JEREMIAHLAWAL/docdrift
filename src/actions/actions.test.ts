import { describe, expect, it } from 'vitest'
import type { ActionResult, ActionTools } from 'deepspace/worker'
import legacyMarkdown from '../core/fixtures/legacy-reference-react-dom.md?raw'
import guideMarkdown from '../core/fixtures/upgrade-guide.md?raw'
import { TARGET } from '../core/case'
import { refreshEvidence, saveReview } from './index'

type Row = { recordId: string; data: Record<string, unknown> }

const b64 = (text: string) => {
  let binary = ''
  for (const b of new TextEncoder().encode(text)) binary += String.fromCharCode(b)
  return btoa(binary)
}

const okIntegrations: Record<string, unknown> = {
  'github/get-repository-contents': {
    success: true,
    data: { type: 'file', encoding: 'base64', content: b64(legacyMarkdown), sha: 'blob123' },
  },
  'firecrawl/scrape': {
    success: true,
    data: { data: { markdown: guideMarkdown, metadata: { statusCode: 200, sourceURL: TARGET.url } } },
  },
  'cloudflare/jev': {
    success: true,
    data: {
      model: '@cf/jev-test',
      answers: {
        relationship: {
          type: 'choice',
          choice: 'conflicts',
          probabilities: { agrees: 0.02, conflicts: 0.95, inconclusive: 0.03 },
          confidence: 0.9,
        },
      },
    },
  },
}

/** In-memory stand-in for the RecordRoom tools; records every integration call. */
function fakeTools(integrationResponses = okIntegrations) {
  const db: Record<string, Row[]> = { evidence_snapshots: [], refresh_attempts: [], reviews: [] }
  const calls: string[] = []
  let seq = 0
  const ok = <T,>(data: T): ActionResult<T> => ({ success: true, data })
  const tools = {
    async create(coll: string, data: Record<string, unknown>, recordId?: string) {
      const id = recordId ?? `${coll}_${++seq}`
      const existing = db[coll].find((r) => r.recordId === id)
      if (existing) Object.assign(existing.data, data)
      else db[coll].push({ recordId: id, data: { ...data } })
      return ok({ recordId: id })
    },
    async update(coll: string, id: string, patch: Record<string, unknown>) {
      const row = db[coll].find((r) => r.recordId === id)
      if (!row) return { success: false, error: 'not found' }
      Object.assign(row.data, patch)
      return ok({ recordId: id })
    },
    async get(coll: string, id: string) {
      const row = db[coll].find((r) => r.recordId === id)
      return row ? ok({ record: row }) : { success: false, error: 'not found' }
    },
    async query(coll: string) {
      const rows = [...db[coll]].sort((a, b) =>
        String(b.data.attemptedAt ?? '').localeCompare(String(a.data.attemptedAt ?? '')),
      )
      return ok({ records: rows.slice(0, 1), count: rows.length })
    },
    async integration(endpoint: string) {
      calls.push(endpoint)
      return integrationResponses[endpoint]
    },
  } as unknown as ActionTools
  return { tools, db, calls }
}

const OWNER = 'u_owner'
const env = { OWNER_USER_ID: OWNER }
const ctx = (tools: ActionTools, userId: string, params: Record<string, unknown>) =>
  ({ userId, params, tools, env, callerJwt: 'jwt' }) as Parameters<typeof refreshEvidence>[0]

describe('refreshEvidence action', () => {
  it('saves one snapshot and a succeeded attempt for the owner', async () => {
    const { tools, db, calls } = fakeTools()
    const res = await refreshEvidence(ctx(tools, OWNER, { confirmBilling: true }))
    expect(res).toMatchObject({ success: true, data: { suggestion: 'conflicts' } })
    expect(calls).toHaveLength(3)
    expect(db.evidence_snapshots).toHaveLength(1)
    expect(db.refresh_attempts[0].data).toMatchObject({ status: 'succeeded', snapshotId: db.evidence_snapshots[0].recordId })
  })

  it('refuses non-owners before any billed call or write', async () => {
    const { tools, db, calls } = fakeTools()
    const res = await refreshEvidence(ctx(tools, 'u_visitor', { confirmBilling: true }))
    expect(res.success).toBe(false)
    expect(calls).toHaveLength(0)
    expect(db.refresh_attempts).toHaveLength(0)
  })

  it('keeps the previous snapshot and records the failure when a provider fails', async () => {
    const { tools, db } = fakeTools()
    await refreshEvidence(ctx(tools, OWNER, { confirmBilling: true }))
    const before = structuredClone(db.evidence_snapshots)
    // Move the first attempt outside the cooldown, then break Firecrawl.
    db.refresh_attempts[0].data.attemptedAt = '2000-01-01T00:00:00.000Z'
    ;(tools as unknown as { integration: (e: string) => Promise<unknown> }).integration = async (e) =>
      e === 'firecrawl/scrape' ? { success: false, error: 'Upstream timeout', code: 'upstream_timeout' } : okIntegrations[e]

    const res = await refreshEvidence(ctx(tools, OWNER, { confirmBilling: true }))
    expect(res).toMatchObject({ success: false, error: expect.stringContaining('upstream_timeout') })
    expect(db.evidence_snapshots).toEqual(before)
    const failed = db.refresh_attempts.find((r) => r.data.status === 'failed')
    expect(failed?.data).toMatchObject({ stage: 'target', snapshotId: '' })
  })

  it('rate-limits an immediate second refresh', async () => {
    const { tools, calls } = fakeTools()
    await refreshEvidence(ctx(tools, OWNER, { confirmBilling: true }))
    const res = await refreshEvidence(ctx(tools, OWNER, { confirmBilling: true }))
    expect(res).toMatchObject({ success: false, error: expect.stringMatching(/rate-limited/) })
    expect(calls).toHaveLength(3)
  })
})

describe('saveReview action', () => {
  it('upserts the single current review against an existing snapshot', async () => {
    const { tools, db } = fakeTools()
    const refreshed = await refreshEvidence(ctx(tools, OWNER, { confirmBilling: true }))
    const snapshotId = (refreshed as { data: { snapshotId: string } }).data.snapshotId
    await saveReview(ctx(tools, OWNER, { snapshotId, decision: 'revise', note: 'use createRoot' }))
    await saveReview(ctx(tools, OWNER, { snapshotId, decision: 'needs_review' }))
    expect(db.reviews).toHaveLength(1)
    expect(db.reviews[0].data).toMatchObject({ snapshotId, decision: 'needs_review' })
  })

  it('rejects unknown snapshots and non-owners', async () => {
    const { tools, db } = fakeTools()
    expect((await saveReview(ctx(tools, OWNER, { snapshotId: 'nope', decision: 'keep' }))).success).toBe(false)
    expect((await saveReview(ctx(tools, 'u_visitor', { snapshotId: 'x', decision: 'keep' }))).success).toBe(false)
    expect(db.reviews).toHaveLength(0)
  })
})
