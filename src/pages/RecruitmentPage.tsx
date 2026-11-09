import { useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Download, KeyRound, ShieldCheck, UserPlus } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { DataState, ErrorText } from '../components/DataState'
import { PageLoading } from '../components/RequireAuth'
import { pageVariants } from '../lib/animations'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useMembers } from '../hooks/useClub'
import { useApplications, useRecruitmentAccess, useRecruitmentTeam, useRecruitmentWindow } from '../hooks/useRecruitment'
import { exportApplications, grantRecruitmentAccess, revokeRecruitmentAccess, setRecruitmentWindow } from '../lib/recruitmentActions'
import {
  APPLICATION_STATUSES, AVAILABILITY_QUESTIONS, DEPARTMENTS, DEPARTMENT_QUESTIONS, ROLES, answerText, applicantStatusLabel, department, role,
  statusLabel,
} from '../lib/recruitment'
import { downloadCsv, stampedName } from '../lib/download'
import { formatDate, formatDateTime, nowMs, plural } from '../lib/club'
import type { RecruitmentAccess, RecruitmentTeamRow, TeamApplicationRow } from '../lib/db'
import { btnPrimary, btnSecondary, btnSmall, chip, inputClass, labelClass, pageTitle, sectionTitle } from '../lib/ui'

/** The stage of an application as a chip: always the word, the shade only helps. */
export function StageChip({ status }: { status: string }) {
  const tone = status === 'applied' ? 'bg-white/80 border border-gray-900/15 text-gray-900'
    : status === 'accepted' ? 'bg-gray-900 text-white'
      : status === 'rejected' || status === 'withdrawn' ? 'border border-gray-900/10 text-gray-500'
        : 'bg-gray-900/[0.07] text-gray-900'
  return <span className={`${chip} ${tone}`}>{statusLabel(status)}</span>
}

/** Access to the applications: decided by the database, explained here. */
export function RecruitmentGate({ children }: { children: (access: RecruitmentAccess) => ReactNode }) {
  const { t } = useI18n()
  const { profile } = useAuth()
  const access = useRecruitmentAccess(profile?.id)
  if (access.isLoading) return <PageLoading />
  if (access.error || !access.data) {
    return (
      <div className="max-w-md mx-auto">
        <GlassCard><DataState isLoading={false} error={access.error ?? new Error('generic')} onRetry={() => void access.refetch()}>{null}</DataState></GlassCard>
      </div>
    )
  }
  if (access.data === 'none' || access.data === 'needs_code') {
    const code = access.data === 'needs_code'
    return (
      <div className="max-w-md mx-auto">
        <GlassCard className="text-center">
          <h1 className="text-2xl font-light mb-2">{t(code ? 'recruit.needsCode.title' : 'recruit.noAccess.title')}</h1>
          <p className="text-sm text-gray-700 mb-5">{t(code ? 'recruit.needsCode.text' : 'recruit.noAccess.text')}</p>
          {code && <Link to="/profile#mfa" className={btnPrimary}><KeyRound className="w-4 h-4" /> {t('recruit.needsCode.link')}</Link>}
        </GlassCard>
      </div>
    )
  }
  return <>{children(access.data)}</>
}

export function RecruitmentPage() {
  return <RecruitmentGate>{(access) => <Recruitment access={access} />}</RecruitmentGate>
}

const ALL = 'all'
type Row = { key: string; label: string; n: number }

