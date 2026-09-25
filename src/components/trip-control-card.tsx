'use client'

import { Clock3, Flag, LoaderCircle, MapPin, Pencil, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { notifyError, notifySuccess } from '@/lib/notifications'
import type { Database } from '@/types/database'

type TripControl = Database['public']['Tables']['trip_controls']['Row']
type ControlType = 'STOP' | 'FINAL_ARRIVAL'
const typeFor = (value: string | null): ControlType => value === 'STOP' ? 'STOP' : 'FINAL_ARRIVAL'
const labelFor = (value: ControlType) => value === 'STOP' ? 'Parada' : 'Llegada final'
const formatDateTime = (value: string) => new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
const localDateTime = (value: string) => { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16) }

export function TripControlCard({ control, isAdmin }: { control: TripControl; isAdmin: boolean }) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const controlType = typeFor(control.control_type)
  const isStop = controlType === 'STOP'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    const form = new FormData(event.currentTarget)
    const location = String(form.get('reported_location') ?? '').trim()
    const reportedAt = String(form.get('reported_at') ?? '').trim()
    if (!location || !reportedAt) {
      const message = 'Completa la ubicación y la fecha/hora del control.'
      setErrorMessage(message); notifyError(message); return
    }
    setIsSubmitting(true)
    try {
      const { data, error } = await createClient().from('trip_controls').update({
        control_type: String(form.get('control_type')) as ControlType,
        reported_location: location,
        incident: String(form.get('incident') ?? '').trim() || null,
        observation: String(form.get('observation') ?? '').trim() || null,
        reported_at: new Date(reportedAt).toISOString(),
      }).eq('id', control.id).eq('trip_id', control.trip_id).select('id').single()
      if (error || !data) throw new Error('update failed')
      notifySuccess('Control actualizado correctamente.')
      setIsEditing(false); router.refresh()
    } catch {
      const message = 'No fue posible actualizar el control. Inténtalo de nuevo.'
      setErrorMessage(message); notifyError(message)
    } finally { setIsSubmitting(false) }
  }

  return <article className="relative rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
    <span className={`absolute -left-2 top-7 hidden size-4 rounded-full border-4 border-slate-50 lg:block ${isStop ? 'bg-amber-500' : 'bg-emerald-600'}`} aria-hidden="true" />
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className={`flex items-center gap-2 text-sm font-semibold ${isStop ? 'text-amber-800' : 'text-emerald-800'}`}><Clock3 className="size-4" aria-hidden="true" />{formatDateTime(control.reported_at)}</div><span className={`mt-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${isStop ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{isStop ? <MapPin className="size-3.5" aria-hidden="true" /> : <Flag className="size-3.5" aria-hidden="true" />}{labelFor(controlType)}</span><h3 className="mt-2 text-lg font-semibold text-slate-950">{control.reported_location ?? 'Ubicación sin registrar'}</h3></div>{isAdmin && !isEditing ? <button type="button" onClick={() => setIsEditing(true)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Pencil className="size-4" aria-hidden="true" />Editar</button> : null}</div>
    {!isEditing ? <><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Novedad</dt><dd className="mt-1 font-medium text-slate-900">{control.incident ?? '—'}</dd></div><div><dt className="text-slate-500">Fecha de registro</dt><dd className="mt-1 font-medium text-slate-900">{formatDateTime(control.created_at)}</dd></div><div className="sm:col-span-2"><dt className="text-slate-500">Observación</dt><dd className="mt-1 whitespace-pre-wrap font-medium text-slate-900">{control.observation ?? '—'}</dd></div></dl>{!isAdmin ? <p className="mt-5 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">Solo un administrador puede corregir este reporte.</p> : null}</> : <form onSubmit={handleSubmit} className="mt-6 border-t border-slate-200 pt-5" noValidate><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium text-slate-700">Tipo de control<select name="control_type" defaultValue={controlType} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-950"><option value="STOP">Parada</option><option value="FINAL_ARRIVAL">Llegada final</option></select></label><label className="block text-sm font-medium text-slate-700">Ubicación reportada<input name="reported_location" required defaultValue={control.reported_location ?? ''} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-950" /></label><label className="block text-sm font-medium text-slate-700">Fecha y hora del control<input name="reported_at" type="datetime-local" required defaultValue={localDateTime(control.reported_at)} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-950" /></label><label className="block text-sm font-medium text-slate-700">Novedad<input name="incident" defaultValue={control.incident ?? ''} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-950" /></label></div><label className="mt-4 block text-sm font-medium text-slate-700">Observación<textarea name="observation" rows={3} defaultValue={control.observation ?? ''} className="mt-2 block w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-950" /></label>{errorMessage ? <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{errorMessage}</p> : null}<div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={() => { setIsEditing(false); setErrorMessage('') }} disabled={isSubmitting} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancelar</button><button type="submit" disabled={isSubmitting} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-70">{isSubmitting ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}{isSubmitting ? 'Guardando…' : 'Guardar cambios'}</button></div></form>}
  </article>
}
