import { useEffect, useState, type FormEvent } from 'react'
import { getAuthToken } from 'deepspace'
import { calc2Choices, type Calc2Review } from '../core/calc2-content'

export async function callOwnerAction<T>(action: string, params: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const token = await getAuthToken()
  if (!token) throw new Error('Sign in as the app owner first.')
  const response = await fetch(`/api/actions/${action}`, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  })
  const result = await response.json().catch(() => null) as { success?: boolean; error?: string; data?: T } | null
  if (!response.ok || !result?.success || result.data === undefined) throw new Error(result?.error ?? `Request failed (${response.status}).`)
  return result.data
}

const message = (error: unknown) => error instanceof Error ? error.message : 'The request failed.'
const control = 'rounded-md border border-border bg-background px-3 py-2 text-sm'
const button = 'rounded-md border border-border px-3 py-2 text-sm font-medium disabled:opacity-50'

export function Calc2OwnerReview({ policy }: { policy: Calc2Review['policy'] }) {
  const [choice, setChoice] = useState<Calc2Review['choice'] | ''>('')
  const [reason, setReason] = useState('')
  const [saved, setSaved] = useState<Calc2Review | null>(null)
  const [busy, setBusy] = useState<'load' | 'save' | 'export' | null>('load')
  const [ready, setReady] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // The parent keys this component by policy so a change can't reuse an
  // earlier policy's draft, saved indicator, or billing confirmation.
  useEffect(() => {
    const abort = new AbortController()
    void callOwnerAction<{ review: Calc2Review | null }>('getCalc2Review', { policy }, abort.signal).then(({ review }) => {
      if (abort.signal.aborted) return
      setSaved(review)
      setChoice(review?.choice ?? '')
      setReason(review?.reason ?? '')
      setReady(true)
    }).catch((err: unknown) => { if (!abort.signal.aborted) setError(message(err)) })
      .finally(() => { if (!abort.signal.aborted) setBusy(null) })
    return () => abort.abort()
  }, [policy])

  const edited = saved?.choice !== choice || saved?.reason !== reason.replace(/\s+/g, ' ').trim()
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!ready || busy || !choice || !reason.trim()) return
    setBusy('save'); setError(''); setNotice(''); setConfirm(false)
    try {
      const review = await callOwnerAction<Calc2Review>('saveCalc2Review', { policy, choice, reason })
      setSaved(review); setChoice(review.choice); setReason(review.reason)
      setNotice('Recommendation saved.')
    } catch (err) { setError(message(err)) } finally { setBusy(null) }
  }

  async function exportPdf() {
    if (!saved || !confirm || edited || busy) return
    setBusy('export'); setError(''); setNotice(''); setConfirm(false)
    try {
      const data = await callOwnerAction<{ pdfBase64: string }>('exportCalc2Review', { policy, confirmBilling: true })
      const bytes = Uint8Array.from(atob(data.pdfBase64), (char) => char.charCodeAt(0))
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `exam-question-review-${policy}.pdf`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
      setNotice('PDF generated from your saved recommendation.')
    } catch (err) { setError(message(err)) } finally { setBusy(null) }
  }

  return (
    <section aria-labelledby="calc2-owner-review" className="space-y-4 rounded-lg border border-border p-4">
      <h2 id="calc2-owner-review" className="font-semibold">TA recommendation</h2>
      <p className="text-sm text-muted-foreground">Saved separately for each tool policy. Changes are private to the app owner.</p>
      {busy === 'load' && <p role="status" className="text-sm">Loading saved recommendation…</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="text-sm">{notice}</p>}
      <form onSubmit={save} className="space-y-3">
        <label className="grid gap-1 text-sm">Recommendation
          <select className={control} required disabled={!ready || !!busy} value={choice} onChange={(e) => { setChoice(e.target.value as typeof choice); setConfirm(false) }}>
            <option value="">Choose a recommendation</option>
            {calc2Choices.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-sm">Reason
          <textarea className={control} required rows={3} maxLength={300} disabled={!ready || !!busy} value={reason} onChange={(e) => { setReason(e.target.value); setConfirm(false) }} />
        </label>
        <button type="submit" className={button} disabled={!ready || !!busy || !choice || !reason.trim() || !edited}>Save recommendation</button>
      </form>
      {saved && (edited ? <p className="text-sm">Save your changes before exporting.</p> : (
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={confirm} disabled={!!busy} onChange={(e) => setConfirm(e.target.checked)} />
            Confirm one billed LaTeX compile
          </label>
          <button type="button" className={button} disabled={!confirm || !!busy} onClick={exportPdf}>Export saved PDF</button>
          {busy === 'export' && <p role="status" className="text-sm">Compiling the saved review…</p>}
        </div>
      ))}
    </section>
  )
}
