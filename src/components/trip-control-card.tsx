'use client'

import { Clock3, LoaderCircle, Pencil, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

import { createClient } from '@/lib/supabase/client'
import { notifyError, notifySuccess } from '@/lib/notifications'
import type { Database } from '@/types/database'

type TripControl = Database['public']['Tables']['trip_controls']['Row']

function formattedDateTime(value: string) {
  return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function dateTimeLocalValue(value: string) {
  const date = new Date(value)
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return localDate.toISOString().slice(0, 16)
}

function trimmedValue(formData: FormData, field: string) {
  return String(formData.get(field) ?? '').trim()
}

export function TripControlCard({ control, isAdmin }: { control: TripControl; isAdmin: boolean }) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const isEdited = new Date(control.updated_at).getTime() > new Date(control.created_at).getTime()

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    const formData = new FormData(event.currentTarget)
    const reportedLocation = trimmedValue(formData, 'reported_location')
    const incident = trimmedValue(formData, 'incident')
    const observation = trimmedValue(formData, 'observation')
    const reportedAt = trimmedValue(formData, 'reported_at')

    if (!reportedLocation || !reportedAt) {
      const message = 'Completa la ubicación y la fecha/hora de llegada.'
      setErrorMessage(message)
      notifyError(message)
      return
    }

    setIsSubmitting(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from('trip_controls').update({ reported_location: reportedLocation, incident: incident || null, observation: observation || null, reported_at: new Date(reportedAt).toISOString() }).eq('id', control.id).eq('trip_id', control.trip_id).select('id').single()

      if (error || !data) {
        const message = 'No fue posible actualizar el control. Inténtalo de nuevo.'
        setErrorMessage(message)
        notifyError(message)
        return
      }

      notifySuccess('Control actualizado correctamente.')
      setIsEditing(false)
      router.refresh()
    } catch {
      const message = 'No fue posible conectar con el servicio. Inténtalo de nuevo.'
      setErrorMessage(message)
      notifyError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <article className="relative rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <span className="absolute -left-2 top-7 hidden size-4 rounded-full border-4 border-slate-50 bg-blue-600 lg:block" aria-hidden="true" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2 text-sm font-semibold text-blue-800"><Clock3 className="size-4" aria-hidden="true" />{formattedDateTime(control.reported_at)}</div><h3 className="mt-2 text-lg font-semibold text-slate-950">{control.reported_location ?? 'Ubicación sin registrar'}</h3></div>{isAdmin && !isEditing ? <button type="button" onClick={() => setIsEditing(true)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"><Pencil className="size-4" aria-hidden="true" />Editar</button> : null}</div>
      {!isEditing ? <><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Novedad</dt><dd className="mt-1 font-medium text-slate-900">{control.incident ?? '—'}</dd></div><div><dt className="text-slate-500">Fecha de registro</dt><dd className="mt-1 font-medium text-slate-900">{formattedDateTime(control.created_at)}</dd></div><div className="sm:col-span-2"><dt className="text-slate-500">Observación</dt><dd className="mt-1 whitespace-pre-wrap font-medium text-slate-900">{control.observation ?? '—'}</dd></div>{isEdited ? <div><dt className="text-slate-500">Última actualización</dt><dd className="mt-1 font-medium text-slate-900">{formattedDateTime(control.updated_at)}</dd></div> : null}</dl>{!isAdmin ? <p className="mt-5 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">Solo un administrador puede corregir este reporte.</p> : null}</> : <form onSubmit={handleSubmit} className="mt-6 border-t border-slate-200 pt-5" noValidate><div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor={`location-${control.id}`} className="block text-sm font-medium text-slate-700">Ubicación reportada</label><input id={`location-${control.id}`} name="reported_location" required defaultValue={control.reported_location ?? ''} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" /></div><div><label htmlFor={`reported-at-${control.id}`} className="block text-sm font-medium text-slate-700">Fecha y hora de llegada</label><input id={`reported-at-${control.id}`} name="reported_at" type="datetime-local" required defaultValue={dateTimeLocalValue(control.reported_at)} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" /></div><div className="sm:col-span-2"><label htmlFor={`incident-${control.id}`} className="block text-sm font-medium text-slate-700">Novedad</label><input id={`incident-${control.id}`} name="incident" defaultValue={control.incident ?? ''} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" /></div></div><div className="mt-4"><label htmlFor={`observation-${control.id}`} className="block text-sm font-medium text-slate-700">Observación</label><textarea id={`observation-${control.id}`} name="observation" rows={3} defaultValue={control.observation ?? ''} className="mt-2 block w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" /></div>{errorMessage ? <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{errorMessage}</p> : null}<div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={() => { setIsEditing(false); setErrorMessage('') }} disabled={isSubmitting} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cancelar</button><button type="submit" disabled={isSubmitting} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-70">{isSubmitting ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}{isSubmitting ? 'Guardando…' : 'Guardar cambios'}</button></div></form>}
    </article>
  )
}
