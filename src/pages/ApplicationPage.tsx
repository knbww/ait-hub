import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Copy, ExternalLink, Trash2 } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { DataState, ErrorText } from '../components/DataState'
import { pageVariants } from '../lib/animations'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useApplication, useApplicationNotes, useApplications, useRecruitmentTeam } from '../hooks/useRecruitment'
import {
  addApplicationNote, assignApplication, deleteApplication, deleteApplicationNote, setApplicationScore, setApplicationStatus,
} from '../lib/recruitmentActions'
import {
  APPLICATION_STATUSES, AVAILABILITY_QUESTIONS, DEPARTMENT_QUESTIONS, answerText, applicantStatusLabel, department, role,
} from '../lib/recruitment'
import type { Question } from '../lib/recruitment'
import { formatDateTime, formatDay } from '../lib/club'
import type { RecruitmentAccess, TeamApplicationRow } from '../lib/db'
import { btnDanger, btnPrimary, btnSmall, chip, inputClass, labelClass, pageTitle, sectionTitle } from '../lib/ui'
import { RecruitmentGate, StageChip } from './RecruitmentPage'

export function ApplicationPage() {
  return <RecruitmentGate>{(access) => <Application access={access} />}</RecruitmentGate>
}

/** Cards that appear once the application has loaded: they run their own entrance, the page's has
 * finished by then and wouldn't carry them in. */
function Late({ children }: { children: ReactNode }) {
  return <motion.div variants={pageVariants} initial="initial" animate="animate" className="space-y-4">{children}</motion.div>
}

/** A row of the application: the question on the left, the answer on the right. */
function Item({ label, children }: { label: string; children: ReactNode }) {
  if (children === '' || children === null || children === undefined) return null
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] gap-x-6 gap-y-0.5 py-2.5 border-t border-white/60 first:border-t-0">
      <dt className="text-sm text-gray-600">{label}</dt>
      <dd className="text-sm text-gray-900 whitespace-pre-wrap break-words">{children}</dd>
    </div>
  )
}

/** Links an applicant gave: only http(s) addresses reach the database, opened without a referrer. */
function Links({ list }: { list: string[] }) {
  return (
    <span className="flex flex-col gap-1">
      {list.map((href) => (
        <a key={href} href={href} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 underline underline-offset-2 break-all">
          {href} <ExternalLink className="w-3.5 h-3.5 shrink-0" />
        </a>
      ))}
    </span>
  )
}

function answer(q: Question, value: unknown, all: Record<string, unknown>) {
  if (q.kind === 'links') return Array.isArray(value) && value.length ? <Links list={value.map(String)} /> : null
  return answerText(q, value, all)
}

