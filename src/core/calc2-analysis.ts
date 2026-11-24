/**
 * Owner-triggered Calc II comparison: fetch the versioned sample from GitHub
 * at a pinned commit, confirm it is exactly the sample this build renders,
 * then ask Jev for a recommendation under one tool policy. Stops at the first
 * failure so a bad fetch never reaches the billed Jev call.
 */

import { calc2, calc2Policies, type Calc2Review } from './calc2-content'
import { buildCalc2JevRequest, parseCalc2JevResponse, type Calc2JevLabel } from './calc2-jev'
import { decodeGithubFile, type CallIntegration } from './integration'

/** Commit 60c2689 published calc2-demo.v1.json; the blob SHA pins its exact bytes. */
export const CALC2_SAMPLE_SOURCE = {
  owner: 'JEREMIAHLAWAL',
  repo: 'docdrift',
  path: 'src/core/calc2-demo.v1.json',
  ref: '60c26897af22b3d81523e297e215a708a93b287f',
  blobSha: '88f37718c785e0753d4773df9a42d75caf8e92b6',
} as const

export const calc2JevLabelText: Record<Calc2JevLabel, string> = {
  assign_a: 'Assign A',
  assign_b: 'Assign B',
  revise_b: 'Revise B',
  inconclusive: 'Inconclusive',
}

export type Calc2Analysis = {
  policy: Calc2Review['policy']
  label: Calc2JevLabel
  model: string
  sampleVersion: string
  sampleRef: string
  sampleBlobSha: string
  capturedAt: string
}

export type Calc2AnalysisOutcome =
  | { ok: true; analysis: Calc2Analysis }
  | { ok: false; stage: 'sample' | 'compare'; error: string }

class StageError extends Error {
  constructor(readonly stage: 'sample' | 'compare', message: string) { super(message) }
}

async function call(integration: CallIntegration, stage: StageError['stage'], endpoint: string, body: unknown) {
  let result
  try {
    result = await integration(endpoint, body)
  } catch (err) {
    throw new StageError(stage, `${endpoint} failed: ${err instanceof Error ? err.message : String(err)}`)
  }
  if (!result.success) throw new StageError(stage, `${endpoint} failed${result.code ? ` (${result.code})` : ''}: ${result.error}`)
  return result.data
}

/** Decode the GitHub payload and require the pinned blob and the bundled sample. */
export function readFetchedSample(payload: unknown): typeof calc2 {
  let file
  try {
    file = decodeGithubFile(payload)
  } catch (err) {
    throw new StageError('sample', err instanceof Error ? err.message : String(err))
  }
  if (file.blobSha !== CALC2_SAMPLE_SOURCE.blobSha) {
    throw new StageError('sample', `GitHub returned blob ${file.blobSha ?? 'none'}, expected ${CALC2_SAMPLE_SOURCE.blobSha}.`)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(file.text)
  } catch {
    throw new StageError('sample', 'The fetched sample is not valid JSON.')
  }
  if (JSON.stringify(parsed) !== JSON.stringify(calc2)) {
    throw new StageError('sample', 'The fetched sample does not match the sample shown in this app.')
  }
  return parsed as typeof calc2
}

export async function runCalc2Analysis(integration: CallIntegration, policy: Calc2Review['policy'], now: Date): Promise<Calc2AnalysisOutcome> {
  try {
    const { owner, repo, path, ref } = CALC2_SAMPLE_SOURCE
    const sample = readFetchedSample(await call(integration, 'sample', 'github/get-repository-contents', { owner, repo, path, ref }))
    const reply = await call(integration, 'compare', 'cloudflare/jev', buildCalc2JevRequest(sample, calc2Policies[policy]))
    let parsed
    try {
      parsed = parseCalc2JevResponse(reply)
    } catch (err) {
      throw new StageError('compare', err instanceof Error ? err.message : String(err))
    }
    return {
      ok: true,
      analysis: {
        policy,
        label: parsed.label,
        model: parsed.model,
        sampleVersion: sample.version,
        sampleRef: ref,
        sampleBlobSha: CALC2_SAMPLE_SOURCE.blobSha,
        capturedAt: now.toISOString(),
      },
    }
  } catch (err) {
    if (err instanceof StageError) return { ok: false, stage: err.stage, error: err.message }
    return { ok: false, stage: 'compare', error: err instanceof Error ? err.message : String(err) }
  }
}
