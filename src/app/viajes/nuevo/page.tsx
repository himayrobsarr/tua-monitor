import { AppShell } from '@/components/app-shell'
import { NewTripForm } from '@/components/new-trip-form'
import { PageHeading } from '@/components/page-heading'
import { requireAdminRole } from '@/lib/roles'

export const metadata = {
  title: 'Nuevo viaje',
}

export default async function NuevoViajePage() {
  await requireAdminRole()
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
