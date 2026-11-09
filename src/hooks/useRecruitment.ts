import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { ApplicationNoteRow, RecruitmentAccess, RecruitmentTeamRow, TeamApplicationRow } from '../lib/db'

/** What the viewer may do with the team applications. The database decides; this only shapes the UI. */
export function useRecruitmentAccess(profileId: string | undefined) {
  return useQuery<RecruitmentAccess>({
    queryKey: ['recruitment-access', profileId ?? null],
    enabled: Boolean(profileId),
    staleTime: 60_000,
    queryFn: async () => {
      if (!supabase) return 'none'
      const { data, error } = await supabase.rpc('my_recruitment_access')
      if (error) throw error
      return (data as RecruitmentAccess | null) ?? 'none'
    },
  })
}

export function useApplications(enabled: boolean) {
  return useQuery<TeamApplicationRow[]>({
    queryKey: ['applications'],
    enabled,
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase.from('team_applications').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return data as TeamApplicationRow[]
    },
  })
}

export function useApplication(id: string | undefined) {
  return useQuery<TeamApplicationRow | null>({
    queryKey: ['application', id ?? null],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!supabase || !id) return null
      const { data, error } = await supabase.from('team_applications').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      return (data as TeamApplicationRow | null) ?? null
    },
  })
}

export function useApplicationNotes(id: string | undefined) {
  return useQuery<ApplicationNoteRow[]>({
    queryKey: ['application-notes', id ?? null],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!supabase || !id) return []
      const { data, error } = await supabase
        .from('team_application_notes')
        .select('id, application_id, author_id, body, created_at, author:profiles!team_application_notes_author_id_fkey(full_name)')
        .eq('application_id', id)
        .order('created_at')
      if (error) throw error
      return data as unknown as ApplicationNoteRow[]
    },
  })
}

export function useRecruitmentTeam(enabled: boolean) {
  return useQuery<RecruitmentTeamRow[]>({
    queryKey: ['recruitment-team'],
    enabled,
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase.rpc('recruitment_team')
      if (error) throw error
      return (data ?? []) as RecruitmentTeamRow[]
    },
  })
}

/** When the form on aitclub.org/team takes applications. */
export function useRecruitmentWindow(enabled: boolean) {
  return useQuery<{ opens_at: string | null; closes_at: string | null } | null>({
    queryKey: ['recruitment-window'],
    enabled,
    queryFn: async () => {
      if (!supabase) return null
      const { data, error } = await supabase.rpc('recruitment_window')
      if (error) throw error
      const rows = (data ?? []) as { opens_at: string | null; closes_at: string | null }[]
      return rows[0] ?? null
    },
  })
}
