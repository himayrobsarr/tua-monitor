'use client'

import { LoaderCircle, Plus, Save } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

import { createClient } from '@/lib/supabase/client'
import { notifyError, notifySuccess } from '@/lib/notifications'

function initialDateTime() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

export function NewTripControlForm({ tripId, isAdmin }: { tripId: string; isAdmin: boolean }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    const formData = new FormData(event.currentTarget)
    const reportedLocation = String(formData.get('reported_location') ?? '').trim()
    const incident = String(formData.get('incident') ?? '').trim()
    const observation = String(formData.get('observation') ?? '').trim()
    const reportedAt = String(formData.get('reported_at') ?? '').trim()

    if (!reportedLocation) {
      const message = 'Ingresa la ubicación reportada.'
      setErrorMessage(message)
      notifyError(message)
      return
    }

    setIsSubmitting(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from('trip_controls').insert({ trip_id: tripId, reported_location: reportedLocation, incident: incident || null, observation: observation || null, ...(isAdmin && reportedAt ? { reported_at: new Date(reportedAt).toISOString() } : {}) }).select('id').single()

      if (error || !data) {
        const message = 'No fue posible registrar la llegada. Inténtalo de nuevo.'
        setErrorMessage(message)
        notifyError(message)
        return
      }

      notifySuccess('Llegada registrada correctamente.')
      setIsOpen(false)
      router.refresh()
    } catch {
      const message = 'No fue posible conectar con el servicio. Inténtalo de nuevo.'
      setErrorMessage(message)
      notifyError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return <button type="button" onClick={() => setIsOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"><Plus className="size-4" aria-hidden="true" />Registrar llegada</button>

  return <form onSubmit={handleSubmit} className="mt-5 rounded-xl border border-blue-100 bg-blue-50/40 p-5" noValidate><div><h3 className="font-semibold text-slate-950">Nueva llegada</h3><p className="mt-1 text-sm text-slate-600">{isAdmin ? 'Registra o corrige la hora real de llegada.' : 'La hora del reporte se registrará automáticamente.'}</p></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><div><label htmlFor="new-control-location" className="block text-sm font-medium text-slate-700">Ubicación reportada</label><input id="new-control-location" name="reported_location" required autoFocus className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" /></div>{isAdmin ? <div><label htmlFor="new-control-reported-at" className="block text-sm font-medium text-slate-700">Fecha y hora de llegada</label><input id="new-control-reported-at" name="reported_at" type="datetime-local" required defaultValue={initialDateTime()} className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" /></div> : null}<div className={isAdmin ? 'sm:col-span-2' : ''}><label htmlFor="new-control-incident" className="block text-sm font-medium text-slate-700">Novedad</label><input id="new-control-incident" name="incident" className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" /></div></div><div className="mt-4"><label htmlFor="new-control-observation" className="block text-sm font-medium text-slate-700">Observación</label><textarea id="new-control-observation" name="observation" rows={3} className="mt-2 block w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" /></div>{errorMessage ? <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{errorMessage}</p> : null}<div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={() => setIsOpen(false)} disabled={isSubmitting} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700">Cancelar</button><button type="submit" disabled={isSubmitting} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-70">{isSubmitting ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}{isSubmitting ? 'Guardando…' : 'Registrar llegada'}</button></div></form>
}
