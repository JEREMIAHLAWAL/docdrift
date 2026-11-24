import type { ActionHandler, ActionTools } from 'deepspace/worker'
import type { Env } from '../../worker'
import { buildCalc2PdfRequest, calc2, calc2Policies, calc2Choices, type Calc2Review } from '../core/calc2-content'

type OwnerEnv = Pick<Env, 'OWNER_USER_ID'>
const REVIEWS = 'calc2_reviews'
const ATTEMPTS = 'calc2_pdf_attempts'
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
