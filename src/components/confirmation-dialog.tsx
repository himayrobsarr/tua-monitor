'use client'

import { AlertTriangle, X } from 'lucide-react'
import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'

type ConfirmationDialogProps = {
  isOpen: boolean
  title: string
  description: string
  confirmLabel: string
  children?: ReactNode
  errorMessage?: string
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
  children,
  errorMessage,
  isConfirming = false,
  onCancel,
  onConfirm,
  tone = 'emerald',
}: ConfirmationDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    const dialog = dialogRef.current
    if (!dialog) return

    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (!dialog.open) dialog.showModal()

    const focusFrame = window.requestAnimationFrame(() => {
      const preferredFocus = dialog.querySelector<HTMLElement>('[autofocus]')
        ?? cancelButtonRef.current
      preferredFocus?.focus()
    })

    return () => {
      window.cancelAnimationFrame(focusFrame)
      if (dialog.open) dialog.close()
      document.body.style.overflow = previousOverflow
      returnFocusRef.current?.focus()
      returnFocusRef.current = null
    }
  }, [isOpen])

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDialogElement>) {
    if (event.key !== 'Tab') return

    const dialog = dialogRef.current
    if (!dialog) return

    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    )).filter((element) => element.getClientRects().length > 0)

    if (!focusable.length) {
      event.preventDefault()
      dialog.focus()
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  if (!isOpen) return null

  const confirmClass = tone === 'emerald' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-amber-600 hover:bg-amber-700'

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border-0 bg-white p-0 shadow-xl backdrop:bg-slate-950/45"
      onCancel={(event) => {
        event.preventDefault()
        if (!isConfirming) onCancel()
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <span className="flex size-11 items-center justify-center rounded-full bg-amber-50 text-amber-700"><AlertTriangle className="size-5" aria-hidden="true" /></span>
          <button type="button" onClick={onCancel} disabled={isConfirming} aria-label="Cerrar confirmación" className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"><X className="size-5" aria-hidden="true" /></button>
        </div>
        <h2 id={titleId} className="mt-4 text-lg font-semibold text-slate-950">{title}</h2>
        <p id={descriptionId} className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        {children}
        {errorMessage ? <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{errorMessage}</p> : null}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button ref={cancelButtonRef} type="button" onClick={onCancel} disabled={isConfirming} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={onConfirm} disabled={isConfirming} className={`rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70 ${confirmClass}`}>{isConfirming ? 'Procesando…' : confirmLabel}</button>
        </div>
      </div>
    </dialog>
  )
}
