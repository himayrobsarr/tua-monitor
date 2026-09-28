import { ArrowLeft, Pencil } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { FinishTripButton } from '@/components/finish-trip-button'
import { NewTripControlForm } from '@/components/new-trip-control-form'
import { PageHeading } from '@/components/page-heading'
import { ReopenTripButton } from '@/components/reopen-trip-button'
import { StatusBadge } from '@/components/status-badge'
import { TripControlCard } from '@/components/trip-control-card'
import { formatColombiaDateTime, formatDateOnly } from '@/lib/dates'
import { isUuid } from '@/lib/identifiers'
import { getCurrentUserRole } from '@/lib/roles'
import { createClient } from '@/lib/supabase/server'
import type { TripEventType } from '@/types/database'

type ViajeDetailPageProps = {
  params: Promise<{ id: string }>
}

export const metadata = {
  title: 'Detalle del viaje',
}

const eventLabels: Record<TripEventType, string> = {
  CONTROL_CREATED: 'Control registrado',
  CONTROL_UPDATED: 'Control corregido',
  TRIP_CREATED: 'Viaje creado',
  TRIP_FINISHED: 'Viaje finalizado',
  TRIP_REOPENED: 'Viaje reabierto',
  TRIP_UPDATED: 'Información del viaje corregida',
}

export default async function ViajeDetailPage({ params }: ViajeDetailPageProps) {
  const { id } = await params
  if (!isUuid(id)) notFound()

  const supabase = await createClient()
  const [{ data: trip, error: tripError }, { data: controls, error: controlsError }, { data: events, error: eventsError }, role] = await Promise.all([
    supabase.from('trips').select('*').eq('id', id).maybeSingle(),
    supabase.from('trip_controls').select('*').eq('trip_id', id).order('reported_at', { ascending: false }),
    supabase.from('trip_events').select('id, event_type, actor_id, actor_role, occurred_at, reason').eq('trip_id', id).order('occurred_at', { ascending: false }).order('id', { ascending: false }).limit(100),
    getCurrentUserRole(),
  ])

  if (eventsError) {
    console.error(JSON.stringify({
      level: 'error',
      event: 'trip_events_query_failed',
      code: eventsError.code ?? 'UNKNOWN',
      operation: 'select_trip_events',
    }))
  }

  if (tripError) {
    console.error(JSON.stringify({
      level: 'error',
      event: 'trip_query_failed',
      code: tripError.code ?? 'UNKNOWN',
      operation: 'select_trip',
    }))
    throw new Error('TUA_TRIP_LOAD_FAILED')
  }

  if (!trip) notFound()

  const details = [
    ['Placa', trip.plate],
    ['Conductor', trip.driver],
    ['Producto', trip.product ?? '—'],
    ['Bodega', trip.warehouse ?? '—'],
    ['Destino', trip.destination ?? '—'],
    ['Fecha de cargue', formatDateOnly(trip.loading_date)],
    ['Observaciones', trip.observations ?? '—'],
    ['Fecha de creación', formatColombiaDateTime(trip.created_at)],
    ['Última actualización', formatColombiaDateTime(trip.updated_at)],
  ]
  const isAdmin = role === 'admin'
  const isFinished = trip.status === 'FINISHED'
  const canAddControl = isAdmin || (role === 'reporter' && trip.status === 'EN_ROUTE')
  const returnHref = isFinished ? '/historial' : '/viajes'
  const returnLabel = isFinished ? 'Volver al historial' : 'Volver a viajes'

  return (
    <AppShell>
      <PageHeading
        title={`Viaje ${trip.plate}`}
        description={isAdmin ? 'Consulta la información registrada y administra el estado del viaje.' : 'Consulta la información y los controles registrados del viaje.'}
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            {isAdmin ? <Link href={`/viajes/${id}/editar`} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"><Pencil className="size-4" aria-hidden="true" />Editar viaje</Link> : null}
            {isAdmin && trip.status === 'EN_ROUTE' ? <FinishTripButton tripId={id} expectedUpdatedAt={trip.updated_at} /> : null}
            {isAdmin && isFinished ? <ReopenTripButton tripId={id} expectedUpdatedAt={trip.updated_at} /> : null}
            <Link href={returnHref} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"><ArrowLeft className="size-4" aria-hidden="true" />{returnLabel}</Link>
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
          <p className="mt-1 text-sm leading-6 text-slate-600">{canAddControl ? 'Registra las paradas intermedias y la llegada final del viaje. Los administradores pueden corregir cada control.' : 'Consulta las paradas y llegadas registradas durante el viaje.'}</p>
        </div>
        {controlsError ? <p role="alert" className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">No fue posible cargar los controles. Inténtalo de nuevo.</p> : role ? <>
          {canAddControl ? <NewTripControlForm tripId={id} isAdmin={isAdmin} tripStatus={trip.status} /> : <p role="status" className="mt-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">Este viaje ya no está en ruta y se encuentra en modo de solo lectura. Solo un administrador puede agregar o modificar controles.</p>}
          <div className="mt-5 space-y-4 border-l-2 border-slate-200 pl-0 lg:ml-2 lg:pl-6">{controls?.length ? controls.map((control) => <TripControlCard key={control.id} control={control} isAdmin={isAdmin} tripStatus={trip.status} />) : <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">Todavía no hay paradas ni llegadas registradas para este viaje.</p>}</div>
        </> : <p role="alert" className="mt-5 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">Tu usuario aún no tiene un rol asignado. Solicita a un administrador que lo configure.</p>}
      </section>
      {isAdmin ? <section className="mt-8">
        <h2 className="text-xl font-semibold tracking-tight text-slate-950">Bitácora de cambios</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">Últimos 100 eventos de acciones administrativas y controles, conservados por la base de datos.</p>
        {eventsError ? <p role="alert" className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">No fue posible cargar la bitácora. Verifica que la migración de auditoría esté aplicada.</p> : events?.length ? <ol className="mt-5 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {events.map((event) => <li key={event.id} className="p-4 sm:p-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <p className="font-semibold text-slate-950">{eventLabels[event.event_type]}</p>
              <time dateTime={event.occurred_at} className="text-xs text-slate-500">{formatColombiaDateTime(event.occurred_at)}</time>
            </div>
            <p className="mt-1 text-xs text-slate-500">Actor: {event.actor_role === 'admin' ? 'administrador' : event.actor_role ?? 'sistema'}{event.actor_id ? ` · ${event.actor_id.slice(0, 8)}` : ''}</p>
            {event.reason ? <p className="mt-3 whitespace-pre-wrap rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"><span className="font-semibold">Motivo:</span> {event.reason}</p> : null}
          </li>)}
        </ol> : <p className="mt-5 rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">Aún no hay eventos auditados para este viaje.</p>}
      </section> : null}
    </AppShell>
  )
}
