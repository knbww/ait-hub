import { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, Clock, ExternalLink, GraduationCap, Users } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { cardVariants, pageVariants } from '../lib/animations'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useActiveSeason } from '../hooks/useActiveSeason'
import { useMySubmissions } from '../hooks/useMySubmissions'
import { useMyAttendance } from '../hooks/useMyAttendance'
import { useMembers } from '../hooks/useMembers'
import { useWeekRoster } from '../hooks/useWeekRoster'
import type { RosterSubmission } from '../hooks/useWeekRoster'
import { useCourses } from '../hooks/useCourses'
import { useAllCourses } from '../hooks/useAllCourses'
import { enrollCourse } from '../lib/coursesActions'
import { checkIn, openAttendance, reviewSubmission, submitAssignment } from '../lib/academyActions'
import { seasonProgress, weekStatus } from '../lib/academy'
import type { SeasonWeek, Submission } from '../types'

const inputClass =
  'w-full px-4 py-2 rounded-lg border border-white/60 bg-white/40 text-sm outline-none focus:border-gray-900 transition-colors'

function StatusBadge({
  submission,
}: {
  submission?: { status: 'submitted' | 'reviewed'; passed: boolean | null }
}) {
  const { t } = useI18n()
  const status = weekStatus(submission)
  if (status === 'reviewed') {
    const passed = submission?.passed
    return (
      <span
        className={`text-xs px-2.5 py-1 rounded-full ${
          passed ? 'bg-green-600/15 text-green-700' : 'bg-red-600/15 text-red-700'
        }`}
      >
        {passed ? `${t('weekStatus.reviewed')} ✓` : t('weekStatus.rework')}
      </span>
    )
  }
  if (status === 'submitted') {
    return (
      <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-700">
        {t('weekStatus.submitted')}
      </span>
    )
  }
  return (
    <span className="text-xs px-2.5 py-1 rounded-full bg-gray-900/10 text-gray-600">
      {t('weekStatus.not_started')}
    </span>
  )
}

function RosterRow({
  name,
  attended,
  submission,
}: {
  name: string
  attended: boolean
  submission?: RosterSubmission
}) {
  const { t } = useI18n()
  const [feedback, setFeedback] = useState(submission?.feedback ?? '')
  const [busy, setBusy] = useState(false)

  const review = async (pass: boolean) => {
    if (!submission) return
    setBusy(true)
    await reviewSubmission(submission.id, feedback, pass)
    setBusy(false)
  }

  return (
    <div className="py-3 border-t border-white/40 first:border-t-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-normal">{name}</span>
        <div className="flex items-center gap-2">
          {attended && (
            <span className="text-xs text-green-700 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> {t('academy.present')}
            </span>
          )}
          <StatusBadge submission={submission} />
        </div>
      </div>

      {submission ? (
        <div className="mt-2 space-y-2">
          <a
            href={submission.link}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-[#750014] inline-flex items-center gap-1 hover:underline break-all"
          >
            <ExternalLink className="w-3.5 h-3.5" /> {submission.link}
          </a>
          <input
            className={inputClass}
            placeholder={t('academy.feedbackPlaceholder')}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={() => review(true)}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg bg-green-700 text-white text-xs hover:scale-105 transition-all duration-300 disabled:opacity-60"
            >
              {t('academy.pass')}
            </button>
            <button
              onClick={() => review(false)}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg border border-gray-900 text-xs hover:bg-gray-900 hover:text-white transition-all duration-300 disabled:opacity-60"
            >
              {t('academy.rework')}
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-1 text-xs text-gray-500">{t('academy.notSubmitted')}</p>
      )}
    </div>
  )
}

function HostWeekPanel({ weekId }: { weekId: string }) {
  const { t } = useI18n()
  const { data: members = [] } = useMembers(true)
  const { data: roster } = useWeekRoster(weekId, true)
  const [code, setCode] = useState('')
  const [minutes, setMinutes] = useState(30)
  const [busy, setBusy] = useState(false)

  const open = async () => {
    if (!code.trim()) return
    setBusy(true)
    await openAttendance(weekId, code.trim(), minutes)
    setBusy(false)
  }

  return (
    <div className="p-4 rounded-2xl border border-white/50 bg-white/20">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4" />
        <h4 className="text-sm font-medium">{t('academy.hostTools')}</h4>
      </div>

      <div className="flex flex-wrap items-end gap-2 mb-4">
        <input
          className={`${inputClass} max-w-[160px]`}
          placeholder={t('academy.codePlaceholder')}
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <input
          type="number"
          min={1}
          className={`${inputClass} max-w-[90px]`}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value) || 1)}
        />
        <button
          onClick={open}
          disabled={busy}
          className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:scale-[1.02] transition-all duration-300 disabled:opacity-60"
        >
          {t('academy.openAttendance')}
        </button>
        {roster?.code && (
          <span className="text-xs text-gray-600">
            {t('academy.currentCode')} <strong>{roster.code}</strong>
          </span>
        )}
      </div>

      <div>
        {members.length ? (
          members.map((m) => (
            <RosterRow
              key={m.id}
              name={m.fullName}
              attended={roster?.attended.has(m.id) ?? false}
              submission={roster?.submissions.get(m.id)}
            />
          ))
        ) : (
          <p className="text-xs text-gray-500">{t('academy.rosterLoading')}</p>
        )}
      </div>
    </div>
  )
}

