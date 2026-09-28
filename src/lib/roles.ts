import { redirect } from 'next/navigation'

import { logServerError } from '@/lib/server-logging'
import { createClient } from '@/lib/supabase/server'
import type { AppRole } from '@/types/database'

export async function getCurrentUserRole(): Promise<AppRole | null> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError) {
    logServerError('auth_lookup_failed', 'get_authenticated_user', authError)
  }

  if (!user) return null

  const { data, error: roleError } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .maybeSingle()

  if (roleError) {
    logServerError('role_lookup_failed', 'select_current_user_role', roleError)
  }

  return data?.role === 'admin' || data?.role === 'reporter' ? data.role : null
}

export async function requireAdminRole() {
  const role = await getCurrentUserRole()
  if (role !== 'admin') redirect('/viajes')
  return role
}
