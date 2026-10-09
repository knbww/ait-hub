import { useState } from 'react'
import type { FormEvent } from 'react'
import { motion } from 'framer-motion'
import { Link, useSearchParams } from 'react-router-dom'
import { Download } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { DataState, ErrorText } from '../components/DataState'
import { JoinCodePanel } from '../components/JoinCodePanel'
import { TrackBadge } from '../components/TrackBadge'
import { pageVariants } from '../lib/animations'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useMembers, useSchedule } from '../hooks/useClub'
import { useAuditLog, useJoinCodes } from '../hooks/useManage'
import { setSchedule, shiftSchedule } from '../lib/programActions'
import { supabase } from '../lib/supabase'
import { downloadCsv, stampedName } from '../lib/download'
import { PROGRAM_WEEKS, TRACK_IDS, formatDateTime, formatShortDay, parseDay, plural } from '../lib/club'
import type { Role, TrackId } from '../lib/db'
import { btnPrimary, btnSecondary, chip, inputClass, labelClass, pageTitle, sectionTitle, segment } from '../lib/ui'

type Tab = 'members' | 'codes' | 'schedule' | 'export' | 'audit'

function MembersTab() {
  const { t } = useI18n()
  const { profile, isOversight } = useAuth()
  const members = useMembers()
  const [query, setQuery] = useState('')
  const [track, setTrack] = useState<TrackId | 'all' | 'none'>(isOversight ? 'all' : (profile?.track_id ?? 'all'))
  const [role, setRole] = useState<Role | 'all'>('all')
  const [showInactive, setShowInactive] = useState(false)

  const list = (members.data ?? []).filter((m) =>
    (showInactive || m.status === 'active')
    && (track === 'all' || (track === 'none' ? !m.track_id : m.track_id === track))
    && (role === 'all' || m.role === role)
    && m.full_name.toLowerCase().includes(query.trim().toLowerCase()),
  )

  return (
    <GlassCard>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
        <input className={inputClass} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('manage.search')} />
        <select className={inputClass} value={track} onChange={(e) => setTrack(e.target.value as TrackId | 'all' | 'none')}>
          <option value="all">{t('manage.allTracks')}</option>
          {TRACK_IDS.map((id) => <option key={id} value={id}>{t(`track.${id}`)}</option>)}
          <option value="none">{t('manage.noTrack')}</option>
        </select>
        <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value as Role | 'all')}>
          <option value="all">{t('manage.allRoles')}</option>
          {(['member', 'track_lead', 'director', 'curator'] as Role[]).map((r) => <option key={r} value={r}>{t(`role.${r}`)}</option>)}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm mb-3">
        <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
        {t('manage.showInactive')}
      </label>
      <p className="text-xs text-gray-600 mb-2">{t('manage.count', { n: list.length, word: plural(list.length, t('word.member1'), t('word.member2'), t('word.member5')) })}</p>
      <DataState isLoading={members.isLoading} error={members.error} onRetry={() => void members.refetch()}
        empty={list.length === 0} emptyText={t('manage.noMembers')}>
        <ul className="divide-y divide-white/50">
          {list.map((m) => (
            <li key={m.id}>
              <Link to={`/members/${m.id}`} className="flex flex-wrap items-center gap-2 py-2.5 hover:bg-white/30 rounded-lg px-1">
                <span className="flex-1 min-w-[10rem] text-sm">{m.full_name}</span>
                {m.grade && <span className="text-xs text-gray-600">{t('common.gradeN', { n: m.grade })}</span>}
                <TrackBadge track={m.track_id} />
                {m.role !== 'member' && <span className={`${chip} bg-[#750014]/10 text-[#750014]`}>{t(`role.${m.role}`)}</span>}
                {m.status === 'inactive' && <span className={`${chip} bg-gray-900/10`}>{t('member.inactive')}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </DataState>
    </GlassCard>
  )
}

function CodesTab() {
  const { t } = useI18n()
  const codes = useJoinCodes(true)
  const list = [...(codes.data ?? [])].sort((a, b) => a.track_id.localeCompare(b.track_id))
  return (
    <GlassCard>
      <p className="text-sm text-gray-700 mb-4">{t('codes.intro')}</p>
      <DataState isLoading={codes.isLoading} error={codes.error} onRetry={() => void codes.refetch()}
        empty={list.length === 0} emptyText={t('codes.none')}>
        <div className="space-y-6">
          {list.map((code) => <JoinCodePanel key={code.code} code={code} />)}
        </div>
      </DataState>
    </GlassCard>
  )
}

function ScheduleTab() {
  const { t } = useI18n()
  const { profile } = useAuth()
  const schedule = useSchedule(profile?.cohort_id)
  const [start, setStart] = useState('')
  const [lastWeek, setLastWeek] = useState(String(PROGRAM_WEEKS))
  const [fromWeek, setFromWeek] = useState('')
  const [days, setDays] = useState('7')
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)

  const build = async (e: FormEvent) => {
    e.preventDefault()
    if (parseDay(start).getDay() !== 1 && !window.confirm(t('schedule.notMonday'))) return
    if (schedule.data?.length && !window.confirm(t('schedule.replaceConfirm'))) return
    setBusy(true)
    const res = await setSchedule(start, Number(lastWeek))
    setBusy(false)
    setError(res.error)
  }

  const shift = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const res = await shiftSchedule(Number(fromWeek), Number(days))
    setBusy(false)
    setError(res.error)
  }

  return (
    <div className="space-y-4">
      <GlassCard>
        <h2 className={sectionTitle}>{t('schedule.build')}</h2>
        <p className="text-sm text-gray-700 mt-1 mb-3">{t('schedule.buildHint')}</p>
        <form onSubmit={build} className="grid grid-cols-1 sm:grid-cols-[1fr_8rem_auto] gap-3 items-end">
          <div>
            <label className={labelClass}>{t('schedule.start')}</label>
            <input className={inputClass} type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
          </div>
          <div>
            <label className={labelClass}>{t('schedule.lastWeek')}</label>
            <input className={inputClass} type="number" min={1} max={36} value={lastWeek} onChange={(e) => setLastWeek(e.target.value)} required />
          </div>
          <button type="submit" disabled={busy} className={btnPrimary}>{t('schedule.buildButton')}</button>
        </form>
      </GlassCard>

      <GlassCard>
        <h2 className={sectionTitle}>{t('schedule.shift')}</h2>
        <p className="text-sm text-gray-700 mt-1 mb-3">{t('schedule.shiftHint')}</p>
        <form onSubmit={shift} className="grid grid-cols-2 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div>
            <label className={labelClass}>{t('schedule.fromWeek')}</label>
            <input className={inputClass} type="number" min={1} max={36} value={fromWeek} onChange={(e) => setFromWeek(e.target.value)} required />
          </div>
          <div>
            <label className={labelClass}>{t('schedule.days')}</label>
            <select className={inputClass} value={days} onChange={(e) => setDays(e.target.value)}>
              {[7, 14, -7].map((d) => <option key={d} value={d}>{t('schedule.daysOption', { n: d > 0 ? `+${d}` : d })}</option>)}
            </select>
          </div>
          <button type="submit" disabled={busy || !schedule.data?.length} className={`${btnSecondary} col-span-2 sm:col-span-1`}>
            {t('schedule.shiftButton')}
          </button>
        </form>
        <ErrorText error={error} />
      </GlassCard>

      <GlassCard>
        <h2 className={sectionTitle}>{t('schedule.current')}</h2>
        <DataState isLoading={schedule.isLoading} error={schedule.error} onRetry={() => void schedule.refetch()}
          empty={(schedule.data ?? []).length === 0} emptyText={t('week.noSchedule')}>
          <ol className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 mt-3 text-sm">
            {(schedule.data ?? []).map((w) => (
              <li key={w.week_number} className="flex justify-between gap-2">
                <span className="text-gray-600">{t('week.number', { n: w.week_number })}</span>
                <span>{formatShortDay(w.starts_on)}</span>
              </li>
            ))}
          </ol>
        </DataState>
      </GlassCard>
    </div>
  )
}

