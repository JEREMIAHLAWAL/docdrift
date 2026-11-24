import { Calc2PolicyReview } from '@/components/Calc2PolicyReview'
import { Calc2Preview } from '@/components/Calc2Preview'
import { calc2 } from '@/core/calc2-content'

export default function CasePage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-8 text-foreground">
      <header className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Calc II · Original demo</p>
        <h1 className="text-2xl font-semibold">{calc2.title}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          <strong>Learning objective:</strong> {calc2.objective}
        </p>
      </header>
      <Calc2Preview />
      <Calc2PolicyReview />
    </main>
  )
}