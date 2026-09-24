import { CheckCircle2, CircleDotDashed } from 'lucide-react'

export function StatusBadge({ status }: { status: string }) {
  const isFinished = status === 'FINISHED'

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${isFinished ? 'bg-slate-100 text-slate-700' : 'bg-blue-50 text-blue-700'}`}>
      {isFinished ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : <CircleDotDashed className="size-3.5" aria-hidden="true" />}
      {isFinished ? 'Finalizado' : 'En ruta'}
    </span>
  )
}
