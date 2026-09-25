import { Archive, Search } from 'lucide-react'
import Link from 'next/link'

import { AppShell } from '@/components/app-shell'
import { DownloadExcelButton } from '@/components/download-excel-button'
import { EmptyState } from '@/components/empty-state'
import { PageHeading } from '@/components/page-heading'
import { Pagination } from '@/components/pagination'
import { ReopenTripButton } from '@/components/reopen-trip-button'
import { StatusBadge } from '@/components/status-badge'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserRole } from '@/lib/roles'

const pageSize = 25

type HistorialPageProps = {
  searchParams: Promise<{ plate?: string | string[]; page?: string | string[]; from?: string | string[]; to?: string | string[] }>
}

export const metadata = {
  title: 'Historial',
}

function formatLoadingDate(date: string) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(`${date}T00:00:00`))
}

function formatDateTime(date: string | null) {
  return date ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date)) : '—'
}

function pageFromParam(value: string | string[] | undefined) {
  const page = typeof value === 'string' ? Number(value) : 1
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

function dateFromParam(value: string | string[] | undefined) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return ''

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? value : ''
}

function startOfColombiaDay(date: string) {
  return `${date}T00:00:00-05:00`
}

function nextCalendarDay(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  const nextDate = new Date(Date.UTC(year, month - 1, day + 1))
  return nextDate.toISOString().slice(0, 10)
}

