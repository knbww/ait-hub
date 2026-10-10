import { supabase } from './supabase'
import { notConfigured, refresh, rpc } from './mutate'
import { notify } from './push'
import { removeWorkFiles, uploadWorkFiles } from './workFiles'
import type { Result } from './mutate'
import type { MeetingKind, SubmissionStatus, TrackId, WorkFile } from './db'

/** New files go up first; the work then lists the kept and new ones. Files dropped from the
 * work are deleted after it is saved, new uploads if it isn't. */
export async function submitWork(
  weekId: string,
  profileId: string,
  fields: { link: string; comment: string },
  files: { keep: WorkFile[]; add: File[] },
  previous: WorkFile[],
): Promise<Result> {
  if (!supabase) return notConfigured()
  let uploaded: WorkFile[]
  try {
    uploaded = await uploadWorkFiles(profileId, files.add)
  } catch (error) {
    return { data: null, error }
  }
  const all = [...files.keep, ...uploaded]
  const res = await rpc('submit_work', {
    p_week: weekId,
    p_link: fields.link.trim() || null,
    p_comment: fields.comment.trim() || null,
    p_files: all,
  }, [['submissions'], ['week-work']])
  if (res.error) {
    await removeWorkFiles(uploaded.map((f) => f.path))
    return res
  }
  const kept = new Set(all.map((f) => f.path))
  await removeWorkFiles(previous.filter((f) => !kept.has(f.path)).map((f) => f.path))
  return res
}

export async function reviewWork(submissionId: string, status: Exclude<SubmissionStatus, 'submitted'>, feedback: string) {
  const res = await rpc('review_work', { p_submission: submissionId, p_status: status, p_feedback: feedback.trim() || null }, [
    ['week-work'],
    ['submissions'],
    ['track-progress'],
  ])
  if (!res.error) notify({ action: 'review', submission_id: submissionId })
  return res
}

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
