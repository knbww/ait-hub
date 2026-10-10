// The catalog of competitions and opportunities: what a deadline means today, who an entry
// suits, and the order the list is shown in.

import { daysUntil, todayDay } from './club'
import type { OpportunityKind, OpportunityRegion, OpportunityRow, ProfileRow } from './db'

export const OPPORTUNITY_KINDS: OpportunityKind[] = [
  'olympiad', 'competition', 'hackathon', 'startup', 'program', 'camp', 'internship', 'grant', 'course', 'event',
]
export const OPPORTUNITY_REGIONS: OpportunityRegion[] = ['sko', 'kz', 'online', 'intl']

export type DeadlineState =
  | { kind: 'open'; days: number }
  | { kind: 'closed' }
  | { kind: 'upcoming'; days: number }
  | { kind: 'ongoing' }

/** Applications by the deadline; without one, the start date; without either, see the note. */
export function deadlineState(o: OpportunityRow, today = todayDay()): DeadlineState {
  if (o.deadline) return o.deadline >= today ? { kind: 'open', days: daysUntil(o.deadline) } : { kind: 'closed' }
  if (o.starts_on && o.starts_on >= today) return { kind: 'upcoming', days: daysUntil(o.starts_on) }
  return { kind: 'ongoing' }
}

/** Open for this member: their track (or any) and their grade, when the entry names grades. */
export function suits(o: OpportunityRow, profile: Pick<ProfileRow, 'track_id' | 'grade'> | null): boolean {
  if (!profile) return true
  if (o.tracks.length && profile.track_id && !o.tracks.includes(profile.track_id)) return false
  if (profile.grade) {
    if (o.grade_min && profile.grade < o.grade_min) return false
    if (o.grade_max && profile.grade > o.grade_max) return false
  }
  return true
}

/** Soonest open deadline first, then starts ahead, then year-round entries, then closed ones. */
export function byUrgency(a: OpportunityRow, b: OpportunityRow): number {
  const rank = (o: OpportunityRow) => {
    const s = deadlineState(o)
    if (s.kind === 'open') return [0, s.days] as const
    if (s.kind === 'upcoming') return [1, s.days] as const
    if (s.kind === 'ongoing') return [2, 0] as const
    return [3, -(o.deadline ? Date.parse(o.deadline) / 86_400_000 : 0)] as const
  }
  const [ra, da] = rank(a)
  const [rb, db] = rank(b)
  return ra - rb || da - db || a.title.localeCompare(b.title, 'ru')
}

export const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** «7–12 класс», «с 10 класса», «до 9 класса»; null when the entry names no grades. */
export function gradeLabel(o: Pick<OpportunityRow, 'grade_min' | 'grade_max'>): string | null {
  if (o.grade_min && o.grade_max) return o.grade_min === o.grade_max ? `${o.grade_min} класс` : `${o.grade_min}–${o.grade_max} класс`
  if (o.grade_min) return `с ${o.grade_min} класса`
  if (o.grade_max) return `до ${o.grade_max} класса`
  return null
}
