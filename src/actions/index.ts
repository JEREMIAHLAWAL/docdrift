/**
 * DocDrift server actions. Both are owner-only; both run RBAC-off, so every
 * input is validated here before it touches a record or a billed integration.
 *
 *   refreshEvidence  GitHub → Firecrawl → Jev, then save snapshot + attempt.
 *   saveReview       Save the owner's keep/revise/needs_review decision
 *                    against an existing snapshot id.
 */

import type { ActionHandler, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { CASE_ID } from '../core/case'
import { authorizeRefresh, runRefresh, validateReview, type CallIntegration } from '../core/refresh'

type OwnerEnv = Pick<Env, 'OWNER_USER_ID'>

const ATTEMPTS = 'refresh_attempts'
const SNAPSHOTS = 'evidence_snapshots'
const REVIEWS = 'reviews'

async function latestAttemptAt(tools: ActionTools): Promise<string | null> {
  const r = await tools.query<{ attemptedAt?: string }>(ATTEMPTS, {
    where: { caseId: CASE_ID },
    orderBy: 'attemptedAt',
    orderDir: 'desc',
    limit: 1,
  })
  if (!r.success) throw new Error(`Could not read refresh history: ${r.error}`)
  return r.data.records[0]?.data.attemptedAt ?? null
}

export const refreshEvidence: ActionHandler<OwnerEnv> = async ({ userId, params, tools, env }) => {
  const now = new Date()
  let lastAttemptAt: string | null
  try {
    lastAttemptAt = await latestAttemptAt(tools)
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
  const gate = authorizeRefresh({
    callerId: userId,
    ownerId: env.OWNER_USER_ID,
    confirmBilling: params.confirmBilling,
    lastAttemptAt,
    now: now.getTime(),
  })
  if (!gate.ok) return { success: false, error: gate.error }

  // Record the attempt before spending, so the cooldown also covers a
  // refresh that is still in flight.
  const attempt = await tools.create(ATTEMPTS, {
    caseId: CASE_ID,
    attemptedAt: now.toISOString(),
    status: 'running',
    stage: '',
    error: '',
    snapshotId: '',
  })
  if (!attempt.success) return { success: false, error: `Could not record attempt: ${attempt.error}` }
  const attemptId = attempt.data.recordId

  const call: CallIntegration = (endpoint, body) => tools.integration(endpoint, body)
  const outcome = await runRefresh(call, now)

  if (!outcome.ok) {
    // The previous snapshot is untouched; the UI keeps showing it with its own date.
    await tools.update(ATTEMPTS, attemptId, { status: 'failed', stage: outcome.stage, error: outcome.error.slice(0, 500) })
    console.warn(`[refreshEvidence] failed stage=${outcome.stage}: ${outcome.error}`)
    return { success: false, error: outcome.error }
  }

  const saved = await tools.create(SNAPSHOTS, { ...outcome.snapshot })
  if (!saved.success) {
    await tools.update(ATTEMPTS, attemptId, { status: 'failed', stage: 'persist', error: saved.error.slice(0, 500) })
    return { success: false, error: `Could not save snapshot: ${saved.error}` }
  }
  await tools.update(ATTEMPTS, attemptId, { status: 'succeeded', snapshotId: saved.data.recordId })
  return { success: true, data: { snapshotId: saved.data.recordId, suggestion: outcome.snapshot.suggestion } }
}

export const saveReview: ActionHandler<OwnerEnv> = async ({ userId, params, tools, env }) => {
  const input = validateReview({
    callerId: userId,
    ownerId: env.OWNER_USER_ID,
    snapshotId: params.snapshotId,
    decision: params.decision,
    note: params.note,
  })
  if (!input.ok) return { success: false, error: input.error }

  const snapshot = await tools.get(SNAPSHOTS, input.snapshotId)
  if (!snapshot.success) return { success: false, error: 'That evidence snapshot does not exist.' }

  // Fixed record id: one current review for the one case (create upserts).
  return tools.create(
    REVIEWS,
    {
      caseId: CASE_ID,
      snapshotId: input.snapshotId,
      decision: input.decision,
      note: input.note,
      decidedAt: new Date().toISOString(),
    },
    CASE_ID,
  )
}

export const actions: Record<string, ActionHandler<Env>> = { refreshEvidence, saveReview }
