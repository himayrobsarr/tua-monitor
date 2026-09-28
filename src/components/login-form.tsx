'use client'

import { LogIn } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState, type FormEvent } from 'react'

import {
  classifyLoginAuthError,
  validateLoginCredentials,
  type LoginFeedback,
  type LoginField,
} from '@/lib/login'
import { createClient } from '@/lib/supabase/client'
import { notifySuccess } from '@/lib/notifications'

const LOGIN_ERROR_ID = 'login-error'

export function LoginForm() {
  const router = useRouter()
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [invalidField, setInvalidField] = useState<LoginField | null>(null)

  function showFeedback(feedback: LoginFeedback) {
    setErrorMessage(feedback.message)
    setInvalidField(feedback.field)

    requestAnimationFrame(() => {
      if (feedback.field === 'email') {
        emailRef.current?.focus()
      } else if (feedback.field === 'password') {
        passwordRef.current?.focus()
      }
    })
  }

  function clearFieldFeedback(field: LoginField) {
    if (invalidField !== field) return

    setErrorMessage('')
    setInvalidField(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')
    setInvalidField(null)

    const formData = new FormData(event.currentTarget)
    const validation = validateLoginCredentials(
      formData.get('email'),
      formData.get('password'),
    )

    if (!validation.ok) {
      showFeedback(validation.feedback)
      return
    }

    if (emailRef.current) {
      emailRef.current.value = validation.email
    }

    setIsSubmitting(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email: validation.email,
        password: validation.password,
      })

      if (error) {
        showFeedback(classifyLoginAuthError(error))
        return
      }

      notifySuccess('Sesión iniciada correctamente.')
      router.replace('/viajes')
      router.refresh()
    } catch (error) {
      showFeedback(classifyLoginAuthError(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">
          Correo electrónico
        </label>
        <input
          ref={emailRef}
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          inputMode="email"
          spellCheck={false}
          onChange={() => clearFieldFeedback('email')}
          aria-invalid={invalidField === 'email'}
          aria-describedby={invalidField === 'email' ? LOGIN_ERROR_ID : undefined}
          required
          className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
          placeholder="nombre@empresa.com"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-700">
          Contraseña
        </label>
        <input
          ref={passwordRef}
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          onChange={() => clearFieldFeedback('password')}
          aria-invalid={invalidField === 'password'}
          aria-describedby={invalidField === 'password' ? LOGIN_ERROR_ID : undefined}
          required
          className="mt-2 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-blue-700 focus:ring-2 focus:ring-blue-100"
        />
      </div>
      {errorMessage ? (
        <p
          id={LOGIN_ERROR_ID}
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {errorMessage}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-70"
      >
        <LogIn className="size-4" aria-hidden="true" />
        {isSubmitting ? 'Iniciando sesión…' : 'Iniciar sesión'}
      </button>
    </form>
  )
}
