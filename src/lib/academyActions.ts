import { supabase } from './supabase'
import { queryClient } from './queryClient'

/** Thin wrappers over the academy Postgres functions (RPC). Each invalidates the
 * affected queries so the UI reflects server state. All authorization and AIP
 * awards happen server-side in the SECURITY DEFINER functions — these can't be
 * bypassed from the client. */

const NOT_CONFIGURED = 'Supabase is not configured.'

export async function submitAssignment(weekId: string, link: string, comment: string) {
  if (!supabase) return { error: NOT_CONFIGURED }
  const { error } = await supabase.rpc('submit_assignment', {
    p_week_id: weekId,
    p_link: link,
    p_comment: comment,
  })
  if (error) return { error: error.message }
  await queryClient.invalidateQueries({ queryKey: ['submissions'] })
  await queryClient.invalidateQueries({ queryKey: ['week-roster'] })
  return { error: null }
}

/** Returns the function's status string: ok | already | invalid_code | closed |
 * unauthenticated, or null on transport error (with `error` set). */
export async function checkIn(weekId: string, code: string) {
  if (!supabase) return { result: null, error: NOT_CONFIGURED }
  const { data, error } = await supabase.rpc('check_in', { p_week_id: weekId, p_code: code })
  if (error) return { result: null, error: error.message }
  await queryClient.invalidateQueries({ queryKey: ['attendance'] })
  await queryClient.invalidateQueries({ queryKey: ['leaderboard'] })
  return { result: data as string, error: null }
}

export async function openAttendance(weekId: string, code: string, minutes: number) {
  if (!supabase) return { error: NOT_CONFIGURED }
  const { error } = await supabase.rpc('open_attendance', {
    p_week_id: weekId,
    p_code: code,
    p_minutes: minutes,
  })
  if (error) return { error: error.message }
  await queryClient.invalidateQueries({ queryKey: ['week-roster'] })
  return { error: null }
}

export async function reviewSubmission(submissionId: string, feedback: string, pass: boolean) {
  if (!supabase) return { error: NOT_CONFIGURED }
  const { error } = await supabase.rpc('review_submission', {
    p_submission_id: submissionId,
    p_feedback: feedback,
    p_pass: pass,
  })
  if (error) return { error: error.message }
  await queryClient.invalidateQueries({ queryKey: ['week-roster'] })
  await queryClient.invalidateQueries({ queryKey: ['submissions'] })
  await queryClient.invalidateQueries({ queryKey: ['leaderboard'] })
  return { error: null }
}