/** One measure across categories: thin bars on one baseline, largest first, the figure beside each. */
function Bars({ title, rows, active, onPick, limit = 8 }: { title: string; rows: Row[]; active: string; onPick: (key: string) => void; limit?: number }) {
  const { t } = useI18n()
  const max = Math.max(1, ...rows.map((r) => r.n))
  const shown = rows.slice(0, limit)
  return (
    <div className="min-w-0">
      <h3 className="text-sm font-medium text-gray-700 mb-2">{title}</h3>
      <ul className="space-y-1">
        {shown.map((r) => (
          <li key={r.key}>
            <button type="button" onClick={() => onPick(active === r.key ? ALL : r.key)} title={`${r.label}: ${r.n}`} aria-pressed={active === r.key}
              className={`w-full text-left rounded-lg px-1.5 py-1 transition-colors ${active === r.key ? 'bg-white/80' : 'hover:bg-white/50'}`}>
              <span className="flex justify-between gap-3 text-sm">
                <span className="truncate">{r.label}</span>
                <span className="tabular-nums text-gray-700 font-medium">{r.n}</span>
              </span>
              <span className="block h-1.5 rounded-full bg-gray-900/[0.06] mt-1" aria-hidden="true">
                <span className={`block h-full rounded-full ${active === r.key ? 'bg-[#750014]' : 'bg-gray-800'}`} style={{ width: `${(r.n / max) * 100}%` }} />
              </span>
            </button>
          </li>
        ))}
      </ul>
      {rows.length > limit && <p className="text-xs text-gray-600 mt-1 px-1.5">{t('recruit.stats.more', { n: rows.length - limit })}</p>}
    </div>
  )
}

const count = <T,>(list: T[], keyOf: (x: T) => string, labelOf: (k: string) => string): Row[] => {
  const m = new Map<string, number>()
  for (const x of list) m.set(keyOf(x), (m.get(keyOf(x)) ?? 0) + 1)
  return [...m].map(([key, n]) => ({ key, label: labelOf(key), n })).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label))
}

