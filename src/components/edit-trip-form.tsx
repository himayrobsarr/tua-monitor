'use client'

import { LoaderCircle, Save } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'

import { createClient } from '@/lib/supabase/client'
import { notifyError, notifySuccess } from '@/lib/notifications'
import type { Database } from '@/types/database'

type EditableTrip = Pick<
  Database['public']['Tables']['trips']['Row'],
  'id' | 'plate' | 'driver' | 'product' | 'warehouse' | 'destination' | 'loading_date' | 'observations'
>

const optionalFields = ['product', 'warehouse', 'destination', 'observations'] as const

function trimmedValue(formData: FormData, field: string) {
  return String(formData.get(field) ?? '').trim()
}

export function EditTripForm({ trip }: { trip: EditableTrip }) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')

    const formData = new FormData(event.currentTarget)
    const plate = trimmedValue(formData, 'plate').toUpperCase()
    const driver = trimmedValue(formData, 'driver')
    const loadingDate = trimmedValue(formData, 'loading_date')

    if (!plate || !driver || !loadingDate) {
      const message = 'Completa los campos obligatorios: placa, conductor y fecha de cargue.'
      setErrorMessage(message)
      notifyError(message)
      return
    }

    setIsSubmitting(true)
    const optionalValues = Object.fromEntries(
      optionalFields.map((field) => [field, trimmedValue(formData, field) || null]),
    )

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('trips')
        .update({ plate, driver, loading_date: loadingDate, ...optionalValues })
        .eq('id', trip.id)
        .select('id')
        .single()

      if (error || !data) {
        const message = 'No fue posible actualizar el viaje. Inténtalo de nuevo.'
        setErrorMessage(message)
        notifyError(message)
        return
      }

      notifySuccess('Viaje actualizado correctamente.')
      router.replace(`/viajes/${trip.id}`)
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
    <form onSubmit={handleSubmit} className="mt-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="plate" className="block text-sm font-medium text-slate-700">Placa <span aria-hidden="true">*</span></label>
          <input id="plate" name="plate" required defaultValue={trip.plate} autoCapitalize="characters" onInput={(event) => { event.currentTarget.value = event.currentTarget.value.toUpperCase() }} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 font-medium uppercase text-slate-950 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" />
        </div>
        <div>
          <label htmlFor="driver" className="block text-sm font-medium text-slate-700">Conductor <span aria-hidden="true">*</span></label>
          <input id="driver" name="driver" required defaultValue={trip.driver} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-950 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" />
        </div>
        <div>
          <label htmlFor="product" className="block text-sm font-medium text-slate-700">Producto</label>
          <input id="product" name="product" defaultValue={trip.product ?? ''} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-950 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" />
        </div>
        <div>
          <label htmlFor="warehouse" className="block text-sm font-medium text-slate-700">Bodega</label>
          <input id="warehouse" name="warehouse" defaultValue={trip.warehouse ?? ''} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-950 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" />
        </div>
        <div>
          <label htmlFor="destination" className="block text-sm font-medium text-slate-700">Destino</label>
          <input id="destination" name="destination" defaultValue={trip.destination ?? ''} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-950 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" />
        </div>
        <div>
          <label htmlFor="loading_date" className="block text-sm font-medium text-slate-700">Fecha de cargue <span aria-hidden="true">*</span></label>
          <input id="loading_date" name="loading_date" type="date" required defaultValue={trip.loading_date.slice(0, 10)} className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-950 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" />
        </div>
      </div>
      <div className="mt-5">
        <label htmlFor="observations" className="block text-sm font-medium text-slate-700">Observaciones</label>
        <textarea id="observations" name="observations" rows={4} defaultValue={trip.observations ?? ''} className="mt-2 block w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-slate-950 outline-none transition focus:border-blue-700 focus:ring-2 focus:ring-blue-100" />
      </div>
      {errorMessage ? <p role="alert" className="mt-5 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{errorMessage}</p> : null}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={`/viajes/${trip.id}`} className="inline-flex justify-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">Cancelar</Link>
        <button type="submit" disabled={isSubmitting} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-70">
          {isSubmitting ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Save className="size-4" aria-hidden="true" />}
          {isSubmitting ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}
