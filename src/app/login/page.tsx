import { ClipboardList } from 'lucide-react'

import { LoginForm } from '@/components/login-form'

export const metadata = {
  title: 'Iniciar sesión',
}

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-8">
          <span className="flex size-11 items-center justify-center rounded-xl bg-blue-700 text-white">
            <ClipboardList className="size-6" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-950">TUA Monitor</h1>
          <p className="mt-2 text-sm font-medium text-slate-600">Transportadores TUA</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">Ingresa con las credenciales asignadas.</p>
        </div>
        <LoginForm />
      </section>
    </main>
  )
}
