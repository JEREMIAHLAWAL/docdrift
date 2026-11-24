import { describe, expect, it, vi } from 'vitest'
import legacyMarkdown from './fixtures/legacy-reference-react-dom.md?raw'
import guideMarkdown from './fixtures/upgrade-guide.md?raw'
import { LEGACY, REFRESH_COOLDOWN_MS, TARGET } from './case'
import { buildJevRequest, parseJevResponse } from './classify'
import { authorizeRefresh, runRefresh, validateReview, type CallIntegration } from './refresh'

const b64 = (text: string) => {
  let binary = ''
  for (const b of new TextEncoder().encode(text)) binary += String.fromCharCode(b)
  return btoa(binary)
}

const jevOk = {
  model: '@cf/jev-test',
  answers: {
    relationship: {
      type: 'choice',
      choice: 'conflicts',
      probabilities: { agrees: 0.02, conflicts: 0.95, inconclusive: 0.03 },
      confidence: 0.9,
    },
  },
  usage: { input_tokens: 400, output_tokens: 1, totalTokens: 400 },
}

function fakeIntegrations(overrides: Partial<Record<string, unknown>> = {}) {
  const responses: Record<string, unknown> = {
    'github/get-repository-contents': {
      success: true,
      data: { type: 'file', encoding: 'base64', content: b64(legacyMarkdown), sha: 'blob123' },
    },
    'firecrawl/scrape': {
      success: true,
      data: { data: { markdown: guideMarkdown, metadata: { statusCode: 200, sourceURL: TARGET.url } }, creditsUsed: 1 },
    },
    'cloudflare/jev': { success: true, data: jevOk },
    ...overrides,
  }
  const fn = vi.fn<CallIntegration>(async (endpoint) => responses[endpoint] as never)
  return fn
}

const NOW = new Date('2026-11-24T20:00:00.000Z')

describe('runRefresh', () => {
  it('calls the three fixed endpoints in order and returns one snapshot', async () => {
    const call = fakeIntegrations()
    const out = await runRefresh(call, NOW)
    expect(call.mock.calls.map((c) => c[0])).toEqual([
      'github/get-repository-contents',
      'firecrawl/scrape',
      'cloudflare/jev',
    ])
    expect(call.mock.calls[0][1]).toEqual({ owner: LEGACY.owner, repo: LEGACY.repo, path: LEGACY.path, ref: LEGACY.ref })
    expect(call.mock.calls[1][1]).toMatchObject({ url: TARGET.url })
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.snapshot).toMatchObject({
      capturedAt: NOW.toISOString(),
      legacyRef: LEGACY.ref,
      legacyBlobSha: 'blob123',
      suggestion: 'conflicts',
      confidence: 0.9,
      model: '@cf/jev-test',
    })
    expect(out.snapshot.legacySourceUrl).toContain(LEGACY.ref)
  })

  it('classifies exactly the excerpts it stores', async () => {
    const call = fakeIntegrations()
    const out = await runRefresh(call, NOW)
    if (!out.ok) throw new Error(out.error)
    expect(call.mock.calls[2][1]).toEqual(buildJevRequest(out.snapshot.legacyExcerpt, out.snapshot.targetExcerpt))
  })

  it('stops at a GitHub failure without spending on Firecrawl or Jev', async () => {
    const call = fakeIntegrations({
      'github/get-repository-contents': { success: false, error: 'Not Found', code: 'upstream_404' },
    })
    const out = await runRefresh(call, NOW)
    expect(out).toEqual({ ok: false, stage: 'legacy', error: expect.stringContaining('upstream_404') })
    expect(call).toHaveBeenCalledTimes(1)
  })

  it('never classifies when the target section is missing', async () => {
    const call = fakeIntegrations({
      'firecrawl/scrape': { success: true, data: { data: { markdown: '# A different page' } } },
    })
    const out = await runRefresh(call, NOW)
    expect(out).toMatchObject({ ok: false, stage: 'target' })
    expect(call.mock.calls.map((c) => c[0])).not.toContain('cloudflare/jev')
  })

  it('reports insufficient credits from the proxy as a failure', async () => {
    const call = fakeIntegrations({
      'cloudflare/jev': { success: false, error: 'Not enough credits', code: 'insufficient_credits' },
    })
    expect(await runRefresh(call, NOW)).toMatchObject({ ok: false, stage: 'classify' })
  })

  it('turns a thrown transport error into a reported failure', async () => {
    const call = vi.fn<CallIntegration>(async () => {
      throw new Error('network down')
    })
    expect(await runRefresh(call, NOW)).toEqual({
      ok: false,
      stage: 'legacy',
      error: expect.stringContaining('network down'),
    })
  })
})

describe('parseJevResponse', () => {
  it('accepts a valid choice answer', () => {
    expect(parseJevResponse(jevOk).suggestion).toBe('conflicts')
  })

  it.each([
    ['unknown label', { ...jevOk, answers: { relationship: { ...jevOk.answers.relationship, choice: 'maybe' } } }],
    ['missing answer', { ...jevOk, answers: {} }],
    ['bad probability', {
      ...jevOk,
      answers: { relationship: { ...jevOk.answers.relationship, probabilities: { agrees: 2, conflicts: 0, inconclusive: 0 } } },
    }],
    ['missing confidence', { ...jevOk, answers: { relationship: { ...jevOk.answers.relationship, confidence: undefined } } }],
    ['missing model', { ...jevOk, model: '' }],
  ])('rejects %s', (_label, payload) => {
    expect(() => parseJevResponse(payload)).toThrow()
  })
})

describe('authorizeRefresh', () => {
  const base = { callerId: 'u_owner', ownerId: 'u_owner', confirmBilling: true, lastAttemptAt: null, now: NOW.getTime() }

  it('allows the owner with explicit confirmation', () => {
    expect(authorizeRefresh(base)).toEqual({ ok: true })
  })

  it('fails closed without an owner id', () => {
    expect(authorizeRefresh({ ...base, ownerId: undefined }).ok).toBe(false)
  })

  it('refuses non-owners and unconfirmed billing', () => {
    expect(authorizeRefresh({ ...base, callerId: 'u_other' }).ok).toBe(false)
    expect(authorizeRefresh({ ...base, confirmBilling: 'yes' }).ok).toBe(false)
  })

  it('rate-limits a second refresh inside the cooldown', () => {
    const recent = new Date(NOW.getTime() - REFRESH_COOLDOWN_MS / 2).toISOString()
    const old = new Date(NOW.getTime() - REFRESH_COOLDOWN_MS - 1).toISOString()
    expect(authorizeRefresh({ ...base, lastAttemptAt: recent })).toMatchObject({ ok: false, error: expect.stringMatching(/rate-limited/) })
    expect(authorizeRefresh({ ...base, lastAttemptAt: old }).ok).toBe(true)
  })
})

describe('validateReview', () => {
  const base = { callerId: 'u_owner', ownerId: 'u_owner', snapshotId: 'snap_1', decision: 'revise', note: '  update docs  ' }

  it('accepts an owner decision and trims the note', () => {
    expect(validateReview(base)).toEqual({ ok: true, snapshotId: 'snap_1', decision: 'revise', note: 'update docs' })
  })

  it.each([
    ['non-owner', { callerId: 'u_other' }],
    ['no owner configured', { ownerId: undefined }],
    ['missing snapshot', { snapshotId: '' }],
    ['unknown decision', { decision: 'delete' }],
    ['long note', { note: 'x'.repeat(501) }],
  ])('rejects %s', (_label, patch) => {
    expect(validateReview({ ...base, ...patch }).ok).toBe(false)
  })
})
