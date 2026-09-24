'use client'

import { LoaderCircle, RotateCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { ConfirmationDialog } from '@/components/confirmation-dialog'
import { createClient } from '@/lib/supabase/client'
import { notifyError, notifySuccess } from '@/lib/notifications'

export function ReopenTripButton({ tripId }: { tripId: string }) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleReopen() {
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
        const message = 'No fue posible reabrir el viaje. Inténtalo de nuevo.'
        setErrorMessage(message)
        notifyError(message)
        return
      }

      notifySuccess('Viaje reabierto correctamente.')
      router.replace('/historial')
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
    <div>
      <button type="button" onClick={() => setIsDialogOpen(true)} disabled={isSubmitting} className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70">
        {isSubmitting ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <RotateCcw className="size-4" aria-hidden="true" />}
        {isSubmitting ? 'Reabriendo…' : 'Reabrir viaje'}
      </button>
      {errorMessage ? <p role="alert" className="mt-2 text-sm text-red-700">{errorMessage}</p> : null}
      <ConfirmationDialog
        isOpen={isDialogOpen}
        title="¿Reabrir viaje?"
        description="El viaje volverá a aparecer entre los viajes activos. Los controles existentes se conservarán."
        confirmLabel="Sí, reabrir viaje"
        tone="amber"
        isConfirming={isSubmitting}
        onCancel={() => setIsDialogOpen(false)}
        onConfirm={handleReopen}
      />
    </div>
  )
}
