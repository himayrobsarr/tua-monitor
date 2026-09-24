'use client'

import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { createClient } from '@/lib/supabase/client'

export function LogoutButton() {
  const router = useRouter()
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSignOut() {
    setErrorMessage('')
    setIsSigningOut(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signOut()

      if (error) {
        setErrorMessage('No fue posible cerrar sesión. Inténtalo de nuevo.')
        return
      }

      router.replace('/login')
      router.refresh()
    } catch {
      setErrorMessage('No fue posible cerrar sesión. Inténtalo de nuevo.')
    } finally {
      setIsSigningOut(false)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handleSignOut}
        disabled={isSigningOut}
        className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <LogOut className="size-4" aria-hidden="true" />
        {isSigningOut ? 'Cerrando…' : 'Cerrar sesión'}
      </button>
      {errorMessage ? (
        <p role="alert" className="absolute right-0 top-full z-10 mt-2 w-64 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 shadow-sm">
          {errorMessage}
        </p>
      ) : null}
    </div>
  )
}
