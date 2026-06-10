import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { leaderboardData } from '../data/mock'
import type { LeaderboardEntry } from '../types'
import type { LeaderboardRow } from '../lib/db-rows'

export function useLeaderboard() {
  return useQuery<LeaderboardEntry[]>({
    queryKey: ['leaderboard'],
    queryFn: async () => {
      if (!supabase) return leaderboardData
      const { data, error } = await supabase
        .from('leaderboard')
        .select('profile_id, full_name, avatar_url, xp')
        .order('xp', { ascending: false })
        .returns<LeaderboardRow[]>()
      if (error) throw error
      return data.map((r) => ({ name: r.full_name, xp: r.xp, avatar: r.avatar_url }))
    },
  })
}