function ExportTab() {
  const { t } = useI18n()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)

  const exportCsv = async (kind: 'members' | 'points' | 'results') => {
    if (!supabase) return
    setBusy(kind)
    setError(null)
    const fn = { members: 'export_members', points: 'export_points', results: 'export_results' }[kind]
    const { data, error: rpcError } = await supabase.rpc(fn)
    setBusy(null)
    if (rpcError) return setError(rpcError)
    const rows = (data ?? []) as Record<string, unknown>[]
    if (kind === 'members') {
      downloadCsv(stampedName('ait-hub-members', 'csv'),
        [t('csv.name'), t('csv.grade'), t('csv.track'), t('csv.role'), t('csv.status'), t('csv.email'), t('csv.telegram'), t('csv.photo'), 'AIT Points', t('csv.joined')],
        rows.map((r) => [r.full_name as string, r.grade as number, r.track as string, t(`role.${r.role}`),
          t(`status.${r.status}`), r.email as string, r.telegram ? `@${r.telegram}` : '', r.photo_consent as boolean | null,
          r.points as number, String(r.joined_at).slice(0, 10)]))
    } else if (kind === 'points') {
      downloadCsv(stampedName('ait-hub-ait-points', 'csv'),
        [t('csv.date'), t('csv.name'), t('csv.track'), 'AIP', t('csv.category'), t('csv.note'), t('csv.confirmedBy')],
        rows.map((r) => [String(r.created_at).slice(0, 10), r.member as string, r.track as string, r.amount as number,
          t(`points.category.${r.category}`), r.note as string, r.awarded_by as string]))
    } else {
      downloadCsv(stampedName('ait-hub-results', 'csv'),
        [t('csv.kind'), t('csv.name'), t('csv.track'), t('csv.item'), t('csv.status'), t('csv.place'), t('csv.score'), t('csv.ratingDelta'), t('csv.date')],
        rows.map((r) => [t(`csv.kind.${r.kind}`), r.member as string, r.track as string, r.item as string,
          r.kind === 'work' ? t(`work.status.${r.status}`) : t(`event.status.${r.status}`),
          r.place as number | null, r.score as number | null, r.rating_delta as number | null, String(r.happened_at).slice(0, 10)]))
    }
  }

  return (
    <GlassCard>
      <h2 className={sectionTitle}>{t('export.title')}</h2>
      <p className="text-sm text-gray-700 mt-1 mb-4">{t('export.hint')}</p>
      <div className="flex flex-wrap gap-2">
        {(['members', 'points', 'results'] as const).map((kind) => (
          <button key={kind} onClick={() => exportCsv(kind)} disabled={busy !== null} className={btnSecondary}>
            <Download className="w-4 h-4" /> {busy === kind ? t('common.wait') : t(`export.${kind}`)}
          </button>
        ))}
      </div>
      <ErrorText error={error} />
    </GlassCard>
  )
}