function Recruitment({ access }: { access: RecruitmentAccess }) {
  const { t } = useI18n()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const apps = useApplications(true)
  const team = useRecruitmentTeam(true)
  const round = useRecruitmentWindow(true)
  const [params, setParams] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  // The filters answer at once; the address keeps them for the way back from an application.
  const [f, setF] = useState(() => ({
    q: params.get('q') ?? '', d: params.get('d') ?? ALL, r: params.get('r') ?? ALL, s: params.get('s') ?? ALL,
    st: params.get('st') ?? ALL, a: params.get('a') ?? ALL, rep: params.get('rep') === '1' ? '1' : '',
  }))
  const set = (key: keyof typeof f, v: string) => {
    const next = { ...f, [key]: v || (key === 'q' || key === 'rep' ? '' : ALL), ...(key === 'd' ? { r: ALL } : {}) }
    setF(next)
    const url = new URLSearchParams()
    for (const [k, val] of Object.entries(next)) if (val && val !== ALL) url.set(k, val)
    setParams(url, { replace: true })
  }

  const all = useMemo(() => apps.data ?? [], [apps.data])
  const names = useMemo(() => new Map((team.data ?? []).map((m) => [m.profile_id, m.full_name])), [team.data])
  const repeats = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of all) m.set(a.email, (m.get(a.email) ?? 0) + 1)
    return m
  }, [all])
  const list = all.filter((a) => {
    const q = f.q.trim().toLowerCase()
    return (f.d === ALL || a.department === f.d)
      && (f.r === ALL || a.primary_role === f.r || a.extra_role === f.r)
      && (f.s === ALL || a.school === f.s)
      && (f.st === ALL || a.status === f.st)
      && (f.a === ALL || (f.a === 'mine' ? a.assignee_id === profile?.id : f.a === 'none' ? !a.assignee_id : a.assignee_id === f.a))
      && (f.rep !== '1' || (repeats.get(a.email) ?? 0) > 1)
      && (!q || [a.full_name, a.email, a.telegram ?? '', a.public_id, a.school].some((v) => v.toLowerCase().includes(q)))
  })

  const stats = useMemo(() => ({
    status: APPLICATION_STATUSES.map((s) => ({ key: s.id, label: s.label, n: all.filter((a) => a.status === s.id).length })),
    department: count(all, (a) => a.department, (k) => department(k)?.title ?? k),
    role: count(all, (a) => a.primary_role, (k) => role(k)?.title ?? k),
    school: count(all, (a) => a.school, (k) => k),
    day: all.filter((a) => nowMs() - Date.parse(a.created_at) < 86_400_000).length,
  }), [all])
  const schools = stats.school.map((s) => s.key).sort((a, b) => a.localeCompare(b))

  const exportCsv = async () => {
    setBusy(true)
    setError(null)
    const res = await exportApplications()
    setBusy(false)
    if (res.error) return setError(res.error)
    const rows = res.data ?? []
    const questions = DEPARTMENTS.flatMap((d) => DEPARTMENT_QUESTIONS[d.id].map((q) => ({ d: d.id, q, label: `${d.title}: ${q.label}` })))
    const header = [t('recruit.col.id'), t('recruit.col.date'), t('csv.name'), t('recruit.field.applicantStatus'), t('recruit.field.school'),
      t('recruit.field.grade'), t('recruit.field.email'), t('recruit.field.telegram'), t('recruit.field.department'), t('recruit.field.role'),
      t('recruit.field.extra'), t('recruit.col.status'), t('recruit.col.assignee'), t('recruit.col.score'), t('recruit.field.experience'),
      ...AVAILABILITY_QUESTIONS.map((q) => q.label), ...questions.map((x) => x.label), t('recruit.section.consent')]
    downloadCsv(stampedName('ait-team-applications', 'csv'), header, rows.map((a) => {
      const availability: Record<string, unknown> = { hours: a.hours, work_times: a.work_times, interview: a.interview, term: a.term,
        other_role: a.other_role, motivation: a.motivation, extra_info: a.extra_info }
      return [a.public_id, formatDateTime(a.created_at), a.full_name, applicantStatusLabel(a.applicant_status), a.school, a.grade, a.email,
        a.telegram ? `@${a.telegram}` : '', department(a.department)?.title ?? a.department, role(a.primary_role)?.title ?? a.primary_role,
        role(a.extra_role)?.title ?? '', statusLabel(a.status), a.assignee_id ? names.get(a.assignee_id) ?? '' : '', a.score, a.experience,
        ...AVAILABILITY_QUESTIONS.map((q) => answerText(q, availability[q.id])),
        ...questions.map((x) => (x.d === a.department ? answerText(x.q, a.answers[x.q.id], a.answers) : '')),
        `${a.consent_version}${a.is_adult ? '' : `, ${t('recruit.minor')}`}`]
    }))
  }

  const wnd = round.data
  const now = nowMs()
  const open = wnd?.opens_at && wnd.closes_at && now >= Date.parse(wnd.opens_at) && now < Date.parse(wnd.closes_at)
  const canExport = access === 'export' || access === 'manage'

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="max-w-7xl mx-auto space-y-4">
      <GlassCard>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className={pageTitle}>{t('recruit.title')}</h1>
            <p className="text-sm text-gray-700 max-w-2xl">{t('recruit.lead')}</p>
            {wnd?.opens_at && wnd.closes_at && (
              <p className="text-sm text-gray-700 mt-2">
                {t('recruit.window', { from: formatDateTime(wnd.opens_at), to: formatDateTime(wnd.closes_at) })}{' '}
                <span className={`${chip} ${open ? 'bg-[#750014] text-white' : 'bg-gray-900/[0.07]'}`}>{t(open ? 'recruit.windowOpen' : 'recruit.windowClosed')}</span>
              </p>
            )}
          </div>
          {canExport && (
            <div className="flex flex-col items-end gap-1">
              <button onClick={() => void exportCsv()} disabled={busy || !all.length} className={btnSecondary}>
                <Download className="w-4 h-4" /> {busy ? t('common.wait') : t('recruit.export')}
              </button>
              <span className="text-xs text-gray-600">{t('recruit.exportHint')}</span>
            </div>
          )}
        </div>
        <ErrorText error={error} />
      </GlassCard>

      <GlassCard>
        <DataState isLoading={apps.isLoading} error={apps.error} onRetry={() => void apps.refetch()} empty={all.length === 0} emptyText={t('recruit.empty')}>
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,0.8fr)_repeat(3,minmax(0,1fr))] gap-6">
            <div>
              <p className="text-sm text-gray-700">{t('recruit.total')}</p>
              <p className="text-[56px] leading-none font-semibold tracking-[-0.03em] tabular-nums mt-1">{all.length}</p>
              <p className="text-xs text-gray-600 mt-2">{t('recruit.totalHint', { n: stats.day })}</p>
              <div className="mt-5"><Bars title={t('recruit.stats.status')} rows={stats.status} active={f.st} onPick={(k) => set('st', k)} limit={8} /></div>
            </div>
            <Bars title={t('recruit.stats.department')} rows={stats.department} active={f.d} onPick={(k) => set('d', k)} />
            <Bars title={t('recruit.stats.role')} rows={stats.role} active={f.r} onPick={(k) => set('r', k)} limit={9} />
            <Bars title={t('recruit.stats.school')} rows={stats.school} active={f.s} onPick={(k) => set('s', k)} limit={9} />
          </div>
        </DataState>
      </GlassCard>

      <GlassCard>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.6fr)_repeat(5,minmax(0,1fr))] gap-2 mb-3">
          <input className={inputClass} type="search" value={f.q} onChange={(e) => set('q', e.target.value)} placeholder={t('recruit.search')} aria-label={t('recruit.search')} />
          <select className={inputClass} value={f.d} onChange={(e) => set('d', e.target.value)} aria-label={t('recruit.col.department')}>
            <option value={ALL}>{t('recruit.allDepartments')}</option>
            {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
          </select>
          <select className={inputClass} value={f.r} onChange={(e) => set('r', e.target.value)} aria-label={t('recruit.col.role')}>
            <option value={ALL}>{t('recruit.allRoles')}</option>
            {(f.d === ALL ? ROLES : department(f.d)?.roles ?? []).map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
          </select>
          <select className={inputClass} value={f.s} onChange={(e) => set('s', e.target.value)} aria-label={t('recruit.col.school')}>
            <option value={ALL}>{t('recruit.allSchools')}</option>
            {schools.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className={inputClass} value={f.st} onChange={(e) => set('st', e.target.value)} aria-label={t('recruit.col.status')}>
            <option value={ALL}>{t('recruit.allStatuses')}</option>
            {APPLICATION_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <select className={inputClass} value={f.a} onChange={(e) => set('a', e.target.value)} aria-label={t('recruit.col.assignee')}>
            <option value={ALL}>{t('recruit.anyAssignee')}</option>
            <option value="mine">{t('recruit.mine')}</option>
            <option value="none">{t('recruit.unassigned')}</option>
            {(team.data ?? []).map((m) => <option key={m.profile_id} value={m.profile_id}>{m.full_name}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.rep === '1'} onChange={(e) => set('rep', e.target.checked ? '1' : '')} />
            {t('recruit.repeatsOnly')}
          </label>
          <p className="text-xs text-gray-600">{t('recruit.count', { n: list.length, word: plural(list.length, t('word.application1'), t('word.application2'), t('word.application5')) })}</p>
        </div>
        <DataState isLoading={apps.isLoading} error={apps.error} onRetry={() => void apps.refetch()} empty={list.length === 0}
          emptyText={all.length ? t('recruit.noneFound') : t('recruit.empty')}>
          <div className="hidden lg:block overflow-x-auto -mx-1">
            <table className="w-full text-sm border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-xs text-gray-600">
                  {['id', 'name', 'school', 'department', 'role', 'extra', 'date', 'status', 'assignee', 'score'].map((c) => (
                    <th key={c} scope="col" className="font-medium px-2 pb-2 border-b border-white/70 whitespace-nowrap">{t(`recruit.col.${c}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id} onClick={() => navigate(`/recruitment/${a.id}`)} className="cursor-pointer hover:bg-white/45 align-top">
                    <td className="px-2 py-2.5 border-b border-white/50 whitespace-nowrap">
                      <Link to={`/recruitment/${a.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-xs underline-offset-2 hover:underline">{a.public_id}</Link>
                    </td>
                    <td className="px-2 py-2.5 border-b border-white/50">
                      <span className="font-medium">{a.full_name}</span>
                      <Flags a={a} repeats={repeats} />
                    </td>
                    <td className="px-2 py-2.5 border-b border-white/50 text-gray-700">{a.school}</td>
                    <td className="px-2 py-2.5 border-b border-white/50 whitespace-nowrap">{department(a.department)?.title}</td>
                    <td className="px-2 py-2.5 border-b border-white/50">{role(a.primary_role)?.title}</td>
                    <td className="px-2 py-2.5 border-b border-white/50 text-gray-700">{role(a.extra_role)?.title ?? '—'}</td>
                    <td className="px-2 py-2.5 border-b border-white/50 whitespace-nowrap text-gray-700">{formatDate(a.created_at)}</td>
                    <td className="px-2 py-2.5 border-b border-white/50"><StageChip status={a.status} /></td>
                    <td className="px-2 py-2.5 border-b border-white/50 text-gray-700">{a.assignee_id ? names.get(a.assignee_id) ?? '—' : '—'}</td>
                    <td className="px-2 py-2.5 border-b border-white/50 tabular-nums">{a.score ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="lg:hidden divide-y divide-white/60">
            {list.map((a) => (
              <li key={a.id}>
                <Link to={`/recruitment/${a.id}`} className="block py-3 px-1 rounded-lg hover:bg-white/40">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{a.full_name}</span>
                    <StageChip status={a.status} />
                    <Flags a={a} repeats={repeats} />
                  </span>
                  <span className="block text-sm text-gray-700 mt-0.5">
                    {role(a.primary_role)?.title}{a.extra_role ? ` + ${role(a.extra_role)?.title}` : ''}, {department(a.department)?.title}
                  </span>
                  <span className="block text-xs text-gray-600 mt-0.5">
                    <span className="font-mono">{a.public_id}</span>, {a.school}, {formatDate(a.created_at)}
                    {a.assignee_id && names.get(a.assignee_id) ? `, ${names.get(a.assignee_id)}` : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </DataState>
        <p className="text-xs text-gray-600 mt-3">{t('recruit.retention')}</p>
      </GlassCard>

      {access === 'manage' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AccessPanel team={team.data ?? []} />
          {round.isSuccess && (
            <WindowPanel key={`${wnd?.opens_at}|${wnd?.closes_at}`} opens={wnd?.opens_at ?? null} closes={wnd?.closes_at ?? null} />
          )}
        </div>
      )}
    </motion.div>
  )
}

function Flags({ a, repeats }: { a: TeamApplicationRow; repeats: Map<string, number> }) {
  const { t } = useI18n()
  return (
    <>
      {(repeats.get(a.email) ?? 0) > 1 && <span className={`${chip} ml-2 bg-[#750014]/10 text-[#750014]`}>{t('recruit.repeat')}</span>}
      {!a.is_adult && <span className={`${chip} ml-2 bg-gray-900/[0.06] text-gray-700`}>{t('recruit.minor')}</span>}
    </>
  )
}

function AccessPanel({ team }: { team: RecruitmentTeamRow[] }) {
  const { t } = useI18n()
  const members = useMembers()
  const [pick, setPick] = useState('')
  const [canExport, setCanExport] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const inTeam = new Set(team.map((m) => m.profile_id))
  const candidates = (members.data ?? []).filter((m) => m.status === 'active' && !inTeam.has(m.id) && m.role !== 'director' && m.role !== 'curator')

  const act = async (fn: () => Promise<{ error: unknown }>) => {
    setBusy(true)
    setError(null)
    const res = await fn()
    setBusy(false)
    if (res.error) setError(res.error)
    return !res.error
  }
  const add = async (e: FormEvent) => {
    e.preventDefault()
    if (!pick) return
    if (await act(() => grantRecruitmentAccess(pick, canExport))) { setPick(''); setCanExport(false) }
  }

  return (
    <GlassCard>
      <h2 className={sectionTitle}><ShieldCheck className="inline w-5 h-5 -mt-1 mr-1" /> {t('recruit.access.title')}</h2>
      <p className="text-sm text-gray-700 mt-1 mb-3">{t('recruit.access.hint')}</p>
      <ul className="divide-y divide-white/60 mb-4">
        {team.map((m) => (
          <li key={m.profile_id} className="flex flex-wrap items-center gap-2 py-2">
            <Link to={`/members/${m.profile_id}`} className="flex-1 min-w-[9rem] text-sm hover:underline underline-offset-2">{m.full_name}</Link>
            <span className="text-xs text-gray-600">{t(`role.${m.role}`)}</span>
            {m.granted ? (
              <>
                <label className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" checked={m.can_export} disabled={busy}
                    onChange={(e) => void act(() => grantRecruitmentAccess(m.profile_id, e.target.checked))} />
                  {t('recruit.access.canExport')}
                </label>
                <button type="button" disabled={busy} className={`${btnSmall} border border-red-600/40 text-red-700 hover:bg-red-600/10`}
                  onClick={() => { if (window.confirm(t('recruit.access.removeConfirm', { name: m.full_name }))) void act(() => revokeRecruitmentAccess(m.profile_id)) }}>
                  {t('recruit.access.remove')}
                </button>
              </>
            ) : <span className={`${chip} bg-gray-900/[0.06]`}>{t('recruit.access.always')}</span>}
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
        <div>
          <label className={labelClass} htmlFor="ra-pick">{t('recruit.access.pick')}</label>
          <select id="ra-pick" className={inputClass} value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">{t('recruit.access.pickPlaceholder')}</option>
            {candidates.map((m) => <option key={m.id} value={m.id}>{m.full_name}{m.role !== 'member' ? ` (${t(`role.${m.role}`)})` : ''}</option>)}
          </select>
        </div>
        <button type="submit" disabled={busy || !pick} className={btnPrimary}><UserPlus className="w-4 h-4" /> {t('recruit.access.add')}</button>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" checked={canExport} onChange={(e) => setCanExport(e.target.checked)} />
          {t('recruit.access.canExport')}
        </label>
      </form>
      <ErrorText error={error} />
    </GlassCard>
  )
}

/** Kazakhstan is UTC+5 all year: the inputs speak its time whatever the computer's clock says. */
const KZ = 5 * 3600_000
const toLocal = (iso: string | null) => (iso ? new Date(Date.parse(iso) + KZ).toISOString().slice(0, 16) : '')
const fromLocal = (v: string) => `${v}:00+05:00`

function WindowPanel({ opens, closes }: { opens: string | null; closes: string | null }) {
  const { t } = useI18n()
  const [from, setFrom] = useState(toLocal(opens))
  const [to, setTo] = useState(toLocal(closes))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [saved, setSaved] = useState(false)
  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setSaved(false)
    const res = await setRecruitmentWindow(fromLocal(from), fromLocal(to))
    setBusy(false)
    if (res.error) setError(res.error)
    else setSaved(true)
  }
  return (
    <GlassCard>
      <h2 className={sectionTitle}>{t('recruit.window.title')}</h2>
      <p className="text-sm text-gray-700 mt-1 mb-3">{t('recruit.window.hint')}</p>
      <form onSubmit={save} className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end">
        <div>
          <label className={labelClass} htmlFor="rw-from">{t('recruit.window.opens')}</label>
          <input id="rw-from" className={inputClass} type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} required />
        </div>
        <div>
          <label className={labelClass} htmlFor="rw-to">{t('recruit.window.closes')}</label>
          <input id="rw-to" className={inputClass} type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} required />
        </div>
        <button type="submit" disabled={busy || !from || !to} className={`${btnSecondary} sm:col-span-2 justify-self-start`}>
          {saved ? t('common.saved') : t('recruit.window.save')}
        </button>
      </form>
      <ErrorText error={error} />
    </GlassCard>
  )
}
