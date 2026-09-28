'use client'

import { Clock3, Flag, LoaderCircle, MapPin, Pencil, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition, type FormEvent } from 'react'

import { updateTripControlAction } from '@/app/viajes/actions'
import { colombiaLocalDateTimeToIso, formatColombiaDateTime, toColombiaDateTimeInput } from '@/lib/dates'
import { notifySuccess } from '@/lib/notifications'
import type { ControlType, Database, TripStatus } from '@/types/database'

type TripControl = Database['public']['Tables']['trip_controls']['Row']

function currentControlType(value: string | null): ControlType | null {
  return value === 'STOP' || value === 'FINAL_ARRIVAL' ? value : null
}

function labelFor(value: ControlType | null, legacyValue: string | null) {
  if (value === 'STOP') return 'Parada'
  if (value === 'FINAL_ARRIVAL') return 'Llegada final'
  return legacyValue ? `Control legado (${legacyValue})` : 'Control legado'
}

type TripControlCardProps = {
  control: TripControl
  isAdmin: boolean
  tripStatus: TripStatus
}

export function TripControlCard({ control, isAdmin, tripStatus }: TripControlCardProps) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState('')
  const controlType = currentControlType(control.control_type)
  const isStop = controlType !== 'FINAL_ARRIVAL'
  const requiresReason = tripStatus !== 'EN_ROUTE'

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')

    const form = new FormData(event.currentTarget)
    const selectedType = String(form.get('control_type') ?? '')
    const location = String(form.get('reported_location') ?? '').trim()
    const reportedAt = String(form.get('reported_at') ?? '').trim()
    const reason = String(form.get('reason') ?? '').trim()
    const reportedAtIso = colombiaLocalDateTimeToIso(reportedAt)

    if (selectedType !== 'STOP' && selectedType !== 'FINAL_ARRIVAL') {
      const message = 'Selecciona si el registro corresponde a una parada o una llegada final.'
      setErrorMessage(message)
      return
    }

    if (!location || !reportedAtIso) {
      const message = 'Completa la ubicación y la fecha/hora del control.'
      setErrorMessage(message)
      return
    }

    if (requiresReason && !reason) {
      const message = 'Escribe el motivo de la corrección para guardar los cambios.'
      setErrorMessage(message)
      return
    }

    startTransition(async () => {
      try {
        const result = await updateTripControlAction({
          controlId: control.id,
          controlType: selectedType,
          expectedUpdatedAt: control.updated_at,
          incident: String(form.get('incident') ?? '').trim() || null,
          observation: String(form.get('observation') ?? '').trim() || null,
          reason: reason || null,
          reportedAt: reportedAtIso,
          reportedLocation: location,
        })

        if (!result.ok) {
          setErrorMessage(result.message)
          if (result.refresh) router.refresh()
          return
        }

        notifySuccess(result.message)
        setIsEditing(false)
        router.refresh()
      } catch {
        const message = 'No fue posible conectar con el servicio. Inténtalo de nuevo.'
        setErrorMessage(message)
      }
    })
  }

  return (
    <article className="relative rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <span className={`absolute -left-2 top-7 hidden size-4 rounded-full border-4 border-slate-50 lg:block ${isStop ? 'bg-amber-500' : 'bg-emerald-600'}`} aria-hidden="true" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className={`flex items-center gap-2 text-sm font-semibold ${isStop ? 'text-amber-800' : 'text-emerald-800'}`}><Clock3 className="size-4" aria-hidden="true" />{formatColombiaDateTime(control.reported_at)}</div>
          <span className={`mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${isStop ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
            {isStop ? <MapPin className="size-3.5" aria-hidden="true" /> : <Flag className="size-3.5" aria-hidden="true" />}
            {labelFor(controlType, control.control_type)}
          </span>
          <h3 className="mt-2 text-lg font-semibold text-slate-950">{control.reported_location ?? 'Ubicación sin registrar'}</h3>
        </div>
        {isAdmin && !isEditing ? <button type="button" onClick={() => setIsEditing(true)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Pencil className="size-4" aria-hidden="true" />Editar</button> : null}
      </div>

      {!isEditing ? <>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">Novedad</dt><dd className="mt-1 font-medium text-slate-900">{control.incident ?? '—'}</dd></div>
          <div><dt className="text-slate-500">Fecha de registro</dt><dd className="mt-1 font-medium text-slate-900">{formatColombiaDateTime(control.created_at)}</dd></div>
          <div className="sm:col-span-2"><dt className="text-slate-500">Observación</dt><dd className="mt-1 whitespace-pre-wrap font-medium text-slate-900">{control.observation ?? '—'}</dd></div>
        </dl>
        {!isAdmin ? <p className="mt-5 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">Solo un administrador puede corregir este reporte.</p> : null}
      </> : <form onSubmit={handleSubmit} className="mt-6 border-t border-slate-200 pt-5" noValidate>
        {!controlType ? <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Este control usa un tipo antiguo. Selecciona su tipo actual antes de guardar; no se cambiará automáticamente.</p> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium text-slate-700">Tipo de control
            <select name="control_type" defaultValue={controlType ?? ''} required className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-950">
              <option value="" disabled>Selecciona un tipo</option>
              <option value="STOP">Parada</option>
              <option value="FINAL_ARRIVAL">Llegada final</option>
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">Ubicación reportada<input name="reported_location" required defaultValue={control.reported_location ?? ''} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-950" /></label>
          <label className="block text-sm font-medium text-slate-700">Fecha y hora del control (Colombia)<input name="reported_at" type="datetime-local" required defaultValue={toColombiaDateTimeInput(control.reported_at)} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-950" /></label>
          <label className="block text-sm font-medium text-slate-700">Novedad<input name="incident" defaultValue={control.incident ?? ''} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-950" /></label>
        </div>
        <label className="mt-4 block text-sm font-medium text-slate-700">Observación<textarea name="observation" rows={3} defaultValue={control.observation ?? ''} className="mt-2 block w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-950" /></label>
        {requiresReason ? <label className="mt-4 block rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-900">Motivo de la corrección <span aria-hidden="true">*</span><textarea name="reason" rows={3} required maxLength={2000} className="mt-2 block w-full resize-y rounded-lg border border-amber-300 bg-white px-3 py-2.5 text-sm text-slate-950" placeholder="Explica por qué se modifica este control finalizado" /></label> : null}
        {errorMessage ? <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{errorMessage}</p> : null}
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => { setIsEditing(false); setErrorMessage('') }} disabled={isPending} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancelar</button>
          <button type="submit" disabled={isPending} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-70">
            {isPending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
            {isPending ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </form>}
    </article>
  )
}
