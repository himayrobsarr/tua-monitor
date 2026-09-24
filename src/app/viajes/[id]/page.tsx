import { ArrowLeft, Pencil } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { FinishTripButton } from '@/components/finish-trip-button'
import { PageHeading } from '@/components/page-heading'
import { TripControlCard } from '@/components/trip-control-card'
import { tripControlDefinitions } from '@/lib/trip-controls'
import { createClient } from '@/lib/supabase/server'

type ViajeDetailPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ created?: string; updated?: string }>
}

export const metadata = {
  title: 'Detalle del viaje',
}

export default async function ViajeDetailPage({ params, searchParams }: ViajeDetailPageProps) {
  const { id } = await params
  const { created, updated } = await searchParams
  const supabase = await createClient()
  const [{ data: trip, error: tripError }, { data: controls, error: controlsError }] = await Promise.all([
    supabase.from('trips').select('*').eq('id', id).maybeSingle(),
    supabase.from('trip_controls').select('*').eq('trip_id', id),
  ])

  if (tripError || !trip) notFound()

  const formatDate = (date: string) => new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(`${date}T00:00:00`))
  const formatDateTime = (date: string) => new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date))
  const details = [
    ['Placa', trip.plate],
    ['Conductor', trip.driver],
    ['Producto', trip.product ?? '—'],
    ['Bodega', trip.warehouse ?? '—'],
    ['Destino', trip.destination ?? '—'],
    ['Fecha de cargue', formatDate(trip.loading_date)],
    ['Observaciones', trip.observations ?? '—'],
    ['Estado', trip.status === 'FINISHED' ? 'Finalizado' : 'En ruta'],
    ['Fecha de creación', formatDateTime(trip.created_at)],
    ['Última actualización', formatDateTime(trip.updated_at)],
  ]
  const controlsByType = new Map(controls?.map((control) => [control.control_type, control]))

  return (
    <AppShell>
      <PageHeading
        title={`Viaje ${trip.plate}`}
        description="Consulta la información registrada y administra el estado del viaje."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link href={`/viajes/${id}/editar`} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"><Pencil className="size-4" aria-hidden="true" />Editar viaje</Link>
            {trip.status === 'EN_ROUTE' ? <FinishTripButton tripId={id} /> : null}
            <Link href="/viajes" className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"><ArrowLeft className="size-4" aria-hidden="true" />Volver</Link>
          </div>
        }
      />
      {created === '1' || updated === '1' ? <p role="status" className="mt-6 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">{created === '1' ? 'El viaje fue creado correctamente.' : 'El viaje fue actualizado correctamente.'}</p> : null}
      <dl className="mt-8 grid overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:grid-cols-2">
        {details.map(([label, value]) => <div key={label} className="border-b border-slate-200 p-5 sm:even:border-l"><dt className="text-sm font-medium text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm font-semibold text-slate-900">{value}</dd></div>)}
      </dl>
      <section className="mt-8">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">Controles de monitoreo</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">Registra o actualiza los reportes de cada horario de monitoreo.</p>
        </div>
        {controlsError ? <p role="alert" className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">No fue posible cargar los controles. Inténtalo de nuevo.</p> : <div className="mt-5 grid gap-5 xl:grid-cols-3">{tripControlDefinitions.map(({ type, title }) => <TripControlCard key={type} tripId={id} controlType={type} title={title} control={controlsByType.get(type) ?? null} />)}</div>}
      </section>
    </AppShell>
  )
}