function MemberWeekBody({
  week,
  submission,
  attended,
  isAuthed,
}: {
  week: SeasonWeek
  submission?: Submission
  attended: boolean
  isAuthed: boolean
}) {
  const { t } = useI18n()
  const [link, setLink] = useState('')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const [code, setCode] = useState('')
  const [checking, setChecking] = useState(false)
  const [checkMsg, setCheckMsg] = useState<string | null>(null)

  const submit = async () => {
    if (!link.trim()) return
    setBusy(true)
    setMsg(null)
    const { error } = await submitAssignment(week.id, link.trim(), comment.trim())
    setBusy(false)
    setMsg(error ?? t('academy.sent'))
    if (!error) {
      setLink('')
      setComment('')
    }
  }

  const doCheckIn = async () => {
    if (!code.trim()) return
    setChecking(true)
    setCheckMsg(null)
    const { result, error } = await checkIn(week.id, code.trim())
    setChecking(false)
    setCheckMsg(error ?? (result ? t(`checkin.${result}`) : null))
    if (!error && result === 'ok') setCode('')
  }

  return (
    <>
      {submission && (
        <div className="mb-4 text-sm">
          <a
            href={submission.link}
            target="_blank"
            rel="noreferrer"
            className="text-[#750014] inline-flex items-center gap-1 hover:underline break-all"
          >
            <ExternalLink className="w-3.5 h-3.5" /> {t('academy.yourWork')}
          </a>
          {submission.status === 'reviewed' && submission.feedback && (
            <p className="mt-1 text-gray-600 italic">«{submission.feedback}»</p>
          )}
        </div>
      )}

      {isAuthed ? (
        <div className="space-y-2 mb-4">
          <input
            className={inputClass}
            placeholder={t('academy.linkPlaceholder')}
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          <textarea
            className={inputClass}
            placeholder={t('academy.commentPlaceholder')}
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="flex items-center gap-3">
            <button
              onClick={submit}
              disabled={busy}
              className="px-4 py-1.5 rounded-lg bg-gray-900 text-white text-sm hover:scale-[1.02] transition-all duration-300 disabled:opacity-60"
            >
              {busy ? t('academy.sending') : submission ? t('academy.resubmit') : t('academy.submit')}
            </button>
            {msg && <span className="text-xs text-gray-600">{msg}</span>}
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-500 mb-4">{t('academy.loginToSubmit')}</p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {attended ? (
          <span className="text-sm text-green-700 inline-flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> {t('academy.checked')}
          </span>
        ) : isAuthed ? (
          <>
            <input
              className={`${inputClass} max-w-[150px]`}
              placeholder={t('academy.codePlaceholder')}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button
              onClick={doCheckIn}
              disabled={checking}
              className="px-3 py-1.5 rounded-lg border border-gray-900 text-sm hover:bg-gray-900 hover:text-white transition-all duration-300 disabled:opacity-60"
            >
              {t('academy.checkIn')}
            </button>
            {checkMsg && <span className="text-xs text-gray-600">{checkMsg}</span>}
          </>
        ) : (
          <span className="text-xs text-gray-500">{t('academy.attendanceHint')}</span>
        )}
      </div>
    </>
  )
}

function WeekCard({
  week,
  submission,
  attended,
  isAuthed,
  isHost,
}: {
  week: SeasonWeek
  submission?: Submission
  attended: boolean
  isAuthed: boolean
  isHost: boolean
}) {
  const { t } = useI18n()
  return (
    <motion.div variants={cardVariants}>
      <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.15)]">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-500">
              {t('academy.week', { n: week.weekNumber })}
            </p>
            <h3 className="text-xl font-normal">{week.topic}</h3>
          </div>
          {!isHost && <StatusBadge submission={submission} />}
        </div>

        {week.description && <p className="text-sm text-gray-700 mb-3">{week.description}</p>}

        {week.dueDate && (
          <p className="text-xs text-gray-500 flex items-center gap-1 mb-3">
            <Clock className="w-3.5 h-3.5" /> {t('academy.deadline', { date: week.dueDate })}
          </p>
        )}

        {week.links.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {week.links.map((l) => (
              <a
                key={l.url}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1 rounded-full bg-white/40 border border-white/60 text-xs inline-flex items-center gap-1 hover:bg-white/70 transition-colors"
              >
                <ExternalLink className="w-3 h-3" /> {l.label}
              </a>
            ))}
          </div>
        )}

        {week.assignmentBrief && (
          <div className="p-3 rounded-xl bg-white/20 border border-white/50 text-sm text-gray-800 mb-4">
            <span className="font-medium">{t('academy.assignment')}</span>
            {week.assignmentBrief}
          </div>
        )}

        {isHost ? (
          <HostWeekPanel weekId={week.id} />
        ) : (
          <MemberWeekBody
            week={week}
            submission={submission}
            attended={attended}
            isAuthed={isAuthed}
          />
        )}
      </GlassCard>
    </motion.div>
  )
}

