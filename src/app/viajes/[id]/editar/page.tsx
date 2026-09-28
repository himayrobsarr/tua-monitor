import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { EditTripForm } from '@/components/edit-trip-form'
import { PageHeading } from '@/components/page-heading'
import { createClient } from '@/lib/supabase/server'
import { requireAdminRole } from '@/lib/roles'

type EditarViajePageProps = {
  params: Promise<{ id: string }>
}

export const metadata = {
  title: 'Editar viaje',
}

export default async function EditarViajePage({ params }: EditarViajePageProps) {
  await requireAdminRole()
  const { id } = await params
  const supabase = await createClient()
  const { data: trip, error } = await supabase.from('trips').select('*').eq('id', id).maybeSingle()

  if (error) {
    console.error(JSON.stringify({
      level: 'error',
      event: 'trip_edit_query_failed',
      code: error.code ?? 'UNKNOWN',
      operation: 'select_trip_for_edit',
    }))
    throw new Error('TUA_TRIP_EDIT_LOAD_FAILED')
  }

  if (!trip) notFound()

  return (
    <AppShell>
      <PageHeading
        title="Editar viaje"
        description={`Actualiza la información operativa del viaje ${trip.plate}.`}
      />
      <EditTripForm trip={trip} />
    </AppShell>
  )
}
