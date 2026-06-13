import type { Submission, WeekStatus } from '../types'

/** Derive a week's status from the member's submission for it.
 * not_started → no submission · submitted → handed in · reviewed → graded.
 * Accepts any object exposing `status` (full Submission or a host-roster slice). */
export function weekStatus(submission?: { status: 'submitted' | 'reviewed' }): WeekStatus {
  if (submission?.status === 'reviewed') return 'reviewed'
  if (submission) return 'submitted'
  return 'not_started'
}

/** Season completion = weeks whose submission was reviewed and passed. */
export function seasonProgress(
  weekIds: string[],
  submissions: Map<string, Submission>,
): { done: number; total: number } {
  let done = 0
  for (const id of weekIds) {
    const s = submissions.get(id)
    if (s?.status === 'reviewed' && s.passed) done++
  }
  return { done, total: weekIds.length }
}

/** Human-readable, localized label for a week status (used by badges). */
export const WEEK_STATUS_LABEL: Record<WeekStatus, string> = {
  not_started: 'Не начато',
  submitted: 'Сдано',
  reviewed: 'Проверено',
}
