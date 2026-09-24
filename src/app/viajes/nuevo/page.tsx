import { AppShell } from '@/components/app-shell'
import { NewTripForm } from '@/components/new-trip-form'
import { PageHeading } from '@/components/page-heading'

export const metadata = {
  title: 'Nuevo viaje',
}

export default function NuevoViajePage() {
  return (
    <AppShell>
      <PageHeading
        title="Nuevo viaje"
        description="Registra un viaje que quedará disponible para seguimiento en ruta."
      />
      <NewTripForm />
    </AppShell>
  )
}
