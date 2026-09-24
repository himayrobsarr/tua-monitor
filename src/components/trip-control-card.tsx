'use client'

import { LoaderCircle, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

import { createClient } from '@/lib/supabase/client'
import type { TripControlType } from '@/lib/trip-controls'
import type { Database } from '@/types/database'

type TripControl = Database['public']['Tables']['trip_controls']['Row']

type TripControlCardProps = {
  control: TripControl | null
  controlType: TripControlType
  title: string
  tripId: string
}

function formattedDateTime(value: string) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function trimmedValue(formData: FormData, field: string) {
  return String(formData.get(field) ?? '').trim()
}

export function TripControlCard({ control, controlType, title, tripId }: TripControlCardProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const isEdited = control ? new Date(control.updated_at).getTime() > new Date(control.created_at).getTime() : false

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')

    const formData = new FormData(event.currentTarget)
    const reportedLocation = trimmedValue(formData, 'reported_location')
    const incident = trimmedValue(formData, 'incident')
    const observation = trimmedValue(formData, 'observation')

    if (!reportedLocation && !incident && !observation) {
      setErrorMessage('Registra al menos ubicación, novedad u observación antes de guardar el control.')
      return
    }

    setIsSubmitting(true)
    const values = {
      reported_location: reportedLocation || null,
      incident: incident || null,
      observation: observation || null,
    }

    try {
      const supabase = createClient()
      const response = control
        ? await supabase.from('trip_controls').update(values).eq('id', control.id).eq('trip_id', tripId).select('id').single()
        : await supabase
            .from('trip_controls')
            .insert({ trip_id: tripId, control_type: controlType, reported_at: new Date().toISOString(), ...values })
            .select('id')
            .single()

      if (response.error || !response.data) {
        if (response.error?.code === '23505') {
          setErrorMessage('Este control ya fue registrado. Recarga la página para ver su información.')
        } else {
          setErrorMessage('No fue posible guardar el control. Inténtalo de nuevo.')
        }
        return
      }

      router.refresh()
    } catch {
      setErrorMessage('No fue posible conectar con el servicio. Inténtalo de nuevo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-base font-semibold text-slate-950">{title}</h3>
        {control ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Registrado</span> : <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">Pendiente</span>}
      </div>
      {control ? (
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-slate-500">Ubicación</dt><dd className="mt-1 font-medium text-slate-900">{control.reported_location ?? '—'}</dd></div>
          <div><dt className="text-slate-500">Novedad</dt><dd className="mt-1 font-medium text-slate-900">{control.incident ?? '—'}</dd></div>
          <div className="sm:col-span-2"><dt className="text-slate-500">Observación</dt><dd className="mt-1 whitespace-pre-wrap font-medium text-slate-900">{control.observation ?? '—'}</dd></div>
          <div><dt className="text-slate-500">Fecha y hora registrada</dt><dd className="mt-1 font-medium text-slate-900">{formattedDateTime(control.reported_at)}</dd></div>
          {isEdited ? <div><dt className="text-slate-500">Última actualización</dt><dd className="mt-1 font-medium text-slate-900">{formattedDateTime(control.updated_at)}</dd></div> : null}
        </dl>
      ) : <p className="mt-4 text-sm text-slate-600">Este monitoreo está pendiente de registro.</p>}
      <form onSubmit={handleSubmit} className="mt-6 border-t border-slate-200 pt-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`${controlType}-location`} className="block text-sm font-medium text-slate-700">Ubicación reportada</label>
            <input id={`${controlType}-location`} name="reported_location" defaultValue={control?.reported_location ?? ''} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" />
          </div>
          <div>
            <label htmlFor={`${controlType}-incident`} className="block text-sm font-medium text-slate-700">Novedad</label>
            <input id={`${controlType}-incident`} name="incident" defaultValue={control?.incident ?? ''} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" />
          </div>
        </div>
        <div className="mt-4">
          <label htmlFor={`${controlType}-observation`} className="block text-sm font-medium text-slate-700">Observación</label>
          <textarea id={`${controlType}-observation`} name="observation" rows={3} defaultValue={control?.observation ?? ''} className="mt-2 block w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" />
        </div>
        {errorMessage ? <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{errorMessage}</p> : null}
        <button type="submit" disabled={isSubmitting} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto">
          {isSubmitting ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
          {isSubmitting ? 'Guardando…' : control ? 'Actualizar control' : 'Registrar control'}
        </button>
      </form>
    </section>
  )
}
