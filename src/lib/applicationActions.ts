import { supabase } from './supabase'
import { queryClient } from './queryClient'

/** Admin triage: move an application to `accepted`. The DB UPDATE trigger
 * (notify_application_accepted) fires the provisioning workflow — this just flips the status.
 * Admin-only, enforced by RLS ("admin update applications"). */
export async function acceptApplication(id: string) {
  if (!supabase) return { error: 'Supabase is not configured.' }
  const { error } = await supabase.from('applications').update({ status: 'accepted' }).eq('id', id)
  if (error) return { error: error.message }
  await queryClient.invalidateQueries({ queryKey: ['admin', 'applications'] })
  return { error: null }
}
