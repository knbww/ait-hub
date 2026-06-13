import { supabase } from './supabase'
import { queryClient } from './queryClient'

/** Council manual AIP award (or rollback via negative delta). Admin-only —
 * enforced server-side in `award_aip`. Invalidates the leaderboard + journal. */
export async function awardAip(profileId: string, source: string, delta: number, note: string) {
  if (!supabase) return { error: 'Supabase is not configured.' }
  const { error } = await supabase.rpc('award_aip', {
    p_profile_id: profileId,
    p_source: source,
    p_delta: delta,
    p_note: note,
  })
  if (error) return { error: error.message }
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['aip-leaderboard'] }),
    queryClient.invalidateQueries({ queryKey: ['aip-journal'] }),
    queryClient.invalidateQueries({ queryKey: ['my-aip'] }),
    queryClient.invalidateQueries({ queryKey: ['leaderboard'] }),
  ])
  return { error: null }
}
