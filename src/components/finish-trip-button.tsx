'use client'

import { CheckCircle2, LoaderCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { createClient } from '@/lib/supabase/client'

export function FinishTripButton({ tripId }: { tripId: string }) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleFinish() {
    const isConfirmed = window.confirm('¿Confirmas que deseas finalizar este viaje? Esta acción lo moverá al historial.')
    if (!isConfirmed) return

    setErrorMessage('')
    setIsSubmitting(true)

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('trips')
        .update({ status: 'FINISHED', finished_at: new Date().toISOString() })
        .eq('id', tripId)
        .select('id')
        .single()

      if (error || !data) {
        setErrorMessage('No fue posible finalizar el viaje. Inténtalo de nuevo.')
        return
      }

      router.replace('/historial?finished=1')
      router.refresh()
    } catch {
      setErrorMessage('No fue posible conectar con el servicio. Inténtalo de nuevo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <button type="button" onClick={handleFinish} disabled={isSubmitting} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto">
        {isSubmitting ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="size-4" aria-hidden="true" />}
        {isSubmitting ? 'Finalizando…' : 'Finalizar viaje'}
      </button>
      {errorMessage ? <p role="alert" className="mt-3 text-sm text-red-700">{errorMessage}</p> : null}
    </div>
  )
}
