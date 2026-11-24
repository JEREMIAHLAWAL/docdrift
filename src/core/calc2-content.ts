import sample from './calc2-demo.v1.json' with { type: 'json' }

export const calc2 = sample
export const questionBTotal = calc2.questionB.parts.reduce((sum, { points }) => sum + points, 0)
export const pointLabel = (points: number) => `${points} ${points === 1 ? 'point' : 'points'}`

export const calc2Policies = {
  exam: 'In-person exam: non-CAS calculator allowed; AI not allowed.',
  takeHome: 'Take-home: calculator and AI allowed.',
} as const

export const calc2Choices = ['Assign A', 'Assign B', 'Revise A', 'Revise B', 'Assign neither'] as const
export type Calc2Review = {
  policy: keyof typeof calc2Policies
  choice: typeof calc2Choices[number]
  reason: string
}

const escapes: Record<string, string> = {
  '\\': String.raw`\textbackslash{}`, '{': String.raw`\{`, '}': String.raw`\}`,
  '$': String.raw`\$`, '&': String.raw`\&`, '#': String.raw`\#`, '%': String.raw`\%`,
  '_': String.raw`\_`, '^': String.raw`\textasciicircum{}`, '~': String.raw`\textasciitilde{}`,
  '‘': '`', '’': "'", '“': '``', '”': "''", '–': '--', '—': '---', '…': String.raw`\ldots{}`,
  '→': String.raw`\ensuremath{\to}`, '−': String.raw`\ensuremath{-}`, '≥': String.raw`\ensuremath{\ge}`,
  '²': String.raw`\textsuperscript{2}`,
}

function latexText(text: string) {
  return text.replace(/[\\{}$&#%_^~‘’“”–—…→−≥²]/g, (char) => escapes[char])
}

// Only the fixed, approved sample can emit math commands. Recommendations
// always go through latexText, never through the reviewed-sample substitutions.
const approvedMath: Record<string, string> = {
  '1/n → 0': String.raw`$1/n\to 0$`,
  '∑ 1/n (from n = 1 to ∞)': String.raw`$\sum_{n=1}^{\infty}1/n$`,
  'k ≥ 1': String.raw`$k\ge 1$`,
  '2^(k−1)': String.raw`$2^{k-1}$`,
  '1/2^k': String.raw`$1/2^k$`,
  '2^k': String.raw`$2^k$`,
}

function sampleText(text: string) {
  return text.split(/(1\/n → 0|∑ 1\/n \(from n = 1 to ∞\)|k ≥ 1|2\^\(k−1\)|1\/2\^k|2\^k)/g)
    .map((chunk) => Object.hasOwn(approvedMath, chunk) ? approvedMath[chunk] : latexText(chunk)).join('')
}

export function buildCalc2PdfRequest(review: {
  policy: keyof typeof calc2Policies
  choice: string
  reason: string
  isExample?: boolean
}) {
  const rubricRows = (field: 'prompt' | 'credit') => calc2.questionB.parts.map(({ label, points, [field]: text }) =>
    String.raw`\noindent\textbf{(${label}) ${pointLabel(points)}:} ${sampleText(text)}\par`,
  ).join('\n')
  return {
    compiler: 'pdflatex' as const,
    document: String.raw`\documentclass[10pt]{article}
\usepackage[margin=.8in]{geometry}
\usepackage[T1]{fontenc}
\usepackage{amsmath}
\setlength{\parskip}{.4em}
\pagestyle{empty}
\begin{document}
\section*{${latexText(calc2.title)}: Calc II}
\noindent\textit{Original demo questions. ${review.isExample ? 'Example recommendation, not a saved review.' : 'TA recommendation.'}}

\noindent\textbf{Objective:} ${latexText(calc2.objective)}

\noindent\textbf{Tool policy:} ${latexText(calc2Policies[review.policy])}

\subsection*{Question A: Direct}
\noindent ${sampleText(calc2.questionA)}

\subsection*{Question B: Explain the error}
\noindent\textbf{${pointLabel(questionBTotal)} total}\par
\noindent ${sampleText(calc2.questionB.stem)}\par
${rubricRows('prompt')}

\subsection*{Question B scoring rubric}
${rubricRows('credit')}

\noindent\textbf{${review.isExample ? 'Example TA recommendation' : 'Saved TA recommendation'}:} ${latexText(review.choice)}. ${latexText(review.reason.replace(/\s+/g, ' ').trim())}
\end{document}
`,
  }
}
