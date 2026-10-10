import { Link } from 'react-router-dom'
import { TrendingUp } from 'lucide-react'
import { CardShell } from './CardShell'
import { DataState } from '../components/DataState'
import { ProgressRing } from '../components/ProgressRing'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useSchedule } from '../hooks/useClub'
import { useMySubmissions, useProgramWeeks, useTrackProgress } from '../hooks/useProgram'
import { summarize } from '../lib/progress'
import { formatShortDay } from '../lib/club'

/** Members: how far to the certificate and what to do next. */
function MemberProgressCard() {
  const { t } = useI18n()
  const { profile } = useAuth()
  const track = profile?.track_id ?? null
  const schedule = useSchedule(profile?.cohort_id)
  const program = useProgramWeeks(track)
  const subs = useMySubmissions(track ? profile?.id : undefined)
  const s = summarize(program.data ?? [], schedule.data ?? [], subs.data)
  const fix = s.needsWork[0]
  const current = s.current

  let next: string
  if (fix) next = t('progress.next.fix', { n: fix.week.week_number })
  else if (current && current.state === 'current' && current.deadline) {
    next = t('progress.next.handIn', { title: current.week.title, date: formatShortDay(current.deadline) })
  } else next = t('progress.next.allDone')

  return (
    <CardShell icon={TrendingUp} title={t('card.progress')} to="/progress" linkLabel={t('card.more')}>
      <DataState isLoading={schedule.isLoading || program.isLoading || subs.isLoading}
        error={schedule.error ?? program.error ?? subs.error}
        onRetry={() => { void schedule.refetch(); void program.refetch(); void subs.refetch() }}
        empty={!track} emptyText={t('week.noTrack')}>
        <div className="flex items-center gap-4">
          <ProgressRing value={s.certificate} size={84} label={t('progress.certificateAria')} />
          <div className="min-w-0 text-sm">
            <p>{s.milestones.length
              ? t('progress.milestonesDone', { n: s.milestones.filter((m) => m.state === 'accepted').length, total: s.milestones.length })
              : t('progress.weeksAccepted', { n: s.accepted, total: s.due })}</p>
            <p className="text-gray-700 mt-1">{next}</p>
          </div>
        </div>
      </DataState>
    </CardShell>
  )
}

/** Staff: who in the track is falling behind. */
function StaffProgressCard() {
  const { t } = useI18n()
  const { profile, isOversight } = useAuth()
  const track = isOversight ? null : (profile?.track_id ?? null)
  const schedule = useSchedule(profile?.cohort_id)
  const program = useProgramWeeks(track)
  const data = useTrackProgress(track, Boolean(track))
  const behind = (data.data?.members ?? [])
    .map((m) => ({ m, s: summarize(program.data ?? [], schedule.data ?? [], data.data?.submissions.get(m.id)) }))
    .filter(({ s }) => s.missed > 0 || s.needsWork.length > 0)
    .sort((a, b) => b.s.missed - a.s.missed)
    .slice(0, 4)

  return (
    <CardShell icon={TrendingUp} title={t('card.behind')} to="/progress" linkLabel={t('card.more')}>
      {!track ? (
        <p className="text-sm text-gray-700">{t('progress.pickTrack')}</p>
      ) : (
        <DataState isLoading={data.isLoading || program.isLoading} error={data.error ?? program.error}
          onRetry={() => { void data.refetch(); void program.refetch() }}
          empty={behind.length === 0} emptyText={t('progress.nobodyBehind')}>
          <ul className="space-y-2 text-sm">
            {behind.map(({ m, s }) => (
              <li key={m.id} className="flex items-center justify-between gap-3">
                <Link to={`/members/${m.id}`} className="underline truncate">{m.full_name}</Link>
                <span className="text-xs text-gray-600 whitespace-nowrap">
                  {t('progress.behindLine', { missed: s.missed, fix: s.needsWork.length })}
                </span>
              </li>
            ))}
          </ul>
        </DataState>
      )}
    </CardShell>
  )
}

export function ProgressCard() {
  const { isStaff } = useAuth()
  return isStaff ? <StaffProgressCard /> : <MemberProgressCard />
}
