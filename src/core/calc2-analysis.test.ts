import { describe, expect, it, vi } from 'vitest'
import publishedRaw from './calc2-demo.v1.json?raw'
import { CALC2_SAMPLE_SOURCE, readFetchedSample, runCalc2Analysis } from './calc2-analysis'
import { calc2, calc2Policies } from './calc2-content'

// The published file is committed with LF endings; normalize the checkout.
const published = publishedRaw.replace(/\r\n/g, '\n')
const toBase64 = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text)))
const githubFile = (text = published, sha: string = CALC2_SAMPLE_SOURCE.blobSha) =>
  ({ type: 'file', encoding: 'base64', sha, content: toBase64(text) })
const jevReply = (choice = 'revise_b') => ({ model: 'jev-1.13.0', answers: { recommendation: { type: 'choice', choice } } })

function fake(overrides: Record<string, unknown> = {}) {
  return vi.fn(async (endpoint: string, _body: unknown) => {
    if (endpoint in overrides) return overrides[endpoint] as never
    if (endpoint === 'github/get-repository-contents') return { success: true as const, data: githubFile() }
    return { success: true as const, data: jevReply() }
  })
}

describe('versioned Calc II sample fetch', () => {
  it('accepts the pinned published bytes, which match the sample this app renders', () => {
    expect(readFetchedSample(githubFile())).toEqual(calc2)
  })

  it('rejects a different blob or content that differs from the rendered sample', () => {
    expect(() => readFetchedSample(githubFile(published, 'f'.repeat(40)))).toThrow(/expected/)
    expect(() => readFetchedSample(githubFile(published.replace('"points": 2', '"points": 3')))).toThrow(/does not match/)
    expect(() => readFetchedSample(githubFile('not json'))).toThrow(/JSON/)
  })
})

describe('runCalc2Analysis', () => {
  it('fetches the pinned commit, then asks Jev about the fetched sample under the chosen policy', async () => {
    const integration = fake()
    const outcome = await runCalc2Analysis(integration, 'takeHome', new Date('2026-11-24T20:00:00Z'))
    expect(outcome).toEqual({
      ok: true,
      analysis: {
        policy: 'takeHome', label: 'revise_b', model: 'jev-1.13.0', sampleVersion: calc2.version,
        sampleRef: CALC2_SAMPLE_SOURCE.ref, sampleBlobSha: CALC2_SAMPLE_SOURCE.blobSha, capturedAt: '2026-11-24T20:00:00.000Z',
      },
    })
    const { owner, repo, path, ref } = CALC2_SAMPLE_SOURCE
    expect(integration.mock.calls[0]).toEqual(['github/get-repository-contents', { owner, repo, path, ref }])
    expect(integration.mock.calls[1][0]).toBe('cloudflare/jev')
    expect(integration.mock.calls[1][1]).toMatchObject({ state: { tool_policy: calc2Policies.takeHome, candidate_b: calc2.questionB } })
  })

  it('stops before Jev when the sample fetch fails or does not match', async () => {
    for (const reply of [{ success: false, error: 'boom' }, { success: true, data: githubFile('{}') }]) {
      const integration = fake({ 'github/get-repository-contents': reply })
      expect(await runCalc2Analysis(integration, 'exam', new Date())).toMatchObject({ ok: false, stage: 'sample' })
      expect(integration).toHaveBeenCalledTimes(1)
    }
  })

  it('reports an invalid Jev answer as a compare failure', async () => {
    const integration = fake({ 'cloudflare/jev': { success: true, data: jevReply('assign_c') } })
    expect(await runCalc2Analysis(integration, 'exam', new Date())).toMatchObject({ ok: false, stage: 'compare' })
  })
})
