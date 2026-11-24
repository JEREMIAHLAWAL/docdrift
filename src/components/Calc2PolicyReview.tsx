import { useState } from 'react'
import { useAuthProfileReady } from 'deepspace'
import { calc2Policies } from '../core/calc2-content'
import { Calc2OwnerComparison } from './Calc2OwnerComparison'
import { Calc2OwnerReview } from './Calc2OwnerReview'

type Policy = keyof typeof calc2Policies

const policies: { id: Policy; label: string }[] = [
  { id: 'exam', label: 'Calculator-allowed exam' },
  { id: 'takeHome', label: 'AI-allowed take-home' },
]

const comparison = {
  exam: {
    suggestion: 'Assign B',
    reason: 'B makes students explain the misconception and justify a bound that works for every block.',
    aTools: 'A non-CAS calculator can approximate partial sums. That does not settle convergence; a familiar test or memorized proof could still answer A.',
    bTools: 'A calculator can illustrate the first few blocks, but students still need to justify the bound for every block.',
    tradeoff: 'B takes longer to answer and grade than A. The three rubric parts make that extra work worthwhile when diagnosing this misconception is the goal.',
  },
  takeHome: {
    suggestion: 'Revise B',
    reason: 'B asks for better evidence than A, but a submitted proof alone does not establish individual understanding.',
    aTools: 'AI can recognize the harmonic series and supply a standard divergence proof. A gives little evidence that the student can spot the misconception.',
    bTools: 'AI can generate the full proof, including the flaw, the uniform block bound, and the conclusion. The written work can still be useful for practice.',
    tradeoff: 'For individual assessment, pair B with a brief follow-up: ask whether the same block bound works for the series with terms 1/n², and why. That costs TA time but gives a separate opportunity to observe reasoning.',
  },
} satisfies Record<Policy, Record<'suggestion' | 'reason' | 'aTools' | 'bTools' | 'tradeoff', string>>

export function Calc2PolicyReview() {
  const [policy, setPolicy] = useState<Policy>('exam')
  const { isSignedIn, user } = useAuthProfileReady({ requireUser: true })
  const isOwner = isSignedIn && user?.role === 'admin'
  const result = comparison[policy]
  return (
    <>
    <section className="space-y-4 rounded-lg border border-border p-4" aria-labelledby="review-comparison">
      <h2 id="review-comparison" className="font-semibold">Review comparison</h2>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Tool policy</legend>
        <div className="flex flex-wrap gap-2">
          {policies.map(({ id, label }) => (
            <label key={id} className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm has-checked:border-primary">
              <input type="radio" name="calc2-policy" checked={policy === id} onChange={() => setPolicy(id)} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <p className="text-sm text-muted-foreground">{calc2Policies[policy]}</p>
      <div className="space-y-3 text-sm leading-relaxed" aria-live="polite" aria-atomic="true">
        <p><strong>Preview suggestion:</strong> <span>{result.suggestion}</span>. {result.reason}</p>
        <dl className="grid gap-3 md:grid-cols-2">
          <div>
            <dt className="font-medium">A · Objective fit and tool help</dt>
            <dd>A checks whether students can justify divergence; it does not explicitly ask why a zero term limit is insufficient. {result.aTools}</dd>
          </div>
          <div>
            <dt className="font-medium">B · Evidence of reasoning and tool help</dt>
            <dd>B asks students to explain why a zero term limit is insufficient and show that the partial sums grow without bound. {result.bTools}</dd>
          </div>
        </dl>
        <p><strong>Effort versus assessment value:</strong> {result.tradeoff}</p>
      </div>
      <p className="text-sm text-muted-foreground">{!isOwner && 'Preview only. '}Switching policies does not save anything or call a paid service. The TA makes the final recommendation.</p>
    </section>
    {isOwner && <Calc2OwnerComparison key={`jev-${policy}`} policy={policy} />}
    {isOwner && <Calc2OwnerReview key={policy} policy={policy} />}
    </>
  )
}
