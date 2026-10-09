import { supabase } from './supabase'
import { notConfigured, refresh, rpc } from './mutate'
import type { Result } from './mutate'
import type { MeetingKind, SubmissionStatus, TrackId } from './db'

export const submitWork = (weekId: string, link: string, comment: string) =>
  rpc('submit_work', { p_week: weekId, p_link: link.trim(), p_comment: comment.trim() || null }, [
    ['submissions'],
  ])

export const reviewWork = (submissionId: string, status: Exclude<SubmissionStatus, 'submitted'>, feedback: string) =>
  rpc('review_work', { p_submission: submissionId, p_status: status, p_feedback: feedback.trim() || null }, [
    ['week-work'],
    ['submissions'],
  ])

export const setAttendance = (profileId: string, weekId: string, kind: MeetingKind, present: boolean) =>
  rpc('set_attendance', { p_profile: profileId, p_week: weekId, p_kind: kind, p_present: present }, [
    ['week-work'],
  ])

export async function updateWeek(
  weekId: string,
  fields: { title: string; materials_url: string | null; assignment: string | null },
): Promise<Result> {
  if (!supabase) return notConfigured()
  const { error } = await supabase.from('program_weeks').update(fields).eq('id', weekId)
  if (error) return { data: null, error }
  await refresh([['program']])
  return { data: null, error: null }
}

export async function updateTrackDrive(trackId: TrackId, driveUrl: string | null): Promise<Result> {
  if (!supabase) return notConfigured()
  const { error } = await supabase.from('tracks').update({ drive_url: driveUrl }).eq('id', trackId)
  if (error) return { data: null, error }
  await refresh([['tracks']])
  return { data: null, error: null }
}

export const setSchedule = (start: string, lastWeek: number) =>
  rpc('set_schedule', { p_start: start, p_last_week: lastWeek }, [['schedule']])

export const shiftSchedule = (fromWeek: number, days: number) =>
  rpc('shift_schedule', { p_from_week: fromWeek, p_days: days }, [['schedule']])
