import { ArrowLeft, SearchX } from 'lucide-react'
import Link from 'next/link'

import { AppShell } from '@/components/app-shell'

export default function ViajeNotFound() {
  return (
    <AppShell>
      <section className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-700">
          <SearchX className="size-6" aria-hidden="true" />
        </span>
        <h1 className="mt-4 text-xl font-semibold text-slate-950">Viaje no encontrado</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">El enlace no corresponde a un viaje disponible o el registro ya no existe.</p>
        <Link href="/viajes" className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Volver a viajes
        </Link>
      </section>
    </AppShell>
  )
}
