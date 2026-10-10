import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { AttendanceRow, ProfileRow, ProgramWeekRow, SubmissionRow, TrackId } from '../lib/db'

/** A track's 36-week programme. */
export function useProgramWeeks(trackId: TrackId | null | undefined) {
  return useQuery<ProgramWeekRow[]>({
    queryKey: ['program', trackId ?? null],
    enabled: Boolean(trackId),
    queryFn: async () => {
      if (!supabase || !trackId) return []
      const { data, error } = await supabase
        .from('program_weeks')
        .select('id, track_id, week_number, title, materials_url, assignment, milestone')
        .eq('track_id', trackId)
        .order('week_number')
      if (error) throw error
      return data as ProgramWeekRow[]
    },
  })
}

const SUBMISSION_COLUMNS = 'id, profile_id, week_id, link, comment, status, feedback, submitted_at, reviewed_at'

/** The member's own works, keyed by week id. */
export function useMySubmissions(profileId: string | undefined) {
  return useQuery<Map<string, SubmissionRow>>({
    queryKey: ['submissions', 'mine', profileId ?? null],
    enabled: Boolean(profileId),
    queryFn: async () => {
      if (!supabase || !profileId) return new Map()
      const { data, error } = await supabase
        .from('submissions')
        .select(SUBMISSION_COLUMNS)
        .eq('profile_id', profileId)
      if (error) throw error
      return new Map((data as SubmissionRow[]).map((s) => [s.week_id, s]))
    },
  })
}

export interface WeekWork {
  members: ProfileRow[]
  submissions: Map<string, SubmissionRow>
  /** `${profileId}:${kind}` */
  attendance: Set<string>
}

/** Staff view of one week: the track's members, their works and attendance. RLS limits it
 * to members the viewer manages. */
export function useWeekWork(weekId: string | null, trackId: TrackId | null, enabled: boolean) {
  return useQuery<WeekWork>({
    queryKey: ['week-work', weekId, trackId],
    enabled: Boolean(enabled && weekId && trackId),
    queryFn: async () => {
      const empty: WeekWork = { members: [], submissions: new Map(), attendance: new Set() }
      if (!supabase || !weekId || !trackId) return empty
      const [membersRes, subsRes, attRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, user_id, full_name, role, grade, track_id, cohort_id, avatar_path, github_username, codeforces_handle, status, course_completed_at, created_at')
          .eq('track_id', trackId)
          .eq('role', 'member')
          .eq('status', 'active')
          .order('full_name'),
        supabase.from('submissions').select(SUBMISSION_COLUMNS).eq('week_id', weekId),
        supabase.from('attendance').select('profile_id, week_id, kind').eq('week_id', weekId),
      ])
      if (membersRes.error) throw membersRes.error
      if (subsRes.error) throw subsRes.error
      if (attRes.error) throw attRes.error
      return {
        members: membersRes.data as unknown as ProfileRow[],
        submissions: new Map((subsRes.data as SubmissionRow[]).map((s) => [s.profile_id, s])),
        attendance: new Set((attRes.data as AttendanceRow[]).map((a) => `${a.profile_id}:${a.kind}`)),
      }
    },
  })
}

export interface TrackProgress {
  members: ProfileRow[]
  /** profile id → (week id → work) */
  submissions: Map<string, Map<string, SubmissionRow>>
}

/** Staff overview of a track: its active members and all their works (RLS: members the viewer manages). */
export function useTrackProgress(trackId: TrackId | null, enabled: boolean) {
  return useQuery<TrackProgress>({
    queryKey: ['track-progress', trackId],
    enabled: Boolean(enabled && trackId),
    queryFn: async () => {
      const empty: TrackProgress = { members: [], submissions: new Map() }
      if (!supabase || !trackId) return empty
      const [membersRes, subsRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, user_id, full_name, role, grade, track_id, cohort_id, avatar_path, github_username, codeforces_handle, status, course_completed_at, created_at')
          .eq('track_id', trackId)
          .eq('role', 'member')
          .eq('status', 'active')
          .order('full_name'),
        supabase
          .from('submissions')
          .select(`${SUBMISSION_COLUMNS}, week:program_weeks!inner(track_id)`)
          .eq('week.track_id', trackId),
      ])
      if (membersRes.error) throw membersRes.error
      if (subsRes.error) throw subsRes.error
      const submissions = new Map<string, Map<string, SubmissionRow>>()
      for (const s of subsRes.data as unknown as SubmissionRow[]) {
        if (!submissions.has(s.profile_id)) submissions.set(s.profile_id, new Map())
        submissions.get(s.profile_id)!.set(s.week_id, s)
      }
      return { members: membersRes.data as unknown as ProfileRow[], submissions }
    },
  })
}

/** Works waiting for review among the members the viewer manages. */
export function useReviewQueue(enabled: boolean) {
  return useQuery<number>({
    queryKey: ['submissions', 'queue'],
    enabled,
    queryFn: async () => {
      if (!supabase) return 0
      const { count, error } = await supabase
        .from('submissions')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'submitted')
      if (error) throw error
      return count ?? 0
    },
  })
}
