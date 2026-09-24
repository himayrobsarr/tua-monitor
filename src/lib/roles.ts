import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import type { AppRole } from '@/types/database'

export async function getCurrentUserRole(): Promise<AppRole | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  return data?.role === 'admin' || data?.role === 'reporter' ? data.role : null
}

export async function requireAdminRole() {
  const role = await getCurrentUserRole()
  if (role !== 'admin') redirect('/viajes')
  return role
}
