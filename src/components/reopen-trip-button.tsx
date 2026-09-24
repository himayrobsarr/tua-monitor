'use client'

import { LoaderCircle, RotateCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { createClient } from '@/lib/supabase/client'

export function ReopenTripButton({ tripId }: { tripId: string }) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleReopen() {
    if (!window.confirm('¿Confirmas que deseas reabrir este viaje? Volverá a aparecer entre los viajes activos.')) return

    setErrorMessage('')
    setIsSubmitting(true)

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('trips')
        .update({ status: 'EN_ROUTE', finished_at: null })
        .eq('id', tripId)
        .select('id')
        .single()

      if (error || !data) {
        setErrorMessage('No fue posible reabrir el viaje. Inténtalo de nuevo.')
        return
      }

      router.replace('/historial?reopened=1')
      router.refresh()
    } catch {
      setErrorMessage('No fue posible conectar con el servicio. Inténtalo de nuevo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <button type="button" onClick={handleReopen} disabled={isSubmitting} className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70">
        {isSubmitting ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <RotateCcw className="size-4" aria-hidden="true" />}
        {isSubmitting ? 'Reabriendo…' : 'Reabrir viaje'}
      </button>
      {errorMessage ? <p role="alert" className="mt-2 text-sm text-red-700">{errorMessage}</p> : null}
    </div>
  )
}
