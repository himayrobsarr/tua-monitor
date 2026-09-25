import { ArrowLeft, Pencil } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { FinishTripButton } from '@/components/finish-trip-button'
import { NewTripControlForm } from '@/components/new-trip-control-form'
import { PageHeading } from '@/components/page-heading'
import { StatusBadge } from '@/components/status-badge'
import { TripControlCard } from '@/components/trip-control-card'
import { getCurrentUserRole } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'

type ViajeDetailPageProps = {
  params: Promise<{ id: string }>
}

export const metadata = {
  title: 'Detalle del viaje',
}

export default async function ViajeDetailPage({ params }: ViajeDetailPageProps) {
  const { id } = await params
  const supabase = await createClient()
  const [{ data: trip, error: tripError }, { data: controls, error: controlsError }, role] = await Promise.all([
    supabase.from('trips').select('*').eq('id', id).maybeSingle(),
    supabase.from('trip_controls').select('*').eq('trip_id', id).order('reported_at', { ascending: false }),
    getCurrentUserRole(),
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
    ['Fecha de creación', formatDateTime(trip.created_at)],
    ['Última actualización', formatDateTime(trip.updated_at)],
  ]
  const isAdmin = role === 'admin'

  return (
    <AppShell>
      <PageHeading
        title={`Viaje ${trip.plate}`}
        description="Consulta la información registrada y administra el estado del viaje."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            {isAdmin ? <Link href={`/viajes/${id}/editar`} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"><Pencil className="size-4" aria-hidden="true" />Editar viaje</Link> : null}
            {isAdmin && trip.status === 'EN_ROUTE' ? <FinishTripButton tripId={id} /> : null}
            <Link href="/viajes" className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"><ArrowLeft className="size-4" aria-hidden="true" />Volver</Link>
          </div>
        }
      />
      <dl className="mt-8 grid overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:grid-cols-2">
        {details.map(([label, value]) => <div key={label} className="border-b border-slate-200 p-5 sm:even:border-l"><dt className="text-sm font-medium text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm font-semibold text-slate-900">{value}</dd></div>)}
        <div className="border-b border-slate-200 p-5 sm:even:border-l"><dt className="text-sm font-medium text-slate-500">Estado</dt><dd className="mt-1"><StatusBadge status={trip.status} /></dd></div>
      </dl>
      <section className="mt-8">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-950">Controles de monitoreo</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">Registra las paradas intermedias y la llegada final del viaje. Los administradores pueden corregir cada control.</p>
        </div>
        {controlsError ? <p role="alert" className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">No fue posible cargar los controles. Inténtalo de nuevo.</p> : role ? <><NewTripControlForm tripId={id} isAdmin={isAdmin} /><div className="mt-5 space-y-4 border-l-2 border-slate-200 pl-0 lg:ml-2 lg:pl-6">{controls?.length ? controls.map((control) => <TripControlCard key={control.id} control={control} isAdmin={isAdmin} />) : <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">Todavía no hay paradas ni llegadas registradas para este viaje.</p>}</div></> : <p role="alert" className="mt-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">Tu usuario aún no tiene un rol asignado. Solicita a un administrador que lo configure.</p>}
      </section>
    </AppShell>
  )
}
