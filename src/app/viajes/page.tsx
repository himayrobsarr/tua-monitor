import { Plus, Search, Truck } from 'lucide-react'
import Link from 'next/link'

import { AppShell } from '@/components/app-shell'
import { DownloadExcelButton } from '@/components/download-excel-button'
import { EmptyState } from '@/components/empty-state'
import { PageHeading } from '@/components/page-heading'
import { Pagination } from '@/components/pagination'
import { StatusBadge } from '@/components/status-badge'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUserRole } from '@/lib/roles'

const pageSize = 25

type ViajesPageProps = {
  searchParams: Promise<{ plate?: string | string[]; page?: string | string[] }>
}

export const metadata = {
  title: 'Viajes',
}

function formatLoadingDate(date: string) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(`${date}T00:00:00`))
}

function pageFromParam(value: string | string[] | undefined) {
  const page = typeof value === 'string' ? Number(value) : 1
  return Number.isSafeInteger(page) && page > 0 ? page : 1
}

export default async function ViajesPage({ searchParams }: ViajesPageProps) {
  const params = await searchParams
  const plateQuery = typeof params.plate === 'string' ? params.plate.trim().toUpperCase() : ''
  const currentPage = pageFromParam(params.page)
  const supabase = await createClient()
  const role = await getCurrentUserRole()
  const isAdmin = role === 'admin'
  let query = supabase
    .from('trips')
    .select('id, plate, driver, product, warehouse, destination, loading_date, status', { count: 'exact' })
    .eq('status', 'EN_ROUTE')
    .order('loading_date', { ascending: false })

  if (plateQuery) query = query.ilike('plate', `%${plateQuery}%`)

  const { data: trips, error, count } = await query.range((currentPage - 1) * pageSize, currentPage * pageSize - 1)

  return (
    <AppShell>
      <PageHeading
        title="Viajes"
        description="Consulta y da seguimiento a los viajes registrados por Transportadores TUA."
        action={isAdmin ? <div className="flex flex-col gap-2 sm:flex-row"><DownloadExcelButton /><Link href="/viajes/nuevo" className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"><Plus className="size-4" aria-hidden="true" />Nuevo viaje</Link></div> : undefined}
      />
      <form className="mt-6 flex flex-col gap-3 sm:flex-row" action="/viajes">
        <label htmlFor="plate-search" className="sr-only">Buscar por placa</label>
        <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden="true" /><input id="plate-search" name="plate" defaultValue={plateQuery} placeholder="Buscar por placa" className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-100" /></div>
        <button type="submit" className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Buscar</button>
      </form>
      {error ? <section role="alert" className="mt-6 rounded-xl bg-red-50 p-5 text-sm text-red-700">No fue posible cargar los viajes en ruta. Inténtalo de nuevo.</section> : trips?.length ? <>
        <div className="mt-6 hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block"><table className="min-w-full divide-y divide-slate-200 text-left text-sm"><thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Placa</th><th className="px-4 py-3">Conductor</th><th className="px-4 py-3">Producto</th><th className="px-4 py-3">Bodega</th><th className="px-4 py-3">Destino</th><th className="px-4 py-3">Fecha de cargue</th><th className="px-4 py-3">Estado</th></tr></thead><tbody className="divide-y divide-slate-100 text-slate-700">{trips.map((trip) => <tr key={trip.id}><td className="whitespace-nowrap px-4 py-4 font-semibold text-slate-950"><Link href={`/viajes/${trip.id}`} className="hover:text-blue-700 hover:underline">{trip.plate}</Link></td><td className="px-4 py-4">{trip.driver}</td><td className="px-4 py-4">{trip.product ?? '—'}</td><td className="px-4 py-4">{trip.warehouse ?? '—'}</td><td className="px-4 py-4">{trip.destination ?? '—'}</td><td className="whitespace-nowrap px-4 py-4">{formatLoadingDate(trip.loading_date)}</td><td className="px-4 py-4"><StatusBadge status={trip.status} /></td></tr>)}</tbody></table></div>
        <div className="mt-6 grid gap-4 md:hidden">{trips.map((trip) => <article key={trip.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><Link href={`/viajes/${trip.id}`} className="font-semibold text-slate-950 hover:text-blue-700 hover:underline">{trip.plate}</Link><p className="mt-1 text-sm text-slate-600">{trip.driver}</p></div><StatusBadge status={trip.status} /></div><dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 text-sm"><div><dt className="text-slate-500">Producto</dt><dd className="mt-1 font-medium text-slate-800">{trip.product ?? '—'}</dd></div><div><dt className="text-slate-500">Bodega</dt><dd className="mt-1 font-medium text-slate-800">{trip.warehouse ?? '—'}</dd></div><div><dt className="text-slate-500">Destino</dt><dd className="mt-1 font-medium text-slate-800">{trip.destination ?? '—'}</dd></div><div><dt className="text-slate-500">Fecha de cargue</dt><dd className="mt-1 font-medium text-slate-800">{formatLoadingDate(trip.loading_date)}</dd></div></dl></article>)}</div>
        <Pagination basePath="/viajes" currentPage={currentPage} pageSize={pageSize} totalItems={count ?? 0} plateQuery={plateQuery} />
      </> : <EmptyState icon={Truck} title="No hay viajes en ruta" description={plateQuery ? 'No encontramos viajes en ruta para esa placa.' : 'Crea el primer viaje para iniciar el monitoreo.'} action={!plateQuery && isAdmin ? <Link href="/viajes/nuevo" className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"><Plus className="size-4" aria-hidden="true" />Crear primer viaje</Link> : undefined} />}
    </AppShell>
  )
}