function AuditTab() {
  const { t } = useI18n()
  const log = useAuditLog(true)
  return (
    <GlassCard>
      <p className="text-sm text-gray-700 mb-3">{t('audit.hint')}</p>
      <DataState isLoading={log.isLoading} error={log.error} onRetry={() => void log.refetch()}
        empty={(log.data ?? []).length === 0} emptyText={t('audit.empty')}>
        <ul className="divide-y divide-white/50">
          {(log.data ?? []).map((row) => {
            const d = row.details as Record<string, string | number | null>
            const extra = [d.full_name, d.title, d.track && t(`track.${d.track}.short`), d.from && d.to && `${d.from} → ${d.to}`]
              .filter(Boolean).join(' · ')
            return (
              <li key={row.id} className="py-2 text-sm">
                <p>
                  <span className="font-normal">{row.actor?.full_name ?? t('audit.system')}</span>{' '}
                  <span className="text-gray-700">{t(`audit.${row.action}`)}</span>
                  {row.target_id && <> · <Link to={`/members/${row.target_id}`} className="underline">{t('audit.target')}</Link></>}
                </p>
                <p className="text-xs text-gray-600">{formatDateTime(row.created_at)}{extra && ` · ${extra}`}</p>
              </li>
            )
          })}
        </ul>
      </DataState>
    </GlassCard>
  )
}

export function ManagePage() {
  const { t } = useI18n()
  const { isOversight } = useAuth()
  const [params, setParams] = useSearchParams()
  const tabs: Tab[] = isOversight ? ['members', 'codes', 'schedule', 'export', 'audit'] : ['members', 'codes', 'export']
  const requested = params.get('tab') as Tab | null
  const tab: Tab = requested && tabs.includes(requested) ? requested : 'members'

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="max-w-4xl mx-auto space-y-4">
      <GlassCard>
        <h1 className={pageTitle}>{t('manage.title')}</h1>
        <div className="flex gap-2 mt-3 overflow-x-auto -mx-1 px-1 pb-1">
          {tabs.map((id) => (
            <button key={id} className={segment(tab === id)} onClick={() => setParams({ tab: id }, { replace: true })}>
              {t(`manage.tab.${id}`)}
            </button>
          ))}
        </div>
      </GlassCard>
      {tab === 'members' && <MembersTab />}
      {tab === 'codes' && <CodesTab />}
      {tab === 'schedule' && <ScheduleTab />}
      {tab === 'export' && <ExportTab />}
      {tab === 'audit' && <AuditTab />}
    </motion.div>
  )
}
