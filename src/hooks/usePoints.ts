import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { LeaderboardRow, PointsEntryRow, TrackId } from '../lib/db'

/** AIT Points totals of active members, optionally one track. */
export function useLeaderboard(trackId: TrackId | null) {
  return useQuery<LeaderboardRow[]>({
    queryKey: ['points', 'leaderboard', trackId],
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase.rpc('points_leaderboard', { p_track: trackId })
      if (error) throw error
      return (data ?? []) as LeaderboardRow[]
    },
  })
}

export function usePointsTotal(profileId: string | undefined) {
  return useQuery<number>({
    queryKey: ['points', 'total', profileId ?? null],
    enabled: Boolean(profileId),
    queryFn: async () => {
      if (!supabase || !profileId) return 0
      const { data, error } = await supabase.rpc('points_total', { p_profile: profileId })
      if (error) throw error
      return (data as number | null) ?? 0
    },
  })
}

const ENTRY_COLUMNS =
  'id, profile_id, amount, category, note, created_at, ' +
  'member:profiles!points_entries_profile_id_fkey(full_name), ' +
  'awarder:profiles!points_entries_awarded_by_fkey(full_name)'

/** Journal entries. With a profile id: that member's (own, or one the viewer manages);
 * without: every entry the viewer may see — for staff, their members' journal. */
export function usePointsJournal(profileId: string | null, enabled = true, limit = 100) {
  return useQuery<PointsEntryRow[]>({
    queryKey: ['points', 'journal', profileId, limit],
    enabled,
    queryFn: async () => {
      if (!supabase) return []
      let q = supabase.from('points_entries').select(ENTRY_COLUMNS)
      if (profileId) q = q.eq('profile_id', profileId)
      const { data, error } = await q.order('created_at', { ascending: false }).limit(limit)
      if (error) throw error
      return data as unknown as PointsEntryRow[]
    },
  })
}
