import type { Metadata } from 'next'

import './globals.css'
import 'react-toastify/dist/ReactToastify.css'

import { ToastProvider } from '@/components/toast-provider'
import { VercelObservability } from '@/components/vercel-observability'

export const metadata: Metadata = {
  referrer: 'strict-origin',
  title: {
    default: 'TUA Monitor',
    template: '%s | TUA Monitor',
  },
  description: 'Seguimiento operativo para Transportadores TUA.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        {children}
        <ToastProvider />
        <VercelObservability />
      </body>
    </html>
  )
}
