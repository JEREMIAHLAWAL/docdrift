import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Calc2Preview } from '../components/Calc2Preview'
import { buildCalc2PdfRequest, calc2 } from './calc2-content'

const stem = 'A student claims the harmonic series converges because 1/n → 0. Group the terms after the first into blocks ending at 2, 4, 8, ….'
const parts = [
  ['a', 2, 'Explain the flaw in the student’s claim.'],
  ['b', 3, 'Using the given grouping, explain why each block contributes at least 1/2.'],
  ['c', 1, 'Explain what this implies about the partial sums and whether the series converges.'],
] as const

function visible(markup: string) {
  return markup.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ')
}

describe('approved Calc II sample', () => {
  it('renders Question B verbatim with the total before the stem and the points on each part', () => {
    const html = visible(renderToStaticMarkup(<Calc2Preview />))
    expect(html).toContain(`6 points total${stem}`)
    for (const [label, points, prompt] of parts) {
      expect(html).toContain(`(${label}) ${points} ${points === 1 ? 'point' : 'points'}: ${prompt}`)
    }
  })

  it('uses the same labeled point values for the rubric, and rewards justification rather than inventing the grouping', () => {
    expect(calc2.questionB.parts.map(({ label, points, prompt }) => [label, points, prompt])).toEqual(parts)
    expect(calc2.questionB.parts.reduce((total, part) => total + part.points, 0)).toBe(6)
    for (const [i, criterion] of [/necessary.*not sufficient/i, /2\^\(k−1\).*2\^k.*1\/2/i, /partial sums.*diverges/i].entries()) {
      expect(calc2.questionB.parts[i].credit).toMatch(criterion)
    }
  })

  it('exports the exact approved wording, total, individual allocations, and rubric in the LaTeX request', () => {
    const { compiler, document } = buildCalc2PdfRequest({ policy: 'exam', choice: 'Assign B', reason: 'It tests the misconception.' })
    expect(compiler).toBe('pdflatex')
    expect(document).toContain('Exam Question Review')
    expect(document).toContain(String.raw`{6 points total}\par`)
    expect(document).toContain(String.raw`A student claims the harmonic series converges because $1/n\to 0$. Group the terms after the first into blocks ending at 2, 4, 8, \ldots{}.`)
    expect(document).toContain(String.raw`(a) 2 points:} Explain the flaw in the student's claim.`)
    expect(document).toContain(String.raw`(b) 3 points:} Using the given grouping, explain why each block contributes at least 1/2.`)
    expect(document).toContain(String.raw`(c) 1 point:} Explain what this implies about the partial sums and whether the series converges.`)
    expect(document).toContain('Question B scoring rubric')
    expect(document).toContain('It tests the misconception.')
  })

  it('treats a free-text recommendation as literal LaTeX text', () => {
    const { document } = buildCalc2PdfRequest({ policy: 'takeHome', choice: 'Revise', reason: 'Show 50% of $x & keep \\input{draft}_#1.' })
    expect(document).toContain(String.raw`50\% of \$x \& keep \textbackslash{}input\{draft\}\_\#1.`)
    expect(document).not.toContain(String.raw`\input{draft}`)
  })
})