export default async function HistorialPage({ searchParams }: HistorialPageProps) {
  const params = await searchParams
  const plateQuery = typeof params.plate === 'string' ? params.plate.trim().toUpperCase() : ''
  const rawFrom = typeof params.from === 'string' ? params.from : ''
  const rawTo = typeof params.to === 'string' ? params.to : ''
  const finishedFrom = dateFromParam(params.from)
  const finishedTo = dateFromParam(params.to)
  const rangeError = Boolean((rawFrom && !finishedFrom) || (rawTo && !finishedTo) || (finishedFrom && finishedTo && finishedFrom > finishedTo))
  const currentPage = pageFromParam(params.page)
  const supabase = await createClient()
  const isAdmin = (await getCurrentUserRole()) === 'admin'
  let query = supabase
    .from('trips')
    .select('id, plate, driver, product, warehouse, destination, loading_date, finished_at, status', { count: 'exact' })
    .eq('status', 'FINISHED')
    .order('finished_at', { ascending: false })

  if (plateQuery) query = query.ilike('plate', `%${plateQuery}%`)
  if (finishedFrom) query = query.gte('finished_at', startOfColombiaDay(finishedFrom))
  if (finishedTo) query = query.lt('finished_at', startOfColombiaDay(nextCalendarDay(finishedTo)))

  const { data: trips, error, count } = rangeError
    ? { data: [], error: null, count: 0 }
    : await query.range((currentPage - 1) * pageSize, currentPage * pageSize - 1)

  return (
    <AppShell>
      <PageHeading title="Historial" description="Consulta los viajes finalizados y corrige su información cuando sea necesario." action={isAdmin && (finishedFrom || finishedTo) && !rangeError ? <DownloadExcelButton finishedFrom={finishedFrom || undefined} finishedTo={finishedTo || undefined} /> : undefined} />
      <form className="mt-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_11rem_11rem_auto_auto] lg:items-end" action="/historial">
        <div>
          <label htmlFor="plate-search" className="mb-2 block text-sm font-medium text-slate-700">Placa</label>
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input id="plate-search" name="plate" defaultValue={plateQuery} placeholder="Buscar por placa" className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-100" /></div>
        </div>
        <div><label htmlFor="finished-from" className="mb-2 block text-sm font-medium text-slate-700">Finalizado desde</label><input id="finished-from" name="from" type="date" defaultValue={finishedFrom} className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" /></div>
        <div><label htmlFor="finished-to" className="mb-2 block text-sm font-medium text-slate-700">Finalizado hasta</label><input id="finished-to" name="to" type="date" defaultValue={finishedTo} className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" /></div>
        <button type="submit" className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Aplicar filtros</button>
        {(plateQuery || finishedFrom || finishedTo) ? <Link href="/historial" className="inline-flex justify-center rounded-lg px-4 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50">Limpiar</Link> : null}
      </form>
      {rangeError ? <section role="alert" className="mt-6 rounded-xl bg-red-50 p-5 text-sm text-red-700">El rango de fechas no es válido. Verifica que la fecha inicial sea anterior o igual a la fecha final.</section> : error ? <section role="alert" className="mt-6 rounded-xl bg-red-50 p-5 text-sm text-red-700">No fue posible cargar el historial. Inténtalo de nuevo.</section> : trips?.length ? <>
        <div className="mt-6 hidden overflow-x-auto rounded-xl border border-slate-200 bg-white lg:block"><table className="min-w-full divide-y divide-slate-200 text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Placa</th><th className="px-4 py-3">Conductor</th><th className="px-4 py-3">Producto</th><th className="px-4 py-3">Bodega</th><th className="px-4 py-3">Destino</th><th className="px-4 py-3">Fecha de cargue</th><th className="px-4 py-3">Fecha de finalización</th><th className="px-4 py-3"><span className="sr-only">Acciones</span></th></tr></thead><tbody className="divide-y divide-slate-100 text-slate-700">{trips.map((trip) => <tr key={trip.id}><td className="whitespace-nowrap px-4 py-4 font-semibold text-slate-950">{trip.plate}</td><td className="px-4 py-4">{trip.driver}</td><td className="px-4 py-4">{trip.product ?? '—'}</td><td className="px-4 py-4">{trip.warehouse ?? '—'}</td><td className="px-4 py-4">{trip.destination ?? '—'}</td><td className="whitespace-nowrap px-4 py-4">{formatLoadingDate(trip.loading_date)}</td><td className="whitespace-nowrap px-4 py-4">{formatDateTime(trip.finished_at)}</td><td className="px-4 py-4"><div className="flex items-center justify-end gap-2"><Link href={`/viajes/${trip.id}`} className="text-sm font-semibold text-blue-700 hover:text-blue-800">Abrir viaje</Link>{isAdmin ? <><Link href={`/viajes/${trip.id}/editar`} className="text-sm font-semibold text-slate-700 hover:text-slate-950">Editar viaje</Link><ReopenTripButton tripId={trip.id} /></> : null}</div></td></tr>)}</tbody></table></div>
        <div className="mt-6 grid gap-4 lg:hidden">{trips.map((trip) => <article key={trip.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-950">{trip.plate}</p><p className="mt-1 text-sm text-slate-600">{trip.driver}</p></div><StatusBadge status={trip.status} /></div><dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-sm"><div><dt className="text-slate-500">Producto</dt><dd className="mt-1 font-medium text-slate-800">{trip.product ?? '—'}</dd></div><div><dt className="text-slate-500">Bodega</dt><dd className="mt-1 font-medium text-slate-800">{trip.warehouse ?? '—'}</dd></div><div><dt className="text-slate-500">Destino</dt><dd className="mt-1 font-medium text-slate-800">{trip.destination ?? '—'}</dd></div><div><dt className="text-slate-500">Fecha de cargue</dt><dd className="mt-1 font-medium text-slate-800">{formatLoadingDate(trip.loading_date)}</dd></div><div className="col-span-2"><dt className="text-slate-500">Fecha de finalización</dt><dd className="mt-1 font-medium text-slate-800">{formatDateTime(trip.finished_at)}</dd></div></dl><div className="mt-5 flex flex-col gap-2 sm:flex-row"><Link href={`/viajes/${trip.id}`} className="inline-flex justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Abrir viaje</Link>{isAdmin ? <><Link href={`/viajes/${trip.id}/editar`} className="inline-flex justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Editar viaje</Link><ReopenTripButton tripId={trip.id} /></> : null}</div></article>)}</div>
        <Pagination basePath="/historial" currentPage={currentPage} pageSize={pageSize} totalItems={count ?? 0} plateQuery={plateQuery} finishedFrom={finishedFrom || undefined} finishedTo={finishedTo || undefined} />
      </> : <EmptyState icon={Archive} title="No hay viajes finalizados" description={plateQuery || finishedFrom || finishedTo ? 'No encontramos viajes finalizados para los filtros seleccionados.' : 'Los viajes que finalices aparecerán aquí.'} action={!plateQuery && !finishedFrom && !finishedTo ? <Link href="/viajes" className="inline-flex justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Ver viajes activos</Link> : undefined} />}
    </AppShell>
  )
}
