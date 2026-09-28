'use client'

import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react'
import Link from 'next/link'

import { AppShell } from '@/components/app-shell'

type ViajeErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ViajeError({ reset }: ViajeErrorProps) {
  return (
    <AppShell>
      <section role="alert" className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-red-50 text-red-700">
          <AlertTriangle className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-slate-950">No pudimos cargar este viaje</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">El servicio de datos no respondió correctamente. El viaje no fue eliminado; vuelve a intentarlo.</p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          <Link href="/viajes" className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            <ArrowLeft className="size-4" aria-hidden="true" />
            Volver a viajes
          </Link>
          <button type="button" onClick={reset} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800">
            <RefreshCw className="size-4" aria-hidden="true" />
            Reintentar
          </button>
        </div>
      </section>
    </AppShell>
  )
}
