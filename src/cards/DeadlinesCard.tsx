import { Link } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { CardShell } from './CardShell'
import { DataState } from '../components/DataState'
import { SubmissionBadge } from '../components/SubmissionBadge'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useSchedule } from '../hooks/useClub'
import { useMySubmissions, useProgramWeeks } from '../hooks/useProgram'
import { currentWeekNumber, daysUntil, formatShortDay, weekDeadline } from '../lib/club'

/** Works that need attention: this week's and last week's, plus anything sent back. */
export function DeadlinesCard() {
  const { t, tp } = useI18n()
  const { profile } = useAuth()
  const track = profile?.track_id ?? null
  const schedule = useSchedule(profile?.cohort_id)
  const program = useProgramWeeks(track)
  const subs = useMySubmissions(track ? profile?.id : undefined)

  const dates = new Map((schedule.data ?? []).map((d) => [d.week_number, d.starts_on]))
  const current = currentWeekNumber(schedule.data ?? [])
  const items = (program.data ?? [])
    .filter((w) => {
      const status = subs.data?.get(w.id)?.status
      if (!dates.has(w.week_number) || current === null || w.week_number > current) return false
      if (status === 'needs_work') return true
      return w.week_number >= current - 1 && status !== 'accepted' && status !== 'submitted'
    })
    .map((w) => ({ week: w, deadline: weekDeadline(dates.get(w.week_number)!) }))
    .sort((a, b) => a.deadline.localeCompare(b.deadline))
    .slice(0, 4)

  return (
    <CardShell icon={Clock} title={t('card.deadlines')} to="/program" linkLabel={t('card.program')}>
      <DataState
        isLoading={schedule.isLoading || program.isLoading || subs.isLoading}
        error={schedule.error ?? program.error ?? subs.error}
        onRetry={() => { void schedule.refetch(); void program.refetch(); void subs.refetch() }}
        empty={!track || items.length === 0}
        emptyText={track ? t('deadlines.none') : t('week.noTrack')}
      >
        <ul className="space-y-2">
          {items.map(({ week, deadline }) => {
            const left = daysUntil(deadline)
            return (
              <li key={week.id}>
                <Link to={`/program#week-${week.week_number}`}
                  className="flex items-start justify-between gap-3 p-3 rounded-2xl border border-white/50 bg-white/20 hover:bg-white/40 transition-colors">
                  <span className="min-w-0">
                    <span className="block text-sm truncate">{t('week.number', { n: week.week_number })} · {week.title}</span>
                    <span className={`block text-xs ${left < 0 ? 'text-red-700' : 'text-gray-600'}`}>
                      {t('deadlines.until', { date: formatShortDay(deadline) })}
                      {left < 0 ? ` · ${t('deadlines.overdue')}` : left === 0 ? ` · ${t('week.dueToday')}` : ` · ${tp('week.dueIn', left)}`}
                    </span>
                  </span>
                  <SubmissionBadge status={subs.data?.get(week.id)?.status} />
                </Link>
              </li>
            )
          })}
        </ul>
      </DataState>
    </CardShell>
  )
}
