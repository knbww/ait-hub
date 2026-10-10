import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { CircleCheck, CircleDashed, Clock, RotateCcw } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { DataState } from '../components/DataState'
import { LinkifiedText } from '../components/LinkifiedText'
import { ProgressRing } from '../components/ProgressRing'
import { WeekGrid } from '../components/WeekGrid'
import { pageVariants } from '../lib/animations'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useSchedule } from '../hooks/useClub'
import { useMySubmissions, useProgramWeeks, useTrackProgress } from '../hooks/useProgram'
import { handInLine, summarize } from '../lib/progress'
import type { ProgressSummary, WeekProgress } from '../lib/progress'
import { TRACK_IDS, daysUntil, formatShortDay } from '../lib/club'
import type { TrackId } from '../lib/db'
import { btnSecondary, pageTitle, sectionTitle, segment } from '../lib/ui'

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div>
      <p className="text-2xl font-light">{value}</p>
      <p className="text-xs text-gray-600">{label}</p>
    </div>
  )
}

function MilestoneIcon({ w }: { w: WeekProgress }) {
  if (w.state === 'accepted') return <CircleCheck className="w-5 h-5 text-green-700" />
  if (w.state === 'needs_work') return <RotateCcw className="w-5 h-5 text-amber-600" />
  if (w.state === 'submitted') return <Clock className="w-5 h-5 text-sky-600" />
  return <CircleDashed className="w-5 h-5 text-gray-400" />
}

