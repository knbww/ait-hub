import { Link } from 'react-router-dom'
import { BookOpen, ExternalLink } from 'lucide-react'
import { CardShell } from './CardShell'
import { DataState } from '../components/DataState'
import { SubmissionBadge } from '../components/SubmissionBadge'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useSchedule } from '../hooks/useClub'
import { useMySubmissions, useProgramWeeks } from '../hooks/useProgram'
import { PROGRAM_WEEKS, TRACK_IDS, currentWeekNumber, daysUntil, formatDay, formatShortDay, weekDeadline } from '../lib/club'
import { btnSecondary } from '../lib/ui'

/** This week of the member's track: topic, materials, deadline and their work's status. */
export function WeekCard() {
  const { t, tp } = useI18n()
  const { profile, isOversight } = useAuth()
  const track = profile?.track_id ?? null
  const schedule = useSchedule(profile?.cohort_id)
  const program = useProgramWeeks(track)
  const subs = useMySubmissions(track ? profile?.id : undefined)

  const dates = schedule.data ?? []
  const current = currentWeekNumber(dates)
  const week = program.data?.find((w) => w.week_number === current)
  const startsOn = dates.find((d) => d.week_number === current)?.starts_on
  const submission = week ? subs.data?.get(week.id) : undefined

  let body
  if (!track && isOversight) {
    // Director / curator lead the whole club: the week number and a way into each track.
    body = (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">
          {current === null ? t('week.noSchedule') : t('program.weekOf', { n: current, total: PROGRAM_WEEKS })}
        </p>
        <div className="flex flex-wrap gap-2">
          {TRACK_IDS.map((id) => (
            <Link key={id} to={`/program?track=${id}`} className={btnSecondary}>{t(`track.${id}.short`)}</Link>
          ))}
        </div>
      </div>
    )
  } else if (!track) {
    body = <p className="text-sm text-gray-700">{t('week.noTrack')}</p>
  } else if (!dates.length) {
    body = <p className="text-sm text-gray-700">{t('week.noSchedule')}</p>
  } else if (current === null) {
    body = <p className="text-sm text-gray-700">{t('week.startsOn', { date: formatDay(dates[0].starts_on) })}</p>
  } else if (week && startsOn) {
    const deadline = weekDeadline(startsOn)
    const left = daysUntil(deadline)
    body = (
      <div className="space-y-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-gray-500">
            {t('week.number', { n: week.week_number })} · {formatShortDay(startsOn)} – {formatShortDay(deadline)}
          </p>
          <h3 className="text-xl font-normal">{week.title}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <SubmissionBadge status={submission?.status} />
          {!submission && left >= 0 && (
            <span className="text-gray-600">
              {left === 0 ? t('week.dueToday') : tp('week.dueIn', left)}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {week.materials_url && (
            <a href={week.materials_url} target="_blank" rel="noreferrer" className={btnSecondary}>
              <ExternalLink className="w-4 h-4" /> {t('week.materials')}
            </a>
          )}
          <Link to={`/program#week-${week.week_number}`} className={btnSecondary}>
            {submission ? t('week.open') : t('week.submit')}
          </Link>
        </div>
      </div>
    )
  } else {
    body = <p className="text-sm text-gray-700">{t('week.after')}</p>
  }

  return (
    <CardShell icon={BookOpen} title={t('card.week')} to="/program" linkLabel={t('card.program')}>
      <DataState
        isLoading={schedule.isLoading || program.isLoading}
        error={schedule.error ?? program.error}
        onRetry={() => { void schedule.refetch(); void program.refetch() }}
      >
        {body}
      </DataState>
    </CardShell>
  )
}
