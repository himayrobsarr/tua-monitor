'use client'

import { CheckCircle2, LoaderCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { finishTripAction } from '@/app/viajes/actions'
import { ConfirmationDialog } from '@/components/confirmation-dialog'
import { notifyError, notifySuccess } from '@/lib/notifications'

type FinishTripButtonProps = {
  expectedUpdatedAt: string
  tripId: string
}

export function FinishTripButton({ expectedUpdatedAt, tripId }: FinishTripButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  function handleFinish() {
    setErrorMessage('')

    startTransition(async () => {
      try {
        const result = await finishTripAction({ expectedUpdatedAt, tripId })
        if (!result.ok) {
          setErrorMessage(result.message)
          notifyError(result.message)
          if (result.refresh) router.refresh()
          return
        }

        notifySuccess(result.message)
        setIsDialogOpen(false)
        router.replace('/historial')
      } catch {
        const message = 'No fue posible conectar con el servicio. Inténtalo de nuevo.'
        setErrorMessage(message)
        notifyError(message)
      }
    })
  }

  return (
    <div>
      <button type="button" onClick={() => { setErrorMessage(''); setIsDialogOpen(true) }} disabled={isPending} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto">
        {isPending ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="size-4" aria-hidden="true" />}
        {isPending ? 'Finalizando…' : 'Finalizar viaje'}
      </button>
      <ConfirmationDialog
        isOpen={isDialogOpen}
        title="¿Finalizar viaje?"
        description="El viaje dejará de aparecer en los viajes activos y se moverá al historial."
        confirmLabel="Sí, finalizar viaje"
        errorMessage={errorMessage}
        isConfirming={isPending}
        onCancel={() => setIsDialogOpen(false)}
        onConfirm={handleFinish}
      />
    </div>
  )
}