function Application({ access }: { access: RecruitmentAccess }) {
  const { id } = useParams()
  const { t } = useI18n()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const app = useApplication(id)
  const notes = useApplicationNotes(id)
  const team = useRecruitmentTeam(true)
  const all = useApplications(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)

  const run = async (fn: () => Promise<{ error: unknown }>) => {
    setBusy(true)
    setError(null)
    const res = await fn()
    setBusy(false)
    if (res.error) setError(res.error)
    return !res.error
  }

  const a = app.data
  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="max-w-5xl mx-auto space-y-4">
      <Link to="/recruitment" className="inline-flex items-center gap-1.5 text-sm text-gray-700 hover:text-gray-900 px-1">
        <ArrowLeft className="w-4 h-4" /> {t('recruit.back')}
      </Link>
      <DataState isLoading={app.isLoading} error={app.error} onRetry={() => void app.refetch()} empty={!a}
        emptyText={<Late><GlassCard>{t('recruit.notFound')}</GlassCard></Late>}>
        {a && (
          <Late>
            <Header a={a} copied={copied} onCopy={async () => { try { await navigator.clipboard.writeText(a.email); setCopied(true) } catch { setCopied(false) } }} />

            <GlassCard>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass} htmlFor="ap-status">{t('recruit.status')}</label>
                  <select id="ap-status" className={inputClass} value={a.status} disabled={busy}
                    onChange={(e) => void run(() => setApplicationStatus(a.id, e.target.value))}>
                    {APPLICATION_STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                  </select>
                  <p className="text-xs text-gray-600 mt-1">{t('recruit.statusSince', { date: formatDateTime(a.status_changed_at) })}</p>
                </div>
                <div>
                  <label className={labelClass} htmlFor="ap-assignee">{t('recruit.assignee')}</label>
                  <select id="ap-assignee" className={inputClass} value={a.assignee_id ?? ''} disabled={busy}
                    onChange={(e) => void run(() => assignApplication(a.id, e.target.value || null))}>
                    <option value="">{t('recruit.nobody')}</option>
                    {(team.data ?? []).map((m) => <option key={m.profile_id} value={m.profile_id}>{m.full_name}</option>)}
                  </select>
                </div>
                <div>
                  <span className={labelClass} id="ap-score">{t('recruit.score')}</span>
                  <div className="flex gap-1" role="group" aria-labelledby="ap-score">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} type="button" disabled={busy} aria-pressed={a.score === n}
                        onClick={() => void run(() => setApplicationScore(a.id, a.score === n ? null : n))}
                        className={`w-10 h-10 rounded-xl text-sm tabular-nums transition-colors ${a.score !== null && n <= a.score ? 'bg-gray-900 text-white' : 'border border-white/70 bg-white/50 hover:bg-white/80'}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                  {a.score !== null && (
                    <button type="button" className="text-xs text-gray-600 underline underline-offset-2 mt-1" disabled={busy}
                      onClick={() => void run(() => setApplicationScore(a.id, null))}>{t('recruit.scoreClear')}</button>
                  )}
                </div>
              </div>
              <ErrorText error={error} />
            </GlassCard>

            <Answers a={a} />

            <GlassCard>
              <h2 className={sectionTitle}>{t('recruit.notes')}</h2>
              <p className="text-sm text-gray-700 mt-1 mb-3">{t('recruit.notes.hint')}</p>
              <DataState isLoading={notes.isLoading} error={notes.error} onRetry={() => void notes.refetch()} empty={(notes.data ?? []).length === 0} emptyText={t('recruit.notes.empty')}>
                <ul className="space-y-3 mb-3">
                  {(notes.data ?? []).map((n) => (
                    <li key={n.id} className="rounded-2xl bg-white/45 border border-white/70 p-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 mb-1">
                        <span className="font-medium text-gray-800">{n.author?.full_name ?? '—'}</span>
                        <span>{formatDateTime(n.created_at)}</span>
                        {n.author_id === profile?.id && (
                          <button type="button" className="ml-auto inline-flex items-center gap-1 text-red-700 hover:underline" disabled={busy}
                            onClick={() => void run(() => deleteApplicationNote(n.id, a.id))}>
                            <Trash2 className="w-3.5 h-3.5" /> {t('recruit.notes.delete')}
                          </button>
                        )}
                      </div>
                      <p className="text-sm whitespace-pre-wrap break-words">{n.body}</p>
                    </li>
                  ))}
                </ul>
              </DataState>
              <form className="mt-3 space-y-2" onSubmit={async (e: FormEvent) => {
                e.preventDefault()
                if (!note.trim()) return
                if (await run(() => addApplicationNote(a.id, note))) setNote('')
              }}>
                <label className="sr-only" htmlFor="ap-note">{t('recruit.notes.add')}</label>
                <textarea id="ap-note" className={`${inputClass} min-h-24`} value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)}
                  placeholder={t('recruit.notes.placeholder')} />
                <button type="submit" disabled={busy || !note.trim()} className={btnPrimary}>{t('recruit.notes.add')}</button>
              </form>
            </GlassCard>

            <Others a={a} all={all.data ?? []} />

            {access === 'manage' && (
              <GlassCard>
                <h2 className={sectionTitle}>{t('recruit.delete')}</h2>
                <p className="text-sm text-gray-700 mt-1 mb-3">{t('recruit.delete.hint')}</p>
                <button type="button" disabled={busy} className={btnDanger} onClick={async () => {
                  if (!window.confirm(t('recruit.delete.confirm', { id: a.public_id }))) return
                  if (await run(() => deleteApplication(a.id))) navigate('/recruitment', { replace: true })
                }}>
                  <Trash2 className="w-4 h-4" /> {t('recruit.delete')}
                </button>
              </GlassCard>
            )}
          </Late>
        )}
      </DataState>
    </motion.div>
  )
}

function Header({ a, copied, onCopy }: { a: TeamApplicationRow; copied: boolean; onCopy: () => void }) {
  const { t } = useI18n()
  const dept = department(a.department)
  return (
    <GlassCard>
      <p className="font-mono text-xs text-[#750014] tracking-wide">{a.public_id}</p>
      <h1 className={`${pageTitle} mt-1`}>{a.full_name}</h1>
      <div className="flex flex-wrap items-center gap-2 mt-1">
        <StageChip status={a.status} />
        <span className={`${chip} bg-gray-900/[0.06]`}>{dept?.title}</span>
        <span className={`${chip} bg-gray-900/[0.06]`}>{role(a.primary_role)?.title}</span>
        {a.extra_role && <span className={`${chip} border border-gray-900/15`}>+ {role(a.extra_role)?.title}</span>}
        {!a.is_adult && <span className={`${chip} bg-gray-900/[0.06]`}>{t('recruit.minor')}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-sm">
        <span className="inline-flex items-center gap-2">
          <a href={`mailto:${a.email}`} className="underline underline-offset-2 break-all">{a.email}</a>
          <button type="button" onClick={onCopy} className={`${btnSmall} border border-white/70 bg-white/50 hover:bg-white/80`} aria-label={t('recruit.copy')}>
            <Copy className="w-3.5 h-3.5" /> {copied ? t('recruit.copied') : t('recruit.copy')}
          </button>
        </span>
        {a.telegram && (
          <a href={`https://t.me/${a.telegram}`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">@{a.telegram}</a>
        )}
        <span className="text-gray-600">{t('recruit.submitted', { date: formatDateTime(a.created_at) })}</span>
      </div>
    </GlassCard>
  )
}

