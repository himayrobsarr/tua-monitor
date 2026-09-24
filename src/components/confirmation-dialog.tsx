'use client'

import { AlertTriangle, X } from 'lucide-react'
import { useEffect } from 'react'

type ConfirmationDialogProps = {
  isOpen: boolean
  title: string
  description: string
  confirmLabel: string
  isConfirming?: boolean
  onCancel: () => void
  onConfirm: () => void
  tone?: 'emerald' | 'amber'
}

export function ConfirmationDialog({
  isOpen,
  title,
  description,
  confirmLabel,
  isConfirming = false,
  onCancel,
  onConfirm,
  tone = 'emerald',
}: ConfirmationDialogProps) {
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isConfirming) onCancel()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isConfirming, isOpen, onCancel])

  if (!isOpen) return null

  const confirmClass = tone === 'emerald' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-amber-600 hover:bg-amber-700'

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/45 p-4 sm:items-center sm:justify-center" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="confirmation-title" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <span className="flex size-11 items-center justify-center rounded-full bg-amber-50 text-amber-700"><AlertTriangle className="size-5" aria-hidden="true" /></span>
          <button type="button" onClick={onCancel} disabled={isConfirming} aria-label="Cerrar confirmación" className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"><X className="size-5" aria-hidden="true" /></button>
        </div>
        <h2 id="confirmation-title" className="mt-4 text-lg font-semibold text-slate-950">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onCancel} disabled={isConfirming} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={onConfirm} disabled={isConfirming} className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70 ${confirmClass}`}>{isConfirming ? 'Procesando…' : confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
