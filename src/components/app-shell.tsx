import { ClipboardList, History, Route } from 'lucide-react'
import Link from 'next/link'

import { LogoutButton } from '@/components/logout-button'

const navigation = [
  { href: '/viajes', label: 'Viajes', icon: Route },
  { href: '/historial', label: 'Historial', icon: History },
]

type AppShellProps = {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Link href="/viajes" className="flex items-center gap-2 text-slate-900">
            <span className="flex size-9 items-center justify-center rounded-lg bg-blue-700 text-white">
              <ClipboardList className="size-5" aria-hidden="true" />
            </span>
            <span>
              <span className="block font-semibold">TUA Monitor</span>
              <span className="block text-xs font-medium text-slate-500">Transportadores TUA</span>
            </span>
          </Link>
          <div className="flex items-center justify-between gap-1 sm:justify-end">
            <nav aria-label="Navegación principal" className="flex items-center gap-1">
              {navigation.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950"
                >
                  <Icon className="size-4" aria-hidden="true" />
                  <span>{label}</span>
                </Link>
              ))}
            </nav>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  )
}
