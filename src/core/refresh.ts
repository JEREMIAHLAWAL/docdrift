/**
 * Refresh pipeline and review rules, independent of the worker runtime.
 * The server actions inject the real integration caller; tests inject fakes.
 */

import {
  CASE_ID,
  DECISIONS,
  LEGACY,
  LEGACY_SOURCE_URL,
  REFRESH_COOLDOWN_MS,
  TARGET,
  TARGET_SOURCE_URL,
  type Decision,
  type Relationship,
} from './case'
import { buildJevRequest, parseJevResponse } from './classify'
import {
  EvidenceError,
  decodeGithubFile,
  extractLegacyRender,
  extractTargetRender,
  readFirecrawlMarkdown,
} from './extract'

export type IntegrationResult =
  | { success: true; data: unknown }
  | { success: false; error: string; code?: string }

export type CallIntegration = (endpoint: string, body: unknown) => Promise<IntegrationResult>

/** One stored evidence snapshot: both excerpts and the suggestion, saved together. */
export interface SnapshotData {
  caseId: string
  capturedAt: string
  legacyLabel: string
  legacySourceUrl: string
  legacyRef: string
  legacyBlobSha: string
  legacyExcerpt: string
  targetLabel: string
  targetSourceUrl: string
  targetExcerpt: string
  suggestion: Relationship
  probabilities: Record<Relationship, number>
  confidence: number
  model: string
}

export type RefreshOutcome =
  | { ok: true; snapshot: SnapshotData }
  | { ok: false; stage: EvidenceError['stage']; error: string }

export type Gate = { ok: true } | { ok: false; error: string }

/**
 * Owner-only, explicitly confirmed, rate-limited. Fails closed when the
 * platform did not provide an owner id.
 */
export function authorizeRefresh(input: {
  callerId: string
  ownerId: string | undefined
  confirmBilling: unknown
  lastAttemptAt: string | null
  now: number
}): Gate {
  if (!input.ownerId || input.callerId !== input.ownerId) {
    return { ok: false, error: 'Only the app owner can run a billed refresh.' }
  }
  if (input.confirmBilling !== true) {
    return { ok: false, error: 'Refresh calls billed integrations; confirm billing to continue.' }
  }
  if (input.lastAttemptAt) {
    const elapsed = input.now - Date.parse(input.lastAttemptAt)
    if (Number.isFinite(elapsed) && elapsed < REFRESH_COOLDOWN_MS) {
      const wait = Math.ceil((REFRESH_COOLDOWN_MS - elapsed) / 1000)
      return { ok: false, error: `Refresh is rate-limited; try again in ${wait}s.` }
    }
  }
  return { ok: true }
}

async function call(
  integration: CallIntegration,
  stage: EvidenceError['stage'],
  endpoint: string,
  body: unknown,
): Promise<unknown> {
  let result: IntegrationResult
  try {
    result = await integration(endpoint, body)
  } catch (err) {
    throw new EvidenceError(stage, `${endpoint} failed: ${err instanceof Error ? err.message : String(err)}`)
  }
  if (!result.success) {
    const code = result.code ? ` (${result.code})` : ''
    throw new EvidenceError(stage, `${endpoint} failed${code}: ${result.error}`)
  }
  return result.data
}

/**
 * GitHub → Firecrawl → Jev, in that order, stopping at the first failure so
 * a broken source never spends on the later calls or reaches the classifier.
 */
export async function runRefresh(integration: CallIntegration, now: Date): Promise<RefreshOutcome> {
  try {
    const github = await call(integration, 'legacy', 'github/get-repository-contents', {
      owner: LEGACY.owner,
      repo: LEGACY.repo,
      path: LEGACY.path,
      ref: LEGACY.ref,
    })
    const legacyFile = decodeGithubFile(github)
    const legacyExcerpt = extractLegacyRender(legacyFile.text)

    const scrape = await call(integration, 'target', 'firecrawl/scrape', {
      url: TARGET.url,
      formats: ['markdown'],
      onlyMainContent: true,
    })
    const targetExcerpt = extractTargetRender(readFirecrawlMarkdown(scrape, TARGET.url))

    const jev = await call(integration, 'classify', 'cloudflare/jev', buildJevRequest(legacyExcerpt, targetExcerpt))
    const classification = parseJevResponse(jev)

    return {
      ok: true,
      snapshot: {
        caseId: CASE_ID,
        capturedAt: now.toISOString(),
        legacyLabel: LEGACY.label,
        legacySourceUrl: LEGACY_SOURCE_URL,
        legacyRef: LEGACY.ref,
        legacyBlobSha: legacyFile.blobSha ?? '',
        legacyExcerpt,
        targetLabel: TARGET.label,
        targetSourceUrl: TARGET_SOURCE_URL,
        targetExcerpt,
        ...classification,
      },
    }
  } catch (err) {
    if (err instanceof EvidenceError) return { ok: false, stage: err.stage, error: err.message }
    return { ok: false, stage: 'persist', error: err instanceof Error ? err.message : String(err) }
  }
}

export function isDecision(value: unknown): value is Decision {
  return typeof value === 'string' && (DECISIONS as readonly string[]).includes(value)
}

/** Owner-only review save, tied to an existing snapshot id. */
export function validateReview(input: {
  callerId: string
  ownerId: string | undefined
  snapshotId: unknown
  decision: unknown
  note: unknown
}): { ok: true; snapshotId: string; decision: Decision; note: string } | { ok: false; error: string } {
  if (!input.ownerId || input.callerId !== input.ownerId) {
    return { ok: false, error: 'Only the app owner can save a review.' }
  }
  if (typeof input.snapshotId !== 'string' || input.snapshotId.length === 0) {
    return { ok: false, error: 'A review must reference an evidence snapshot.' }
  }
  if (!isDecision(input.decision)) {
    return { ok: false, error: 'Decision must be keep, revise, or needs_review.' }
  }
  const note = typeof input.note === 'string' ? input.note.trim() : ''
  if (note.length > 500) return { ok: false, error: 'Note must be 500 characters or fewer.' }
  return { ok: true, snapshotId: input.snapshotId, decision: input.decision, note }
}
