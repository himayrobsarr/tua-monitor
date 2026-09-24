import Image from 'next/image'
import Link from 'next/link'

import { NavigationMenu } from '@/components/navigation-menu'
import { LogoutButton } from '@/components/logout-button'

type AppShellProps = {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4">
          <Link href="/viajes" className="shrink-0" aria-label="TUA Monitor, ir a viajes">
            <Image
              src="/logo-tua-transparent.png"
              alt="Transportadores Unidos de los Andes TUA S.A."
              width={907}
              height={374}
              priority
              className="h-auto w-36 sm:w-52"
            />
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-1 sm:justify-end">
            <NavigationMenu />
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  )
}
