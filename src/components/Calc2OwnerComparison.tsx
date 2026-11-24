import { useEffect, useState } from 'react'
import { calc2JevLabelText, type Calc2Analysis } from '../core/calc2-analysis'
import type { Calc2Review } from '../core/calc2-content'
import { callOwnerAction } from './Calc2OwnerReview'

const message = (error: unknown) => error instanceof Error ? error.message : 'The request failed.'
const button = 'rounded-md border border-border px-3 py-2 text-sm font-medium disabled:opacity-50'
const short = (sha: string) => sha.slice(0, 7)

/** Owner-only: fetch the versioned sample from GitHub and ask Jev, on an explicit billed action. */
export function Calc2OwnerComparison({ policy }: { policy: Calc2Review['policy'] }) {
  const [analysis, setAnalysis] = useState<Calc2Analysis | null>(null)
  const [busy, setBusy] = useState<'load' | 'run' | null>('load')
  const [ready, setReady] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const abort = new AbortController()
    void callOwnerAction<{ analysis: Calc2Analysis | null }>('getCalc2Analysis', { policy }, abort.signal)
      .then(({ analysis }) => { if (!abort.signal.aborted) { setAnalysis(analysis); setReady(true) } })
      .catch((err: unknown) => { if (!abort.signal.aborted) setError(message(err)) })
      .finally(() => { if (!abort.signal.aborted) setBusy(null) })
    return () => abort.abort()
  }, [policy])

  async function run() {
    if (!ready || !confirm || busy) return
    setBusy('run'); setError(''); setConfirm(false)
    try {
      const data = await callOwnerAction<{ analysis: Calc2Analysis }>('analyzeCalc2', { policy, confirmBilling: true })
      setAnalysis(data.analysis)
    } catch (err) { setError(message(err)) } finally { setBusy(null) }
  }

  return (
    <section aria-labelledby="calc2-model-comparison" className="space-y-3 rounded-lg border border-border p-4 text-sm">
      <h2 id="calc2-model-comparison" className="font-semibold">Model comparison (Jev)</h2>
      <p className="text-muted-foreground">Fetches the versioned sample from GitHub, then asks Jev which recommendation fits this policy. A model suggestion only; the TA decides.</p>
      {busy === 'load' && <p role="status">Loading saved comparison…</p>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {ready && (analysis ? (
        <p data-testid="calc2-jev-result">
          <strong>Jev suggestion:</strong> {calc2JevLabelText[analysis.label]} · {analysis.model} · sample {analysis.sampleVersion} fetched from GitHub at commit {short(analysis.sampleRef)} (blob {short(analysis.sampleBlobSha)}) · {new Date(analysis.capturedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
      ) : <p>No model comparison saved for this policy yet.</p>)}
      {ready && (
        <div className="space-y-2">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={confirm} disabled={!!busy} onChange={(e) => setConfirm(e.target.checked)} />
            Confirm one billed GitHub fetch and one Jev call (about $0.003)
          </label>
          <button type="button" className={button} disabled={!confirm || !!busy} onClick={run}>Run Jev comparison</button>
          {busy === 'run' && <p role="status">Fetching the sample and comparing…</p>}
        </div>
      )}
    </section>
  )
}
