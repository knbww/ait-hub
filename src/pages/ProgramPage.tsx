import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { motion } from 'framer-motion'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { Check, ChevronDown, ExternalLink, FolderOpen, Pencil } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { DataState, ErrorText } from '../components/DataState'
import { SubmissionBadge } from '../components/SubmissionBadge'
import { Avatar } from '../components/Avatar'
import { pageVariants } from '../lib/animations'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useSchedule, useTracks } from '../hooks/useClub'
import { useMySubmissions, useProgramWeeks, useWeekWork } from '../hooks/useProgram'
import { reviewWork, setAttendance, submitWork, updateTrackDrive, updateWeek } from '../lib/programActions'
import {
  MEETING_KINDS, PROGRAM_WEEKS, TRACK_IDS, currentWeekNumber, daysUntil, formatShortDay, isHttpUrl, weekDeadline,
} from '../lib/club'
import type { MeetingKind, ProfileRow, ProgramWeekRow, SubmissionRow, TrackId } from '../lib/db'
import { btnPrimary, btnSecondary, btnSmall, inputClass, labelClass, pageTitle, segment } from '../lib/ui'

// ── Member: hand in a week's work ───────────────────────────────────────────
function SubmitWork({ week, submission }: { week: ProgramWeekRow; submission: SubmissionRow | undefined }) {
  const { t } = useI18n()
  const [editing, setEditing] = useState(!submission || submission.status === 'needs_work')
  const [link, setLink] = useState(submission?.link ?? '')
  const [comment, setComment] = useState(submission?.comment ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!isHttpUrl(link)) return setError('invalid_link')
    setBusy(true)
    setError(null)
    const res = await submitWork(week.id, link, comment)
    setBusy(false)
    if (res.error) return setError(res.error)
    setEditing(false)
  }

  return (
    <div className="space-y-3">
      {submission && (
        <div className="rounded-2xl border border-white/60 bg-white/30 p-3 text-sm space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <SubmissionBadge status={submission.status} />
            <a href={submission.link} target="_blank" rel="noreferrer" className="underline break-all">{t('work.yourLink')}</a>
          </div>
          {submission.feedback && (
            <p className="text-gray-800"><span className="text-gray-500">{t('work.feedback')}</span> {submission.feedback}</p>
          )}
        </div>
      )}
      {editing ? (
        <form onSubmit={submit} className="space-y-2">
          <input className={inputClass} type="url" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)}
            placeholder={t('work.linkPlaceholder')} required />
          <textarea className={inputClass} rows={2} value={comment} onChange={(e) => setComment(e.target.value)}
            placeholder={t('work.commentPlaceholder')} maxLength={1000} />
          <ErrorText error={error} />
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className={btnPrimary}>
              {busy ? t('common.wait') : submission ? t('work.resubmit') : t('work.submit')}
            </button>
            {submission && (
              <button type="button" onClick={() => setEditing(false)} className={btnSecondary}>{t('common.cancel')}</button>
            )}
          </div>
          <p className="text-xs text-gray-600">{t('work.hint')}</p>
        </form>
      ) : (
        submission?.status !== 'accepted' && (
          <button onClick={() => setEditing(true)} className={btnSecondary}>{t('work.change')}</button>
        )
      )}
    </div>
  )
}

// ── Staff: edit a week, review works, mark attendance ───────────────────────
function EditWeek({ week, onDone }: { week: ProgramWeekRow; onDone: () => void }) {
  const { t } = useI18n()
  const [title, setTitle] = useState(week.title)
  const [materials, setMaterials] = useState(week.materials_url ?? '')
  const [assignment, setAssignment] = useState(week.assignment ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (materials.trim() && !/^https:\/\//i.test(materials.trim())) return setError('invalid_link')
    setBusy(true)
    const res = await updateWeek(week.id, {
      title: title.trim(),
      materials_url: materials.trim() || null,
      assignment: assignment.trim() || null,
    })
    setBusy(false)
    if (res.error) return setError(res.error)
    onDone()
  }

  return (
    <form onSubmit={save} className="space-y-2 rounded-2xl border border-white/60 bg-white/30 p-3">
      <div>
        <label className={labelClass}>{t('program.edit.title')}</label>
        <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} />
      </div>
      <div>
        <label className={labelClass}>{t('program.edit.materials')}</label>
        <input className={inputClass} type="url" value={materials} onChange={(e) => setMaterials(e.target.value)}
          placeholder="https://drive.google.com/…" />
      </div>
      <div>
        <label className={labelClass}>{t('program.edit.assignment')}</label>
        <textarea className={inputClass} rows={3} value={assignment} onChange={(e) => setAssignment(e.target.value)} maxLength={2000} />
      </div>
      <ErrorText error={error} />
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={btnPrimary}>{t('common.save')}</button>
        <button type="button" onClick={onDone} className={btnSecondary}>{t('common.cancel')}</button>
      </div>
    </form>
  )
}

