'use client'

import { History, Route } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navigation = [
  { href: '/viajes', label: 'Viajes', icon: Route },
  { href: '/historial', label: 'Historial', icon: History },
]

export function NavigationMenu() {
  const pathname = usePathname()

  return (
    <nav aria-label="Navegación principal" className="flex items-center gap-1">
      {navigation.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || (href === '/viajes' && pathname.startsWith('/viajes/'))

        return (
          <Link key={href} href={href} aria-current={isActive ? 'page' : undefined} className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-semibold transition sm:px-3 ${isActive ? 'bg-blue-50 text-blue-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'}`}>
            <Icon className="size-4" aria-hidden="true" />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
