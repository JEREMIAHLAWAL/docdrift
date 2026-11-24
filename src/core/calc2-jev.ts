import type { calc2 } from './calc2-content'

export const calc2JevLabels = ['assign_a', 'assign_b', 'revise_b', 'inconclusive'] as const
export type Calc2JevLabel = typeof calc2JevLabels[number]

export function buildCalc2JevRequest(sample: typeof calc2, toolPolicy: string) {
  return {
    state: {
      learning_objective: sample.objective,
      tool_policy: toolPolicy,
      candidate_a: sample.questionA,
      candidate_b: sample.questionB,
    },
    questions: {
      recommendation: {
        type: 'choice',
        instructions: 'Which recommendation best aligns the question with the stated learning objective and tool policy? Consider what students must explain, what the allowed tools can produce for them, and whether the extra work is justified. The goal is evidence of individual reasoning, not just a correct submission.',
        criteria: {
          assign_a: 'The simpler direct question is sufficient evidence for this learning objective under the stated tool policy.',
          assign_b: 'Question B directly assesses the misconception and the block argument; assign it as written under this policy.',
          revise_b: 'Question B better targets the objective, but under this policy the allowed tools can produce the reasoning; revise B or add a separate demonstration of individual reasoning.',
          inconclusive: 'The available information is insufficient to recommend either candidate or a targeted revision.',
        },
      },
    },
  } as const
}

export function parseCalc2JevResponse(data: unknown) {
  const result = data as { model?: unknown; answers?: { recommendation?: { type?: unknown; choice?: unknown } } } | null | undefined
  const answer = result?.answers?.recommendation
  const label = calc2JevLabels.find((candidate) => candidate === answer?.choice)
  if (answer?.type !== 'choice' || !label || typeof result?.model !== 'string' || !result.model.trim() || result.model.length > 200) {
    throw new Error('Jev did not return a valid Calc II recommendation.')
  }
  return { label, model: result.model }
}
