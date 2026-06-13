import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Team, TeamMemberLite } from '../types'
import type { TeamRow, TeamMemberRow } from '../lib/db-rows'

/** All teams with their rosters (DB-only). */
export function useTeams() {
  return useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: async () => {
      if (!supabase) return []
      const [teamsRes, membersRes] = await Promise.all([
        supabase
          .from('teams')
          .select('id, name, goal, founder_id, needed_roles, status, created_at')
          .order('created_at', { ascending: false })
          .returns<TeamRow[]>(),
        supabase
          .from('team_members')
          .select('team_id, profile_id, role, profiles(full_name)')
          .returns<TeamMemberRow[]>(),
      ])
      if (teamsRes.error) throw teamsRes.error
      if (membersRes.error) throw membersRes.error

      const byTeam = new Map<string, TeamMemberLite[]>()
      for (const m of membersRes.data) {
        const arr = byTeam.get(m.team_id) ?? []
        arr.push({ profileId: m.profile_id, name: m.profiles?.full_name ?? '—', role: m.role })
        byTeam.set(m.team_id, arr)
      }

      return teamsRes.data.map((t) => ({
        id: t.id,
        name: t.name,
        goal: t.goal,
        founderId: t.founder_id,
        neededRoles: t.needed_roles ?? [],
        status: t.status,
        members: byTeam.get(t.id) ?? [],
      }))
    },
  })
}
