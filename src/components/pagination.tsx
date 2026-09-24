import { ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'

type PaginationProps = {
  basePath: '/viajes' | '/historial'
  currentPage: number
  pageSize: number
  totalItems: number
  plateQuery: string
}

export function Pagination({ basePath, currentPage, pageSize, totalItems, plateQuery }: PaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize)
  if (totalPages <= 1) return null

  function href(page: number) {
    const params = new URLSearchParams()
    if (plateQuery) params.set('plate', plateQuery)
    if (page > 1) params.set('page', String(page))
    const search = params.toString()
    return search ? `${basePath}?${search}` : basePath
  }

  return (
    <nav aria-label="Paginación" className="mt-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="px-2 text-slate-600">Página {currentPage} de {totalPages} · {totalItems} registros</p>
      <div className="flex gap-2">
        {currentPage > 1 ? <Link href={href(currentPage - 1)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-50"><ChevronLeft className="size-4" aria-hidden="true" />Anterior</Link> : <span className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-400"><ChevronLeft className="size-4" aria-hidden="true" />Anterior</span>}
        {currentPage < totalPages ? <Link href={href(currentPage + 1)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-700 transition hover:bg-slate-50">Siguiente<ChevronRight className="size-4" aria-hidden="true" /></Link> : <span className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-400">Siguiente<ChevronRight className="size-4" aria-hidden="true" /></span>}
      </div>
    </nav>
  )
}
