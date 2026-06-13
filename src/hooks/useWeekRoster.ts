import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { RosterSubmissionRow } from '../lib/db-rows'

/** A member's reviewable submission for a week (host view). */
export interface RosterSubmission {
  id: string
  link: string
  status: 'submitted' | 'reviewed'
  passed: boolean | null
  feedback: string | null
}

export interface WeekRoster {
  /** profile_id → their submission for this week */
  submissions: Map<string, RosterSubmission>
  /** profile_ids that checked in to this week */
  attended: Set<string>
  code: string | null
  closesAt: string | null
}

/** Per-week host data: who submitted, who attended, and the current meeting code.
 * The member list comes from `useMembers` so it isn't refetched per week. */
export function useWeekRoster(weekId: string | null, enabled: boolean) {
  return useQuery<WeekRoster>({
    queryKey: ['week-roster', weekId],
    enabled: Boolean(supabase && weekId && enabled),
    queryFn: async () => {
      const empty: WeekRoster = {
        submissions: new Map(),
        attended: new Set(),
        code: null,
        closesAt: null,
      }
      if (!supabase || !weekId) return empty

      const [subsRes, attRes, meetingRes] = await Promise.all([
        supabase
          .from('submissions')
          .select('id, profile_id, link, status, passed, feedback')
          .eq('week_id', weekId)
          .returns<RosterSubmissionRow[]>(),
        supabase
          .from('attendance')
          .select('profile_id')
          .eq('week_id', weekId)
          .returns<{ profile_id: string }[]>(),
        supabase.from('week_meetings').select('code, closes_at').eq('week_id', weekId).maybeSingle(),
      ])

      if (subsRes.error) throw subsRes.error
      if (attRes.error) throw attRes.error

      const submissions = new Map<string, RosterSubmission>(
        subsRes.data.map((s) => [
          s.profile_id,
          { id: s.id, link: s.link, status: s.status, passed: s.passed, feedback: s.feedback },
        ]),
      )

      return {
        submissions,
        attended: new Set(attRes.data.map((a) => a.profile_id)),
        code: meetingRes.data?.code ?? null,
        closesAt: meetingRes.data?.closes_at ?? null,
      }
    },
  })
}