function MemberProgress({ track, s }: { track: TrackId; s: ProgressSummary }) {
  const { t, tp } = useI18n()
  const current = s.current
  const left = current?.deadline ? daysUntil(current.deadline) : null
  return (
    <>
      <GlassCard>
        <div className="flex flex-wrap items-center gap-5">
          <ProgressRing value={s.certificate} size={112} label={t('progress.certificateAria')} />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-gray-700 mb-3">{t(`progress.rule.${track}`)}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat value={`${s.accepted}/${s.due}`} label={t('progress.acceptedOfDue')} />
              <Stat value={s.streak} label={t('progress.streak')} />
              <Stat value={s.onReview} label={t('progress.onReview')} />
              <Stat value={s.missed} label={t('progress.missed')} />
            </div>
          </div>
        </div>
      </GlassCard>

      {current && (
        <GlassCard>
          <p className="text-xs uppercase tracking-wider text-gray-500">
            {t('week.number', { n: current.week.week_number })}
            {current.deadline && ` · ${t('deadlines.until', { date: formatShortDay(current.deadline) })}`}
            {left !== null && left >= 0 && ` · ${left === 0 ? t('week.dueToday') : tp('week.dueIn', left)}`}
          </p>
          <h2 className={sectionTitle}>{current.week.title}</h2>
          {handInLine(current.week.assignment) && (
            <p className="text-sm text-gray-800 mt-2">
              <span className="font-medium">{t('progress.handIn')}</span> {handInLine(current.week.assignment)}
            </p>
          )}
          <p className="text-sm mt-2">{t(`progress.state.${current.state}`)}</p>
          <Link to={`/program#week-${current.week.week_number}`} className={`${btnSecondary} mt-3`}>{t('week.open')}</Link>
        </GlassCard>
      )}

      {s.needsWork.length > 0 && (
        <GlassCard className="!bg-amber-50/60">
          <h2 className={sectionTitle}>{t('progress.needsWork')}</h2>
          <ul className="mt-3 space-y-3">
            {s.needsWork.map((w) => (
              <li key={w.week.id} className="text-sm">
                <Link to={`/program#week-${w.week.week_number}`} className="underline">
                  {t('week.number', { n: w.week.week_number })} · {w.week.title}
                </Link>
                {w.work?.feedback && <LinkifiedText text={w.work.feedback} className="text-gray-700 mt-1" />}
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      {s.milestones.length > 0 && (
        <GlassCard>
          <h2 className={sectionTitle}>{t(`progress.milestones.${track}`)}</h2>
          <p className="text-sm text-gray-700 mb-3">
            {t('progress.milestonesDone', { n: s.milestones.filter((m) => m.state === 'accepted').length, total: s.milestones.length })}
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {s.milestones.map((m) => (
              <li key={m.week.id}>
                <Link to={`/program#week-${m.week.week_number}`}
                  className="flex items-center gap-2 p-2.5 rounded-xl border border-white/60 bg-white/30 hover:bg-white/50 text-sm">
                  <MilestoneIcon w={m} />
                  <span className="flex-1">{m.week.milestone}</span>
                  <span className="text-xs text-gray-500">{t('week.number', { n: m.week.week_number })}</span>
                </Link>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      <GlassCard>
        <h2 className={`${sectionTitle} mb-3`}>{t('progress.allWeeks')}</h2>
        <WeekGrid weeks={s.weeks} />
      </GlassCard>
    </>
  )
}

function TrackOverview({ track }: { track: TrackId }) {
  const { t } = useI18n()
  const { profile } = useAuth()
  const schedule = useSchedule(profile?.cohort_id)
  const program = useProgramWeeks(track)
  const data = useTrackProgress(track, true)

  const rows = (data.data?.members ?? []).map((m) => ({
    member: m,
    s: summarize(program.data ?? [], schedule.data ?? [], data.data?.submissions.get(m.id)),
  }))
  rows.sort((a, b) => b.s.missed - a.s.missed || a.s.accepted - b.s.accepted || a.member.full_name.localeCompare(b.member.full_name))
  const hasMilestones = (program.data ?? []).some((w) => w.milestone)

  return (
    <GlassCard>
      <h2 className={sectionTitle}>{t('progress.trackTitle')}</h2>
      <p className="text-sm text-gray-700 mb-3">{t('progress.trackHint')}</p>
      <DataState isLoading={data.isLoading || program.isLoading || schedule.isLoading}
        error={data.error ?? program.error ?? schedule.error}
        onRetry={() => { void data.refetch(); void program.refetch(); void schedule.refetch() }}
        empty={rows.length === 0} emptyText={t('program.noMembers')}>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-sm min-w-[32rem]">
            <thead>
              <tr className="text-left text-xs text-gray-600">
                <th className="font-normal py-2 px-1">{t('progress.col.member')}</th>
                <th className="font-normal py-2 px-1">{t('progress.col.accepted')}</th>
                {hasMilestones && <th className="font-normal py-2 px-1">{t('progress.col.milestones')}</th>}
                <th className="font-normal py-2 px-1">{t('progress.col.missed')}</th>
                <th className="font-normal py-2 px-1">{t('progress.col.review')}</th>
                <th className="font-normal py-2 px-1">{t('progress.col.needsWork')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ member, s }) => (
                <tr key={member.id} className="border-t border-white/60">
                  <td className="py-2 px-1"><Link to={`/members/${member.id}`} className="underline">{member.full_name}</Link></td>
                  <td className="py-2 px-1">{s.accepted}/{s.due}</td>
                  {hasMilestones && <td className="py-2 px-1">{s.milestones.filter((m) => m.state === 'accepted').length}/{s.milestones.length}</td>}
                  <td className={`py-2 px-1 ${s.missed > 1 ? 'text-red-700 font-medium' : ''}`}>{s.missed}</td>
                  <td className="py-2 px-1">{s.onReview}</td>
                  <td className="py-2 px-1">{s.needsWork.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>
    </GlassCard>
  )
}

export function ProgressPage() {
  const { t } = useI18n()
  const { profile, isStaff, isOversight } = useAuth()
  const [pick, setPick] = useState<TrackId>('ai')
  const track: TrackId | null = isOversight ? pick : (profile?.track_id ?? null)
  const schedule = useSchedule(profile?.cohort_id)
  const program = useProgramWeeks(isStaff ? null : track)
  const subs = useMySubmissions(isStaff ? undefined : profile?.id)

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="max-w-3xl mx-auto space-y-4">
      <GlassCard>
        <h1 className={pageTitle}>{isStaff ? t('progress.staffTitle') : t('progress.title')}</h1>
        {track && <p className="text-gray-700">{t(`track.${track}`)}</p>}
        {isOversight && (
          <div className="flex flex-wrap gap-2 mt-3">
            {TRACK_IDS.map((id) => (
              <button key={id} className={segment(id === pick)} onClick={() => setPick(id)}>{t(`track.${id}.short`)}</button>
            ))}
          </div>
        )}
      </GlassCard>

      {!track ? (
        <GlassCard><p className="text-sm text-gray-700">{t('week.noTrack')}</p></GlassCard>
      ) : isStaff ? (
        <TrackOverview key={track} track={track} />
      ) : (
        <DataState isLoading={program.isLoading || schedule.isLoading || subs.isLoading}
          error={program.error ?? schedule.error ?? subs.error}
          onRetry={() => { void program.refetch(); void schedule.refetch(); void subs.refetch() }}>
          <MemberProgress track={track} s={summarize(program.data ?? [], schedule.data ?? [], subs.data)} />
        </DataState>
      )}
    </motion.div>
  )
}
