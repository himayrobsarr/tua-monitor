'use client'

import { LoaderCircle, RotateCcw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { reopenTripAction } from '@/app/viajes/actions'
import { ConfirmationDialog } from '@/components/confirmation-dialog'
import { handleTripActionFailure } from '@/lib/action-feedback'
import { notifySuccess } from '@/lib/notifications'

type ReopenTripButtonProps = {
  expectedUpdatedAt: string
  tripId: string
}

export function ReopenTripButton({ expectedUpdatedAt, tripId }: ReopenTripButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [reason, setReason] = useState('')

  function closeDialog() {
    setIsDialogOpen(false)
    setErrorMessage('')
    setReason('')
  }

  function handleReopen() {
    const normalizedReason = reason.trim()
    if (!normalizedReason) {
      const message = 'Escribe el motivo por el que se reabre el viaje.'
      setErrorMessage(message)
      return
    }

    setErrorMessage('')
    startTransition(async () => {
      try {
        const result = await reopenTripAction({ expectedUpdatedAt, reason: normalizedReason, tripId })
        if (!result.ok) {
          handleTripActionFailure(result, {
            refresh: () => router.refresh(),
            setInlineError: setErrorMessage,
          })
          return
        }

        notifySuccess(result.message)
        closeDialog()
        router.replace(`/viajes/${tripId}`)
      } catch {
        const message = 'No fue posible conectar con el servicio. Inténtalo de nuevo.'
        setErrorMessage(message)
      }
    })
  }

  return (
    <div>
      <button type="button" onClick={() => { setErrorMessage(''); setIsDialogOpen(true) }} disabled={isPending} className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70">
        {isPending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <RotateCcw className="size-4" aria-hidden="true" />}
        {isPending ? 'Reabriendo…' : 'Reabrir viaje'}
      </button>
      <ConfirmationDialog
        isOpen={isDialogOpen}
        title="¿Reabrir viaje?"
        description="El viaje volverá a aparecer entre los viajes activos. Los controles existentes se conservarán."
        confirmLabel="Sí, reabrir viaje"
        tone="amber"
        errorMessage={errorMessage}
        isConfirming={isPending}
        onCancel={closeDialog}
        onConfirm={handleReopen}
      >
        <div className="mt-4">
          <label htmlFor={`reopen-reason-${tripId}`} className="block text-sm font-medium text-slate-700">Motivo de reapertura</label>
          <textarea
            id={`reopen-reason-${tripId}`}
            value={reason}
            onChange={(event) => { setReason(event.target.value); setErrorMessage('') }}
            rows={3}
            maxLength={2000}
            required
            data-dialog-autofocus
            className="mt-2 block w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-amber-600 focus:ring-2 focus:ring-amber-100"
            placeholder="Explica por qué debe volver a estar en ruta"
          />
          <p className="mt-1 text-right text-xs text-slate-500">{reason.length}/2000</p>
        </div>
      </ConfirmationDialog>
    </div>
  )
}
