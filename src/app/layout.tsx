import type { Metadata } from 'next'

import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'TUA Monitor',
    template: '%s | TUA Monitor',
  },
  description: 'Seguimiento operativo para Transportadores TUA.',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  )
}