function ReviewRow({ member, weekId, submission, present }: {
  member: ProfileRow
  weekId: string
  submission: SubmissionRow | undefined
  present: Record<MeetingKind, boolean>
}) {
  const { t } = useI18n()
  const [feedback, setFeedback] = useState(submission?.feedback ?? '')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const act = async (fn: () => Promise<{ error: unknown }>) => {
    setBusy(true)
    setError(null)
    const res = await fn()
    setBusy(false)
    if (res.error) setError(res.error)
    else setOpen(false)
  }

  return (
    <li className="py-3 border-b border-white/40 last:border-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Link to={`/members/${member.id}`} className="flex items-center gap-2 min-w-0 flex-1 basis-40">
          <Avatar path={member.avatar_path} name={member.full_name} size="sm" />
          <span className="truncate text-sm">{member.full_name}</span>
        </Link>
        <div className="flex gap-1" role="group" aria-label={t('program.attendance')}>
          {MEETING_KINDS.map((kind) => (
            <button key={kind} disabled={busy}
              onClick={() => act(() => setAttendance(member.id, weekId, kind, !present[kind]))}
              className={`${btnSmall} border ${present[kind] ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-900/20 bg-white/40'}`}
              aria-pressed={present[kind]}>
              {present[kind] && <Check className="w-3 h-3" />} {t(`meeting.${kind}`)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <SubmissionBadge status={submission?.status} />
          {submission && (
            <>
              <a href={submission.link} target="_blank" rel="noreferrer" className={`${btnSmall} border border-gray-900/20 bg-white/40`}>
                <ExternalLink className="w-3 h-3" /> {t('work.open')}
              </a>
              <button onClick={() => setOpen((v) => !v)} className={`${btnSmall} border border-gray-900/20 bg-white/40`}>
                {t('work.review')}
              </button>
            </>
          )}
        </div>
      </div>
      {submission?.comment && <p className="text-xs text-gray-600 mt-1">«{submission.comment}»</p>}
      {open && submission && (
        <div className="mt-2 space-y-2">
          <textarea className={inputClass} rows={2} value={feedback} onChange={(e) => setFeedback(e.target.value)}
            placeholder={t('work.feedbackPlaceholder')} maxLength={2000} />
          <div className="flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => act(() => reviewWork(submission.id, 'accepted', feedback))} className={btnPrimary}>
              {t('work.accept')}
            </button>
            <button disabled={busy} onClick={() => act(() => reviewWork(submission.id, 'needs_work', feedback))} className={btnSecondary}>
              {t('work.needsWork')}
            </button>
          </div>
        </div>
      )}
      <ErrorText error={error} />
    </li>
  )
}

function WeekWork({ week }: { week: ProgramWeekRow }) {
  const { t, tp } = useI18n()
  const work = useWeekWork(week.id, week.track_id, true)
  const members = work.data?.members ?? []
  const handedIn = members.filter((m) => work.data?.submissions.has(m.id)).length

  return (
    <div>
      <p className="text-sm text-gray-700 mb-1">{tp('program.handedIn', handedIn, { total: members.length })}</p>
      <DataState isLoading={work.isLoading} error={work.error} onRetry={() => void work.refetch()}
        empty={members.length === 0} emptyText={t('program.noMembers')}>
        <ul>
          {members.map((m) => (
            <ReviewRow key={m.id} member={m} weekId={week.id} submission={work.data?.submissions.get(m.id)}
              present={{
                lesson: Boolean(work.data?.attendance.has(`${m.id}:lesson`)),
                practicum: Boolean(work.data?.attendance.has(`${m.id}:practicum`)),
              }} />
          ))}
        </ul>
      </DataState>
    </div>
  )
}

// ── One week ────────────────────────────────────────────────────────────────
function WeekItem({ week, startsOn, isCurrent, upcoming, manage, submission, open, onToggle }: {
  week: ProgramWeekRow
  startsOn: string | undefined
  isCurrent: boolean
  upcoming: boolean
  manage: boolean
  submission: SubmissionRow | undefined
  open: boolean
  onToggle: () => void
}) {
  const { t, tp } = useI18n()
  const [editing, setEditing] = useState(false)
  const deadline = startsOn ? weekDeadline(startsOn) : null
  const left = deadline ? daysUntil(deadline) : null

  return (
    <GlassCard className={isCurrent ? '!border-[#750014]/40' : upcoming ? 'opacity-80' : ''}>
      <div id={`week-${week.week_number}`} className="scroll-mt-24" />
      <button onClick={onToggle} className="w-full flex items-start justify-between gap-3 text-left" aria-expanded={open}>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider text-gray-500">
            {t('week.number', { n: week.week_number })}
            {startsOn && deadline && ` · ${formatShortDay(startsOn)} – ${formatShortDay(deadline)}`}
            {isCurrent && <span className="ml-2 normal-case tracking-normal text-[#750014]">{t('program.now')}</span>}
          </p>
          <h3 className="text-lg font-normal">{week.title}</h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!manage && !upcoming && <SubmissionBadge status={submission?.status} />}
          <ChevronDown className={`w-5 h-5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          {editing ? (
            <EditWeek week={week} onDone={() => setEditing(false)} />
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {week.materials_url ? (
                  <a href={week.materials_url} target="_blank" rel="noreferrer" className={btnSecondary}>
                    <ExternalLink className="w-4 h-4" /> {t('week.materials')}
                  </a>
                ) : (
                  <span className="text-sm text-gray-600">{t('program.noMaterials')}</span>
                )}
                {manage && (
                  <button onClick={() => setEditing(true)} className={btnSecondary}>
                    <Pencil className="w-4 h-4" /> {t('program.editWeek')}
                  </button>
                )}
              </div>
              {week.assignment && (
                <div className="text-sm">
                  <p className="text-xs font-medium text-gray-600 mb-1">{t('program.assignment')}</p>
                  <p className="whitespace-pre-wrap">{week.assignment}</p>
                </div>
              )}
            </>
          )}
          {deadline && left !== null && !manage && (
            <p className="text-sm text-gray-700">
              {t('deadlines.until', { date: formatShortDay(deadline) })}
              {left > 0 && ` · ${tp('week.dueIn', left)}`}
              {left === 0 && ` · ${t('week.dueToday')}`}
            </p>
          )}
          {manage ? (
            <WeekWork week={week} />
          ) : (
            !upcoming && (
              <SubmitWork key={`${submission?.id ?? 'new'}:${submission?.status ?? ''}`} week={week} submission={submission} />
            )
          )}
          {!manage && upcoming && <p className="text-sm text-gray-600">{t('program.upcoming')}</p>}
        </div>
      )}
    </GlassCard>
  )
}

function DriveLink({ trackId, url, canEdit }: { trackId: TrackId; url: string | null; canEdit: boolean }) {
  const { t } = useI18n()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(url ?? '')
  const [error, setError] = useState<unknown>(null)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    if (value.trim() && !/^https:\/\//i.test(value.trim())) return setError('invalid_link')
    const res = await updateTrackDrive(trackId, value.trim() || null)
    if (res.error) return setError(res.error)
    setEditing(false)
  }

  if (editing) {
    return (
      <form onSubmit={save} className="flex flex-wrap gap-2 w-full">
        <input className={`${inputClass} flex-1 min-w-[14rem]`} type="url" value={value} onChange={(e) => setValue(e.target.value)}
          placeholder="https://drive.google.com/drive/folders/…" />
        <button type="submit" className={btnPrimary}>{t('common.save')}</button>
        <ErrorText error={error} />
      </form>
    )
  }
  return (
    <div className="flex flex-wrap gap-2">
      {url && (
        <a href={url} target="_blank" rel="noreferrer" className={btnSecondary}>
          <FolderOpen className="w-4 h-4" /> {t('program.driveFolder')}
        </a>
      )}
      {canEdit && (
        <button onClick={() => setEditing(true)} className={btnSecondary}>
          <Pencil className="w-4 h-4" /> {url ? t('program.driveEdit') : t('program.driveAdd')}
        </button>
      )}
    </div>
  )
}

export function ProgramPage() {
  const { t } = useI18n()
  const { profile, role, isOversight } = useAuth()
  const { hash } = useLocation()
  const [params, setParams] = useSearchParams()
  const tracks = useTracks()

  const paramTrack = params.get('track') as TrackId | null
  const trackId: TrackId | null =
    isOversight && paramTrack && TRACK_IDS.includes(paramTrack) ? paramTrack : (profile?.track_id ?? (isOversight ? 'ai' : null))
  const manage = isOversight || (role === 'track_lead' && profile?.track_id === trackId)

  const schedule = useSchedule(profile?.cohort_id)
  const program = useProgramWeeks(trackId)
  const subs = useMySubmissions(!manage && trackId ? profile?.id : undefined)

  const dates = new Map((schedule.data ?? []).map((d) => [d.week_number, d.starts_on]))
  const current = currentWeekNumber(schedule.data ?? [])
  const hashWeek = /^#week-(\d+)$/.exec(hash)?.[1]
  // null = untouched: the current week (or the one in the link) is open.
  const [openWeeks, setOpenWeeks] = useState<Set<number> | null>(() => (hashWeek ? new Set([Number(hashWeek)]) : null))
  const isOpen = (n: number) => (openWeeks ? openWeeks.has(n) : n === current)
  const toggle = (n: number) =>
    setOpenWeeks((prev) => {
      const next = new Set(prev ?? (current ? [current] : []))
      if (next.has(n)) next.delete(n)
      else next.add(n)
      return next
    })

  useEffect(() => {
    if (!hashWeek || !program.data) return
    document.getElementById(`week-${hashWeek}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hashWeek, program.data])

  const track = tracks.data?.find((tr) => tr.id === trackId)
  const weeks = program.data ?? []
  const past = weeks.filter((w) => current !== null && w.week_number < current)
  const now = weeks.filter((w) => w.week_number === current)
  const ahead = weeks.filter((w) => current === null || w.week_number > current)

  const renderWeek = (w: ProgramWeekRow) => (
    <WeekItem key={w.id} week={w} startsOn={dates.get(w.week_number)} isCurrent={w.week_number === current}
      upcoming={current === null || w.week_number > current} manage={manage}
      submission={subs.data?.get(w.id)} open={isOpen(w.week_number)} onToggle={() => toggle(w.week_number)} />
  )

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="max-w-3xl mx-auto space-y-4">
      <GlassCard>
        <h1 className={pageTitle}>{t('program.title')}</h1>
        {trackId && <p className="text-gray-700 mb-3">{t(`track.${trackId}`)}</p>}
        {isOversight && (
          <div className="flex flex-wrap gap-2 mb-3">
            {TRACK_IDS.map((id) => (
              <button key={id} className={segment(id === trackId)} onClick={() => setParams({ track: id }, { replace: true })}>
                {t(`track.${id}.short`)}
              </button>
            ))}
          </div>
        )}
        <p className="text-sm text-gray-700 mb-3">
          {!schedule.data?.length
            ? t('week.noSchedule')
            : current === null
              ? t('week.startsOn', { date: formatShortDay(schedule.data[0].starts_on) })
              : t('program.weekOf', { n: current, total: PROGRAM_WEEKS })}
        </p>
        {trackId && <DriveLink key={trackId} trackId={trackId} url={track?.drive_url ?? null} canEdit={manage} />}
      </GlassCard>

      {!trackId ? (
        <GlassCard><p className="text-sm text-gray-700">{t('week.noTrack')}</p></GlassCard>
      ) : (
        <DataState isLoading={program.isLoading || schedule.isLoading} error={program.error ?? schedule.error}
          onRetry={() => { void program.refetch(); void schedule.refetch() }}>
          <div className="space-y-3">
            {now.map(renderWeek)}
            {past.length > 0 && <h2 className="text-sm uppercase tracking-wider text-gray-600 pt-2 px-1">{t('program.past')}</h2>}
            {[...past].reverse().map(renderWeek)}
            {ahead.length > 0 && <h2 className="text-sm uppercase tracking-wider text-gray-600 pt-2 px-1">{t('program.ahead')}</h2>}
            {ahead.map(renderWeek)}
          </div>
        </DataState>
      )}
    </motion.div>
  )
}
