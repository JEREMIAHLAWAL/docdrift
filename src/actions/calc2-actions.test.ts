import { describe, expect, it, vi } from 'vitest'
import type { ActionTools } from 'deepspace/worker'
import { actions } from './index'

const OWNER = 'owner'
const sample = { policy: 'exam', choice: 'Assign B', reason: 'Students must justify the bound.' }

function harness() {
  const rows: Record<string, Record<string, unknown>> = {}
  const create = vi.fn(async (collection: string, data: Record<string, unknown>, id?: string) => {
    const recordId = id ?? String(Object.keys(rows).length)
    rows[`${collection}/${recordId}`] = { ...data }
    return { success: true, data: { recordId } }
  })
  const query = vi.fn(async (collection: string, options?: { where?: { recordId?: string } }) => {
    const id = options?.where?.recordId
    const records = Object.entries(rows).filter(([key]) => id ? key === `${collection}/${id}` : key.startsWith(`${collection}/`)).reverse().map(([, data]) => ({ data }))
    return { success: true, data: { records, count: records.length } }
  })
  const get = vi.fn(async (collection: string, id: string) => {
    const data = rows[`${collection}/${id}`]
    return data ? { success: true, data: { record: { data } } } : { success: false, error: 'not found' }
  })
  const pdf = btoa('%PDF-1.4\ncompile test double only\n%%EOF')
  const integration = vi.fn(async (_endpoint: string, _body: unknown) => ({
    success: true, data: { compiled: true, contentType: 'application/pdf', pdfBase64: pdf },
  }))
  const update = vi.fn(async () => ({ success: true, data: {} }))
  const tools = { create, get, query, integration, update } as unknown as ActionTools
  function call(name: string, params: Record<string, unknown>, userId = OWNER, ownerId: string | undefined = OWNER) {
    expect(actions).toHaveProperty(name)
    return actions[name]({ userId, params, tools, env: { OWNER_USER_ID: ownerId } as never, callerJwt: 'test' })
  }
  return { call, create, get, query, integration, pdf, rows }
}

describe('Calc II recommendation actions', () => {
  it('saves and reads back the owner recommendation separately for each policy', async () => {
    const { call } = harness()
    expect(await call('saveCalc2Review', sample)).toMatchObject({ success: true, data: sample })
    expect(await call('getCalc2Review', { policy: 'exam' })).toMatchObject({ success: true, data: { review: sample } })
    expect(await call('getCalc2Review', { policy: 'takeHome' })).toMatchObject({ success: true, data: { review: null } })
  })

  it.each([['someone-else', OWNER], [OWNER, '']])('denies non-owner access and fails closed', async (userId, ownerId) => {
    const { call, create, get, query, integration } = harness()
    for (const name of ['saveCalc2Review', 'getCalc2Review', 'exportCalc2Review']) {
      expect(await call(name, { ...sample, confirmBilling: true }, userId, ownerId)).toMatchObject({ success: false })
    }
    for (const method of [create, get, query, integration]) expect(method).not.toHaveBeenCalled()
  })

  it('requires a nonblank reason and a known choice and policy', async () => {
    const { call, create } = harness()
    for (const invalid of [{ reason: '  ' }, { choice: 'other' }, { policy: 'other' }]) {
      expect(await call('saveCalc2Review', { ...sample, ...invalid })).toMatchObject({ success: false })
    }
    expect(create).not.toHaveBeenCalled()
  })

  it('requires explicit billing confirmation and an actual saved review', async () => {
    const { call, integration } = harness()
    expect(await call('exportCalc2Review', { policy: 'exam', confirmBilling: true })).toMatchObject({ success: false })
    await call('saveCalc2Review', sample)
    expect(await call('exportCalc2Review', { policy: 'exam', confirmBilling: 'true' })).toMatchObject({ success: false })
    expect(integration).not.toHaveBeenCalled()
  })

  it('compiles only persisted text and rate-limits immediate repeats', async () => {
    const { call, create, integration, pdf } = harness()
    await call('saveCalc2Review', sample)
    const input = { policy: 'exam', confirmBilling: true, reason: 'Unsaved edit' }
    expect(await call('exportCalc2Review', input)).toMatchObject({ success: true, data: { pdfBase64: pdf } })
    expect(integration).toHaveBeenCalledWith('latex-compiler/compile', { compiler: 'pdflatex', document: expect.stringContaining(sample.reason) })
    expect(integration.mock.calls[0][1]).not.toMatchObject({ document: expect.stringContaining('Unsaved edit') })
    expect(create.mock.invocationCallOrder[1]).toBeLessThan(integration.mock.invocationCallOrder[0])
    expect(await call('exportCalc2Review', input)).toMatchObject({ success: false, error: expect.stringMatching(/minute/i) })
    expect(integration).toHaveBeenCalledTimes(1)
  })

  it('does not retry or return malformed compiler output', async () => {
    const { call, integration } = harness()
    await call('saveCalc2Review', sample)
    integration.mockResolvedValueOnce({ success: true, data: { compiled: true, contentType: 'application/pdf', pdfBase64: 'bogus' } })
    expect(await call('exportCalc2Review', { policy: 'exam', confirmBilling: true })).toMatchObject({ success: false })
    expect(integration).toHaveBeenCalledTimes(1)
  })
})
