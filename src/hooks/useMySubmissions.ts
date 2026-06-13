import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Submission } from '../types'
import type { SubmissionRow } from '../lib/db-rows'

/** The signed-in member's submissions, keyed by week id. Empty when logged out. */
export function useMySubmissions(profileId?: string) {
  return useQuery<Map<string, Submission>>({
    queryKey: ['submissions', 'mine', profileId ?? null],
    queryFn: async () => {
      const map = new Map<string, Submission>()
      if (!supabase || !profileId) return map
      const { data, error } = await supabase
        .from('submissions')
        .select('id, week_id, profile_id, link, comment, status, passed, feedback, created_at, reviewed_at')
        .eq('profile_id', profileId)
        .returns<SubmissionRow[]>()
      if (error) throw error
      for (const r of data) {
        map.set(r.week_id, {
          id: r.id,
          weekId: r.week_id,
          link: r.link,
          comment: r.comment,
          status: r.status,
          passed: r.passed,
          feedback: r.feedback,
        })
      }
      return map
    },
  })
}
