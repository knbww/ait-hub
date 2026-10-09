import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { CohortWeekRow, ProfileRow, TrackRow } from '../lib/db'

/** The three tracks (titles + Drive folder links). */
export function useTracks() {
  return useQuery<TrackRow[]>({
    queryKey: ['tracks'],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase
        .from('tracks')
        .select('id, title, short_title, drive_url, sort')
        .order('sort')
      if (error) throw error
      return data as TrackRow[]
    },
  })
}

/** Week dates of a cohort (only scheduled weeks have rows). */
export function useSchedule(cohortId: string | null | undefined) {
  return useQuery<CohortWeekRow[]>({
    queryKey: ['schedule', cohortId ?? null],
    enabled: Boolean(cohortId),
    queryFn: async () => {
      if (!supabase || !cohortId) return []
      const { data, error } = await supabase
        .from('cohort_weeks')
        .select('week_number, starts_on')
        .eq('cohort_id', cohortId)
        .order('week_number')
      if (error) throw error
      return data as CohortWeekRow[]
    },
  })
}

const MEMBER_COLUMNS =
  'id, user_id, full_name, role, grade, track_id, cohort_id, avatar_path, ' +
  'github_username, codeforces_handle, status, course_completed_at, created_at'

/** Everyone the viewer may see (active members; staff also see deactivated ones). */
export function useMembers(enabled = true) {
  return useQuery<ProfileRow[]>({
    queryKey: ['members'],
    enabled,
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase.from('profiles').select(MEMBER_COLUMNS).order('full_name')
      if (error) throw error
      return data as unknown as ProfileRow[]
    },
  })
}

export function useMember(id: string | undefined) {
  return useQuery<ProfileRow | null>({
    queryKey: ['member', id ?? null],
    enabled: Boolean(id),
    queryFn: async () => {
      if (!supabase || !id) return null
      const { data, error } = await supabase.from('profiles').select(MEMBER_COLUMNS).eq('id', id).maybeSingle()
      if (error) throw error
      return (data as unknown as ProfileRow | null) ?? null
    },
  })
}
