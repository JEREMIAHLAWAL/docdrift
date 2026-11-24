import { calc2, pointLabel, questionBTotal } from '../core/calc2-content'

export function Calc2Preview() {
  return (
    <>
      <section className="grid gap-4 md:grid-cols-2" aria-label="Compare questions">
        <article className="flex flex-col gap-2 rounded-lg border border-border p-4">
          <h2 className="font-semibold">Question A: Direct</h2>
          <p className="text-sm leading-relaxed">{calc2.questionA}</p>
        </article>
        <article className="flex flex-col gap-2 rounded-lg border border-border p-4">
          <h2 className="font-semibold">Question B: Explain the error</h2>
          <p className="text-sm font-semibold">{pointLabel(questionBTotal)} total</p>
          <p className="text-sm leading-relaxed">{calc2.questionB.stem}</p>
          <ul className="space-y-2 text-sm leading-relaxed">
            {calc2.questionB.parts.map(({ label, points, prompt }) => (
              <li key={label}><strong>({label}) {pointLabel(points)}:</strong> {prompt}</li>
            ))}
          </ul>
        </article>
      </section>
      <details className="rounded-lg border border-border p-4">
        <summary className="cursor-pointer font-semibold">Question B scoring rubric</summary>
        <ul className="mt-3 space-y-2 text-sm leading-relaxed">
          {calc2.questionB.parts.map(({ label, points, credit }) => (
            <li key={label}><strong>({label}) {pointLabel(points)}:</strong> {credit}</li>
          ))}
        </ul>
      </details>
    </>
  )
}
