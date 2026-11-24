import type { ActionHandler, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { buildCalc2PdfRequest, calc2, calc2Policies, calc2Choices, type Calc2Review } from '../core/calc2-content'
import { CALC2_SAMPLE_SOURCE, runCalc2Analysis, type Calc2Analysis } from '../core/calc2-analysis'
import { calc2JevLabels } from '../core/calc2-jev'

type OwnerEnv = Pick<Env, 'OWNER_USER_ID'>
const REVIEWS = 'calc2_reviews'
const ATTEMPTS = 'calc2_pdf_attempts'
const ANALYSES = 'calc2_analyses'
const ANALYSIS_ATTEMPTS = 'calc2_analysis_attempts'
const failure = (error: string) => ({ success: false as const, error })
const reviewId = (policy: Calc2Review['policy']) => `${calc2.version}-${policy}`
const isOwner = (userId: string, env: OwnerEnv) => !!env.OWNER_USER_ID && env.OWNER_USER_ID === userId
const isPolicy = (policy: unknown): policy is Calc2Review['policy'] =>
  typeof policy === 'string' && Object.hasOwn(calc2Policies, policy)

function readInput(params: Record<string, unknown>): Calc2Review | null {
  const { policy, choice } = params
  if (!isPolicy(policy) || !calc2Choices.some((value) => value === choice) || typeof params.reason !== 'string') return null
  const reason = params.reason.replace(/\s+/g, ' ').trim()
  // pdfLaTeX has limited Unicode support. Keep this English-only demo input
  // compatible with the compiler, including familiar punctuation and math.
  if (!reason || reason.length > 300 || /[^ -~‘’“”–—…→−≥²]/u.test(reason)) return null
  return { policy, choice: choice as Calc2Review['choice'], reason }
}

async function loadReview(tools: ActionTools, policy: Calc2Review['policy']) {
  const result = await tools.query<Calc2Review>(REVIEWS, { where: { recordId: reviewId(policy) }, limit: 1 })
  if (!result.success) return failure('Could not read the saved recommendation.')
  const row = result.data.records[0]?.data
  const review = row && readInput(row)
  if (row && (!review || review.policy !== policy)) return failure('The saved recommendation could not be read.')
  return { success: true as const, data: { review: review ?? null } }
}

export const getCalc2Review: ActionHandler<OwnerEnv> = async ({ userId, params, tools, env }) => {
  if (!isOwner(userId, env)) return failure('Only the app owner can access saved recommendations.')
  if (!isPolicy(params.policy)) return failure('Choose a valid tool policy.')
  return loadReview(tools, params.policy)
}

export const saveCalc2Review: ActionHandler<OwnerEnv> = async ({ userId, params, tools, env }) => {
  if (!isOwner(userId, env)) return failure('Only the app owner can save recommendations.')
  const input = readInput(params)
  if (!input) return failure('Choose a recommendation and give a plain-text reason (1–300 characters).')
  const saved = await tools.create(REVIEWS, { ...input, decidedAt: new Date().toISOString() }, reviewId(input.policy))
  if (!saved.success) return failure('Could not save the recommendation.')
  const verified = await loadReview(tools, input.policy)
  if (!verified.success || verified.data.review?.choice !== input.choice || verified.data.review.reason !== input.reason) {
    return failure('The recommendation could not be verified after saving. Reload to check the stored value.')
  }
  return { success: true, data: verified.data.review }
}

let compiling = false
export const exportCalc2Review: ActionHandler<OwnerEnv> = async ({ userId, params, tools, env }) => {
  if (!isOwner(userId, env)) return failure('Only the app owner can export a recommendation.')
  if (params.confirmBilling !== true) return failure('Confirm the billed compile to continue.')
  if (!isPolicy(params.policy)) return failure('Choose a valid tool policy.')
  if (compiling) return failure('A PDF export is already running. Wait a minute before trying again.')
  compiling = true
  try {
    const saved = await loadReview(tools, params.policy)
    if (!saved.success) return saved
    if (!saved.data.review) return failure('Save a recommendation under this policy before exporting.')

    const latest = await tools.query<{ attemptedAt: string }>(ATTEMPTS, { orderBy: 'attemptedAt', orderDir: 'desc', limit: 1 })
    if (!latest.success) return failure('Could not verify the export cooldown.')
    const now = Date.now()
    const previous = latest.data.records[0]?.data.attemptedAt
    if (previous && now - Date.parse(previous) < 60_000) return failure('Wait a minute between PDF export attempts.')
    const attempt = await tools.create(ATTEMPTS, { attemptedAt: new Date(now).toISOString(), status: 'running' })
    if (!attempt.success) return failure('Could not record the export attempt; no compile was started.')

    let status = 'failed'
    try {
      const reply = await tools.integration<{ compiled?: boolean; pdfBase64?: string; contentType?: string }>(
        'latex-compiler/compile', buildCalc2PdfRequest(saved.data.review),
      )
      const data = reply.success ? reply.data : null
      if (!data?.compiled || data.contentType !== 'application/pdf' || typeof data.pdfBase64 !== 'string' || data.pdfBase64.length > 1_500_000) {
        return failure('The compiler did not return a PDF. Your recommendation is still saved.')
      }
      const pdf = atob(data.pdfBase64)
      if (!pdf.startsWith('%PDF-') || !pdf.trimEnd().endsWith('%%EOF')) return failure('The compiler returned an invalid PDF.')
      status = 'succeeded'
      return { success: true, data: { pdfBase64: data.pdfBase64 } }
    } catch {
      return failure('The PDF export failed. Your recommendation is still saved.')
    } finally {
      try { await tools.update(ATTEMPTS, attempt.data.recordId, { status }) } catch { /* the attempt still counts against cooldown */ }
    }
  } finally {
    compiling = false
  }
}


function readAnalysis(row: Record<string, unknown> | undefined, policy: Calc2Review['policy']): Calc2Analysis | null | undefined {
  if (!row) return null
  const { label, model, sampleVersion, sampleRef, sampleBlobSha, capturedAt } = row
  const valid = row.policy === policy && calc2JevLabels.some((value) => value === label) && typeof model === 'string' && !!model
    && sampleVersion === calc2.version && sampleRef === CALC2_SAMPLE_SOURCE.ref && sampleBlobSha === CALC2_SAMPLE_SOURCE.blobSha
    && typeof capturedAt === 'string' && Number.isFinite(Date.parse(capturedAt))
  return valid ? row as Calc2Analysis : undefined
}

async function loadAnalysis(tools: ActionTools, policy: Calc2Review['policy']) {
  const result = await tools.query<Calc2Analysis>(ANALYSES, { where: { recordId: reviewId(policy) }, limit: 1 })
  if (!result.success) return failure('Could not read the saved comparison.')
  const analysis = readAnalysis(result.data.records[0]?.data, policy)
  if (analysis === undefined) return failure('The saved comparison could not be read.')
  return { success: true as const, data: { analysis } }
}

export const getCalc2Analysis: ActionHandler<OwnerEnv> = async ({ userId, params, tools, env }) => {
  if (!isOwner(userId, env)) return failure('Only the app owner can access model comparisons.')
  if (!isPolicy(params.policy)) return failure('Choose a valid tool policy.')
  return loadAnalysis(tools, params.policy)
}

let analyzing = false
/** Owner-only, explicitly confirmed, one attempt per minute: GitHub sample fetch → Jev. */
export const analyzeCalc2: ActionHandler<OwnerEnv> = async ({ userId, params, tools, env }) => {
  if (!isOwner(userId, env)) return failure('Only the app owner can run a billed comparison.')
  if (params.confirmBilling !== true) return failure('Confirm the billed GitHub fetch and Jev comparison to continue.')
  if (!isPolicy(params.policy)) return failure('Choose a valid tool policy.')
  if (analyzing) return failure('A comparison is already running. Wait a minute before trying again.')
  analyzing = true
  try {
    const policy = params.policy
    const latest = await tools.query<{ attemptedAt: string }>(ANALYSIS_ATTEMPTS, { orderBy: 'attemptedAt', orderDir: 'desc', limit: 1 })
    if (!latest.success) return failure('Could not verify the comparison cooldown.')
    const now = new Date()
    const previous = latest.data.records[0]?.data.attemptedAt
    if (previous && now.getTime() - Date.parse(previous) < 60_000) return failure('Wait a minute between comparison attempts.')
    const attempt = await tools.create(ANALYSIS_ATTEMPTS, { policy, attemptedAt: now.toISOString(), status: 'running', stage: '', error: '' })
    if (!attempt.success) return failure('Could not record the comparison attempt; nothing was fetched.')

    let finish: Record<string, string> = { status: 'failed', stage: 'compare', error: 'Interrupted.' }
    try {
      const outcome = await runCalc2Analysis((endpoint, body) => tools.integration(endpoint, body), policy, now)
      if (!outcome.ok) {
        finish = { status: 'failed', stage: outcome.stage, error: outcome.error.slice(0, 500) }
        console.warn(`[analyzeCalc2] failed stage=${outcome.stage}: ${outcome.error}`)
        return failure(outcome.stage === 'sample'
          ? 'Could not fetch the versioned sample from GitHub; Jev was not called.'
          : 'The Jev comparison failed. Earlier results are unchanged.')
      }
      const saved = await tools.create(ANALYSES, { ...outcome.analysis }, reviewId(policy))
      if (!saved.success) { finish = { status: 'failed', stage: 'persist', error: 'Could not save comparison.' }; return failure('Could not save the comparison.') }
      const verified = await loadAnalysis(tools, policy)
      if (!verified.success || verified.data.analysis?.capturedAt !== outcome.analysis.capturedAt) {
        finish = { status: 'failed', stage: 'persist', error: 'Read-back mismatch.' }
        return failure('The comparison could not be verified after saving.')
      }
      finish = { status: 'succeeded', stage: '', error: '' }
      return { success: true, data: { analysis: verified.data.analysis } }
    } finally {
      try { await tools.update(ANALYSIS_ATTEMPTS, attempt.data.recordId, finish) } catch { /* the attempt still counts against cooldown */ }
    }
  } finally {
    analyzing = false
  }
}
