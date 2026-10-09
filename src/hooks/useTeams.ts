import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { ProjectRow, TeamRequestRow, TeamRow } from '../lib/db'

const TEAM_COLUMNS =
  'id, name, track_id, goal, captain_id, status, created_at, ' +
  'team_members(profile_id, joined_at, profile:profiles(full_name, avatar_path))'

/** Active teams (all tracks; filter on the page). */
export function useTeams() {
  return useQuery<TeamRow[]>({
    queryKey: ['teams'],
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase
        .from('teams')
        .select(TEAM_COLUMNS)
        .eq('status', 'active')
        .order('created_at')
      if (error) throw error
      return data as unknown as TeamRow[]
    },
  })
}

/** Requests the viewer can see: their own, and those to teams they captain / manage. */
export function useTeamRequests(enabled = true) {
  return useQuery<TeamRequestRow[]>({
    queryKey: ['team-requests'],
    enabled,
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase
        .from('team_requests')
        .select('id, team_id, profile_id, note, status, created_at, profile:profiles(full_name, grade)')
        .eq('status', 'pending')
        .order('created_at')
      if (error) throw error
      return data as unknown as TeamRequestRow[]
    },
  })
}

const PROJECT_LIST_COLUMNS =
  'id, title, problem, target_user, status, team_id, owner_id, created_at, updated_at, ' +
  'team:teams(name), ' +
  'project_members(profile_id, role, profile:profiles!project_members_profile_id_fkey(full_name, track_id, avatar_path))'

export function useProjects() {
  return useQuery<ProjectRow[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase
        .from('projects')
        .select(PROJECT_LIST_COLUMNS)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data as unknown as ProjectRow[]
    },
  })
}

const PROJECT_COLUMNS =
  'id, title, problem, target_user, scope, roles, starts_on, ends_on, verification, demo, links, status, ' +
  'team_id, owner_id, created_at, updated_at, team:teams(name), ' +
  'project_members(project_id, profile_id, role, contribution, confirmed_at, ' +
  'profile:profiles!project_members_profile_id_fkey(full_name, track_id, avatar_path), ' +
  'confirmer:profiles!project_members_confirmed_by_fkey(full_name))'

export function useProject(id: string | undefined) {
  return useQuery<ProjectRow | null>({
    queryKey: ['project', id ?? null],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!supabase || !id) return null
      const { data, error } = await supabase.from('projects').select(PROJECT_COLUMNS).eq('id', id).maybeSingle()
      if (error) throw error
      return (data as unknown as ProjectRow | null) ?? null
    },
  })
}
