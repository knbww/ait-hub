// «Мой прогресс»: everything is computed from the programme, the schedule and the member's works —
// nothing new is stored. A week's work is due by the end of its Sunday (weekDeadline).

import type { CohortWeekRow, ProgramWeekRow, SubmissionRow } from './db'
import { PROGRAM_WEEKS, todayDay, weekDeadline } from './club'

export type WeekState = 'accepted' | 'submitted' | 'needs_work' | 'missed' | 'current' | 'upcoming' | 'optional'

export interface WeekProgress {
  week: ProgramWeekRow
  startsOn: string | null
  deadline: string | null
  state: WeekState
  work: SubmissionRow | undefined
}

export interface ProgressSummary {
  weeks: WeekProgress[]
  accepted: number
  /** Weeks whose deadline has passed (reserve weeks excluded). */
  due: number
  onReview: number
  needsWork: WeekProgress[]
  missed: number
  /** Weeks in a row handed in (accepted, on review or sent back), ending with the last week that is due. */
  streak: number
  milestones: WeekProgress[]
  /** 0…1 towards the certificate: milestones if the track has them, otherwise accepted weeks of the year. */
  certificate: number
  current: WeekProgress | null
}

const isReserve = (w: ProgramWeekRow) => w.title.trim().toLowerCase() === 'резерв'

export function summarize(
  program: ProgramWeekRow[],
  schedule: CohortWeekRow[],
  works: Map<string, SubmissionRow> | undefined,
  today = todayDay(),
): ProgressSummary {
  const starts = new Map(schedule.map((s) => [s.week_number, s.starts_on]))
  const weeks: WeekProgress[] = program.map((week) => {
    const startsOn = starts.get(week.week_number) ?? null
    const deadline = startsOn ? weekDeadline(startsOn) : null
    const work = works?.get(week.id)
    let state: WeekState
    if (work?.status === 'accepted') state = 'accepted'
    else if (work?.status === 'needs_work') state = 'needs_work'
    else if (work?.status === 'submitted') state = 'submitted'
    else if (!startsOn || startsOn > today) state = 'upcoming'
    else if (deadline && deadline >= today) state = 'current'
    else state = isReserve(week) ? 'optional' : 'missed'
    return { week, startsOn, deadline, state, work }
  })

  const dueWeeks = weeks.filter((w) => w.deadline && w.deadline < today && !isReserve(w.week))
  let streak = 0
  for (const w of [...dueWeeks].reverse()) {
    if (w.state === 'missed') break
    streak++
  }
  const milestones = weeks.filter((w) => w.week.milestone)
  const accepted = weeks.filter((w) => w.state === 'accepted').length
  const certificate = milestones.length
    ? milestones.filter((w) => w.state === 'accepted').length / milestones.length
    : accepted / Math.max(1, Math.min(PROGRAM_WEEKS, program.filter((w) => !isReserve(w)).length))

  return {
    weeks,
    accepted,
    due: dueWeeks.length,
    onReview: weeks.filter((w) => w.state === 'submitted').length,
    needsWork: weeks.filter((w) => w.state === 'needs_work'),
    missed: weeks.filter((w) => w.state === 'missed').length,
    streak,
    milestones,
    certificate,
    current: weeks.find((w) => w.startsOn && w.deadline && w.startsOn <= today && w.deadline >= today) ?? null,
  }
}

/** The "Сдать: …" line of a week's assignment. */
export function handInLine(assignment: string | null): string | null {
  const line = assignment?.split('\n').find((l) => l.startsWith('Сдать:'))
  return line ? line.replace(/^Сдать:\s*/, '') : null
}
