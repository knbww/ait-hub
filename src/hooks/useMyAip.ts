import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

/** A single member's all-time AIP total (for the profile rank widget). */
export function useMyAip(profileId?: string) {
  return useQuery<number>({
    queryKey: ['my-aip', profileId ?? null],
    queryFn: async () => {
      if (!supabase || !profileId) return 0
      const { data, error } = await supabase
        .from('leaderboard')
        .select('xp')
        .eq('profile_id', profileId)
        .maybeSingle()
      if (error) throw error
      return (data?.xp as number | undefined) ?? 0
    },
  })
}
