'use client'

import { LoaderCircle, Plus, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition, type FormEvent } from 'react'

import { createTripControlAction } from '@/app/viajes/actions'
import { handleTripActionFailure } from '@/lib/action-feedback'
import { colombiaLocalDateTimeToIso, toColombiaDateTimeInput } from '@/lib/dates'
import { notifySuccess } from '@/lib/notifications'
import type { ControlType, TripStatus } from '@/types/database'

function initialDateTime() {
  return toColombiaDateTimeInput(new Date())
}

type NewTripControlFormProps = {
  isAdmin: boolean
  tripId: string
  tripStatus: TripStatus
}

export function NewTripControlForm({ tripId, isAdmin, tripStatus }: NewTripControlFormProps) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState('')
  const [controlType, setControlType] = useState<ControlType>('STOP')
  const requiresReason = isAdmin && tripStatus !== 'EN_ROUTE'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    const formData = new FormData(event.currentTarget)
    const reportedLocation = String(formData.get('reported_location') ?? '').trim()
    const incident = String(formData.get('incident') ?? '').trim()
    const observation = String(formData.get('observation') ?? '').trim()
    const reportedAt = String(formData.get('reported_at') ?? '').trim()
    const reason = String(formData.get('reason') ?? '').trim()

    if (!reportedLocation) {
      const message = 'Ingresa la ubicación reportada.'
      setErrorMessage(message)
      return
    }

    if (requiresReason && !reason) {
      const message = 'Escribe el motivo para agregar un control a un viaje finalizado.'
      setErrorMessage(message)
      return
    }

    const reportedAtIso = reportedAt ? colombiaLocalDateTimeToIso(reportedAt) : null
    if (isAdmin && !reportedAtIso) {
      const message = 'Ingresa una fecha y hora válidas para el control.'
      setErrorMessage(message)
      return
    }

    startTransition(async () => {
      try {
        const result = await createTripControlAction({
          controlType,
          incident: incident || null,
          observation: observation || null,
          reason: reason || null,
          reportedAt: isAdmin ? reportedAtIso : null,
          reportedLocation,
          tripId,
        })

        if (!result.ok) {
          handleTripActionFailure(result, {
            refresh: () => router.refresh(),
            setInlineError: setErrorMessage,
          })
          return
        }

        notifySuccess(result.message)
        setIsOpen(false)
        router.refresh()
      } catch {
        const message = 'No fue posible conectar con el servicio. Inténtalo de nuevo.'
        setErrorMessage(message)
      }
    })
  }

  if (!isOpen) {
    return <button type="button" onClick={() => { setErrorMessage(''); setIsOpen(true) }} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"><Plus className="size-4" aria-hidden="true" />Registrar control</button>
  }

  return <form onSubmit={handleSubmit} className="mt-5 rounded-xl border border-blue-100 bg-blue-50/40 p-5" noValidate>
    <div>
      <h3 className="font-semibold text-slate-950">Nuevo control de ruta</h3>
      <p className="mt-1 text-sm text-slate-600">Registra una parada intermedia o la llegada final del viaje.</p>
    </div>
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="new-control-type" className="block text-sm font-medium text-slate-700">Tipo de control</label>
        <select id="new-control-type" name="control_type" value={controlType} onChange={(event) => setControlType(event.target.value as ControlType)} className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100">
          <option value="STOP">Parada</option>
          <option value="FINAL_ARRIVAL">Llegada final</option>
        </select>
      </div>
      <div>
        <label htmlFor="new-control-location" className="block text-sm font-medium text-slate-700">Ubicación reportada</label>
        <input id="new-control-location" name="reported_location" required autoFocus className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" />
      </div>
      {isAdmin ? <div>
        <label htmlFor="new-control-reported-at" className="block text-sm font-medium text-slate-700">Fecha y hora del control (Colombia)</label>
        <input id="new-control-reported-at" name="reported_at" type="datetime-local" required defaultValue={initialDateTime()} className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" />
      </div> : null}
      <div className={isAdmin ? '' : 'sm:col-span-2'}>
        <label htmlFor="new-control-incident" className="block text-sm font-medium text-slate-700">Novedad</label>
        <input id="new-control-incident" name="incident" className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" />
      </div>
    </div>
    <div className="mt-4">
      <label htmlFor="new-control-observation" className="block text-sm font-medium text-slate-700">Observación</label>
      <textarea id="new-control-observation" name="observation" rows={3} className="mt-2 block w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" />
    </div>
    {requiresReason ? <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <label htmlFor="new-control-reason" className="block text-sm font-medium text-amber-900">Motivo del registro <span aria-hidden="true">*</span></label>
      <textarea id="new-control-reason" name="reason" rows={3} required maxLength={2000} className="mt-2 block w-full resize-y rounded-lg border border-amber-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-amber-600 focus:ring-2 focus:ring-amber-100" placeholder="Explica por qué se agrega un control a este viaje finalizado" />
      <p className="mt-2 text-xs leading-5 text-amber-800">El motivo quedará guardado en la bitácora del viaje.</p>
    </div> : null}
    {errorMessage ? <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{errorMessage}</p> : null}
    <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <button type="button" onClick={() => setIsOpen(false)} disabled={isPending} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Cancelar</button>
      <button type="submit" disabled={isPending} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-70">{isPending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}{isPending ? 'Guardando…' : `Registrar ${controlType === 'STOP' ? 'parada' : 'llegada'}`}</button>
    </div>
  </form>
}
