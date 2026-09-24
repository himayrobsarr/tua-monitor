import { notFound } from 'next/navigation'

import { AppShell } from '@/components/app-shell'
import { EditTripForm } from '@/components/edit-trip-form'
import { PageHeading } from '@/components/page-heading'
import { createClient } from '@/lib/supabase/server'

type EditarViajePageProps = {
  params: Promise<{ id: string }>
}

export const metadata = {
  title: 'Editar viaje',
}

export default async function EditarViajePage({ params }: EditarViajePageProps) {
  const { id } = await params
  const supabase = await createClient()
  const { data: trip, error } = await supabase.from('trips').select('*').eq('id', id).maybeSingle()

  if (error || !trip) notFound()

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
