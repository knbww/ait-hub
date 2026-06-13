import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { TeamRequest } from '../types'
import type { TeamRequestRow } from '../lib/db-rows'

/** Pending join requests the caller may see (their own + their teams', via RLS). */
export function useTeamRequests() {
  return useQuery<TeamRequest[]>({
    queryKey: ['team-requests'],
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase
        .from('team_requests')
        .select('id, team_id, profile_id, role, note, status, profiles(full_name)')
        .eq('status', 'pending')
        .returns<TeamRequestRow[]>()
      if (error) throw error
      return data.map((r) => ({
        id: r.id,
        teamId: r.team_id,
        profileId: r.profile_id,
        name: r.profiles?.full_name ?? '—',
        role: r.role,
        note: r.note,
      }))
    },
  })
}
