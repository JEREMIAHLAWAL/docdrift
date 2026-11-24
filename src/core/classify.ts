/**
 * The model's only job: given the two displayed excerpts, pick one of three
 * labels. The request is built from fixed text plus the excerpts, and the
 * response is validated before anything is stored. The human decision is
 * separate and never derived from this.
 */

import { CASE_QUESTION, LEGACY, RELATIONSHIPS, TARGET, type Relationship } from './case'
import { EvidenceError } from './extract'

export const JEV_QUESTION_ID = 'relationship'

export function buildJevRequest(legacyExcerpt: string, targetExcerpt: string) {
  return {
    state: {
      question: CASE_QUESTION,
      legacy_instruction: { source: LEGACY.label, excerpt: legacyExcerpt },
      react19_guidance: { source: TARGET.label, excerpt: targetExcerpt },
    },
    questions: {
      [JEV_QUESTION_ID]: {
        type: 'choice',
        instructions:
          'Use only the two excerpts in the state. For a developer upgrading to React 19, ' +
          'does the React 19 guidance agree with the legacy instruction, conflict with it, ' +
          'or is the evidence inconclusive?',
        criteria: {
          agrees: 'The React 19 guidance still supports following the legacy instruction as written.',
          conflicts:
            'The React 19 guidance says the legacy instruction no longer works or must be replaced.',
          inconclusive: 'The two excerpts do not contain enough information to decide.',
        },
      },
    },
  } as const
}

export interface Classification {
  suggestion: Relationship
  probabilities: Record<Relationship, number>
  confidence: number
  model: string
}

const isUnit = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1

/** Validate a Jev response against the one question we asked. */
export function parseJevResponse(payload: unknown): Classification {
  const root = (payload ?? {}) as { model?: unknown; answers?: Record<string, unknown> }
  const answer = root.answers?.[JEV_QUESTION_ID] as
    | { type?: unknown; choice?: unknown; probabilities?: Record<string, unknown>; confidence?: unknown }
    | undefined
  if (!answer || answer.type !== 'choice') {
    throw new EvidenceError('classify', 'Jev did not answer the relationship question.')
  }
  if (typeof answer.choice !== 'string' || !(RELATIONSHIPS as readonly string[]).includes(answer.choice)) {
    throw new EvidenceError('classify', `Jev returned an unknown label: ${JSON.stringify(answer.choice)}.`)
  }
  const probabilities = {} as Record<Relationship, number>
  for (const label of RELATIONSHIPS) {
    const p = answer.probabilities?.[label]
    if (!isUnit(p)) throw new EvidenceError('classify', `Jev probability for "${label}" is invalid.`)
    probabilities[label] = p
  }
  if (!isUnit(answer.confidence)) {
    throw new EvidenceError('classify', 'Jev confidence is missing or out of range.')
  }
  if (typeof root.model !== 'string' || root.model.length === 0) {
    throw new EvidenceError('classify', 'Jev response did not name its model.')
  }
  return {
    suggestion: answer.choice as Relationship,
    probabilities,
    confidence: answer.confidence,
    model: root.model,
  }
}
