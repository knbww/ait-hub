// How the club is organised, as the UI needs it. Mirrors the CHECK constraints in
// supabase/migrations/2026100811* – 2026100816*.

import type { EventType, MeetingKind, PointsCategory, Role, TrackId } from './db'

export const TRACK_IDS: TrackId[] = ['ai', 'algo', 'startup']

export const GRADES = [7, 8, 9, 10, 11, 12] as const

export const STAFF_ROLES: Role[] = ['track_lead', 'director', 'curator']
export const isStaffRole = (role: Role | null | undefined) => !!role && STAFF_ROLES.includes(role)

export const POINT_CATEGORIES: PointsCategory[] = [
  'required_work',
  'extra_work',
  'project_stage',
  'event',
  'team_help',
  'org_contribution',
  'correction',
]

export const MEETING_KINDS: MeetingKind[] = ['lesson', 'practicum']

export const EVENT_TYPES: EventType[] = [
  'contest',
  'tournament',
  'pitch_review',
  'simulation',
  'workshop',
  'hackathon',
  'demo_day',
  'talkx',
  'club_evening',
]

/** Formats that belong to one track (the DB enforces it). */
export const EVENT_TRACK: Partial<Record<EventType, TrackId>> = {
  contest: 'algo',
  tournament: 'ai',
  pitch_review: 'startup',
  simulation: 'startup',
}

/** Only these formats can be rated events. */
export const RATED_TYPES: EventType[] = ['contest', 'tournament', 'pitch_review']

export const PROGRAM_WEEKS = 36

// ── Dates ────────────────────────────────────────────────────────────────────
// Week dates are plain `YYYY-MM-DD` strings (Postgres `date`); parse them as local dates so a
// Monday never turns into Sunday in UTC.

export function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toDay(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(day: string, days: number): string {
  const d = parseDay(day)
  d.setDate(d.getDate() + days)
  return toDay(d)
}

export function todayDay(): string {
  return toDay(new Date())
}

export function nowMs(): number {
  return Date.now()
}

/** Has an event (or anything with start / optional end) not finished yet? */
export function notOver(startsAt: string, endsAt: string | null, now = nowMs()): boolean {
  return Date.parse(endsAt ?? startsAt) >= now
}

/** A week's work is due by the end of its Sunday. */
export function weekDeadline(startsOn: string): string {
  return addDays(startsOn, 6)
}

/** Whole days from today to `day` (negative = in the past). */
export function daysUntil(day: string): number {
  return Math.round((parseDay(day).getTime() - parseDay(todayDay()).getTime()) / 86_400_000)
}

/** The current programme week: the last scheduled week that has started. */
export function currentWeekNumber(schedule: { week_number: number; starts_on: string }[]): number | null {
  const today = todayDay()
  let current: number | null = null
  for (const w of schedule) {
    if (w.starts_on <= today && (current === null || w.week_number > current)) current = w.week_number
  }
  return current
}

const dayFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' })
const shortDayFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' })
const dateTimeFormat = new Intl.DateTimeFormat('ru-RU', {
  weekday: 'short',
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
})
const monthFormat = new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' })

export const formatDay = (day: string) => dayFormat.format(parseDay(day))
export const formatShortDay = (day: string) => shortDayFormat.format(parseDay(day))
export const formatDateTime = (iso: string) => dateTimeFormat.format(new Date(iso))
export const formatDate = (iso: string) => dayFormat.format(new Date(iso))
export const formatMonth = (iso: string) => {
  const s = monthFormat.format(new Date(iso)).replace(' г.', '')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/** `datetime-local` input value ↔ ISO timestamp, in the viewer's time zone. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${toDay(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromLocalInput(value: string): string {
  return new Date(value).toISOString()
}

/** Russian plural: 1 участник · 2 участника · 5 участников. */
export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = Math.abs(n) % 10
  const mod100 = Math.abs(n) % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value.trim())
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}