function CourseCatalog() {
  const { t } = useI18n()
  const { profile } = useAuth()
  const { data: enrolled = [] } = useCourses(profile?.id)
  const { data: catalog = [], isLoading, error } = useAllCourses()
  const [busy, setBusy] = useState<string | null>(null)
  const enrolledIds = new Set(enrolled.map((c) => c.courseId))

  const enroll = async (courseId: string) => {
    if (!profile?.id) return
    setBusy(courseId)
    await enrollCourse(profile.id, courseId)
    setBusy(null)
  }

  if (isLoading) return <p className="text-center text-gray-500 py-10">{t('common.loading')}</p>
  if (error) return <p className="text-center text-gray-500 py-10">{t('academy.catalogError')}</p>
  if (!catalog.length)
    return <p className="text-center text-gray-500 py-10">{t('academy.catalogEmpty')}</p>

  return (
    <div className="space-y-3">
      {catalog.map((c) => {
        const isEnrolled = enrolledIds.has(c.id)
        return (
          <motion.div key={c.id} variants={cardVariants}>
            <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.15)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-normal">{c.title}</h3>
                  {c.level && (
                    <p className="text-xs text-gray-500">{t('courses.level', { value: c.level })}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {c.syllabusUrl && (
                    <a
                      href={c.syllabusUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg border border-gray-900 text-xs hover:bg-gray-900 hover:text-white transition-all duration-300"
                    >
                      {t('academy.catalogOpen')}
                    </a>
                  )}
                  {isEnrolled ? (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-green-600/15 text-green-700">
                      {t('courses.enrolled')}
                    </span>
                  ) : (
                    <button
                      onClick={() => enroll(c.id)}
                      disabled={busy === c.id}
                      className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs hover:scale-105 transition-all duration-300 disabled:opacity-60"
                    >
                      {t('courses.enroll')}
                    </button>
                  )}
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )
      })}
    </div>
  )
}

export function AcademyPage() {
  const { t } = useI18n()
  const { profile, role, session } = useAuth()
  const { data: season, isLoading } = useActiveSeason()
  const { data: submissions } = useMySubmissions(profile?.id)
  const { data: attendance } = useMyAttendance(profile?.id)

  const [tab, setTab] = useState<'season' | 'catalog'>('season')
  const isAuthed = Boolean(session)
  const isHost = role === 'mentor' || role === 'admin'
  const subs = submissions ?? new Map<string, Submission>()
  const attended = attendance ?? new Set<string>()

  const progress = season
    ? seasonProgress(
        season.weeks.map((w) => w.id),
        subs,
      )
    : { done: 0, total: 0 }
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0

  const tabClass = (active: boolean) =>
    `px-4 py-1.5 rounded-lg text-sm transition-colors ${
      active ? 'bg-gray-900 text-white' : 'border border-white/60 bg-white/30 hover:bg-white/60'
    }`

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="max-w-3xl mx-auto"
    >
      <motion.div variants={cardVariants} className="mb-6">
        <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
          <div className="flex items-center gap-3 mb-4">
            <GraduationCap className="w-7 h-7" />
            <h2 className="text-3xl font-light">{t('academy.title')}</h2>
            {isHost && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-[#750014]/10 text-[#750014]">
                {t('academy.hostMode')}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button className={tabClass(tab === 'season')} onClick={() => setTab('season')}>
              {t('academy.tabSeason')}
            </button>
            <button className={tabClass(tab === 'catalog')} onClick={() => setTab('catalog')}>
              {t('academy.tabCatalog')}
            </button>
          </div>
        </GlassCard>
      </motion.div>

      {/* Keyed on `tab` so the subtree remounts and replays its enter animation on every
          switch. Without this, content mounted after the page's stagger settles stays stuck
          at the `initial` variant (opacity 0) — the "season/catalogue vanishes" bug. */}
      <motion.div key={tab} variants={pageVariants} initial="initial" animate="animate">
        {tab === 'catalog' ? (
          <CourseCatalog />
      ) : isLoading ? (
        <p className="text-center text-gray-500 py-10">{t('common.loading')}</p>
      ) : !season ? (
        <p className="text-center text-gray-500 py-10">{t('academy.notOpen')}</p>
      ) : (
        <div className="space-y-6">
          {!isHost && (
            <motion.div variants={cardVariants}>
              <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
                <h3 className="text-lg font-normal mb-2">{season.title}</h3>
                <div className="flex justify-between text-sm mb-2">
                  <span className="font-medium">{t('academy.progressSeason')}</span>
                  <span>{t('season.weeksOf', { done: progress.done, total: progress.total })}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-[#750014] h-2 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </GlassCard>
            </motion.div>
          )}

          {season.weeks.map((week) => (
            <WeekCard
              key={week.id}
              week={week}
              submission={subs.get(week.id)}
              attended={attended.has(week.id)}
              isAuthed={isAuthed}
              isHost={isHost}
            />
          ))}
        </div>
      )}
      </motion.div>
    </motion.div>
  )
}
