import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { LeaderboardEntry } from '../types'
import type { AipLeaderboardRow } from '../lib/db-rows'

export type AipScope = 'all' | 'season' | 'week'

/** Ranked AIP totals, optionally scoped to the active season or the last 7 days.
 * Falls back to mock data when Supabase isn't configured. */
export function useAipLeaderboard(scope: AipScope = 'all') {
  return useQuery<LeaderboardEntry[]>({
    queryKey: ['aip-leaderboard', scope],
    queryFn: async () => {
      if (!supabase) return []
      const params: { p_since?: string; p_season?: string } = {}
      if (scope === 'week') {
        params.p_since = new Date(Date.now() - 7 * 86_400_000).toISOString()
      } else if (scope === 'season') {
        const { data: s } = await supabase
          .from('seasons')
          .select('id')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (s?.id) params.p_season = s.id as string
      }
      const { data, error } = await supabase.rpc('aip_leaderboard', params)
      if (error) throw error
      const rows = (data ?? []) as AipLeaderboardRow[]
      return rows.map((r) => ({
        profileId: r.profile_id,
        name: r.full_name,
        aip: r.aip,
        avatar: r.avatar_url,
      }))
    },
  })
}