function Answers({ a }: { a: TeamApplicationRow }) {
  const { t } = useI18n()
  const availability: Record<string, unknown> = {
    hours: a.hours, work_times: a.work_times, interview: a.interview, term: a.term, other_role: a.other_role,
    motivation: a.motivation, extra_info: a.extra_info,
  }
  return (
    <GlassCard>
      <div className="grid grid-cols-1 gap-6">
        <section>
          <h2 className={sectionTitle}>{t('recruit.section.personal')}</h2>
          <dl className="mt-2">
            <Item label={t('recruit.field.applicantStatus')}>{applicantStatusLabel(a.applicant_status)}</Item>
            <Item label={t('recruit.field.school')}>{a.school}</Item>
            <Item label={t('recruit.field.grade')}>{a.grade}</Item>
            <Item label={t('recruit.field.experience')}>{a.experience}</Item>
          </dl>
        </section>
        <section>
          <h2 className={sectionTitle}>{t('recruit.section.answers')}</h2>
          <dl className="mt-2">
            {(DEPARTMENT_QUESTIONS[a.department] ?? []).map((q) => (
              <Item key={q.id} label={q.label}>{answer(q, a.answers[q.id], a.answers)}</Item>
            ))}
          </dl>
        </section>
        <section>
          <h2 className={sectionTitle}>{t('recruit.section.availability')}</h2>
          <dl className="mt-2">
            {AVAILABILITY_QUESTIONS.map((q) => <Item key={q.id} label={q.label}>{answer(q, availability[q.id], availability)}</Item>)}
          </dl>
        </section>
        <section>
          <h2 className={sectionTitle}>{t('recruit.section.consent')}</h2>
          <p className="text-sm text-gray-700 mt-2">{t('recruit.consent.text', { version: formatDay(a.consent_version) })}</p>
          <p className="text-sm text-gray-700 mt-1">{t(a.is_adult ? 'recruit.consent.adult' : 'recruit.consent.guardian')}</p>
        </section>
      </div>
    </GlassCard>
  )
}

/** Other applications from the same email: a second try, a correction, another role. */
function Others({ a, all }: { a: TeamApplicationRow; all: TeamApplicationRow[] }) {
  const { t } = useI18n()
  const others = all.filter((x) => x.email === a.email && x.id !== a.id)
  if (!others.length) return null
  return (
    <GlassCard>
      <h2 className={sectionTitle}>{t('recruit.others')}</h2>
      <ul className="divide-y divide-white/60 mt-2">
        {others.map((x) => (
          <li key={x.id}>
            <Link to={`/recruitment/${x.id}`} className="flex flex-wrap items-center gap-2 py-2.5 hover:bg-white/30 rounded-lg px-1 text-sm">
              <span className="font-mono text-xs">{x.public_id}</span>
              <span>{role(x.primary_role)?.title}</span>
              <StageChip status={x.status} />
              <span className="text-gray-600 ml-auto">{formatDateTime(x.created_at)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </GlassCard>
  )
}
