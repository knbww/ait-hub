import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Award, Clock, ExternalLink } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { cardVariants, pageVariants } from '../lib/animations'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useChallenge } from '../hooks/useChallenge'
import { enterChallenge, judgeEntry, setChallengeStatus } from '../lib/challengeActions'
import { PRIZE_BY_PLACE } from '../lib/challenge'
import type { ChallengeEntry } from '../types'

const inputClass =
  'w-full px-4 py-2 rounded-lg border border-white/60 bg-white/40 text-sm outline-none focus:border-gray-900 transition-colors'

function ParticipateForm({ challengeId, existing }: { challengeId: string; existing?: ChallengeEntry }) {
  const { t } = useI18n()
  const [link, setLink] = useState('')
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const submit = async () => {
    if (!link.trim()) return
    setBusy(true)
    setMsg(null)
    const { result, error } = await enterChallenge(challengeId, link.trim(), comment.trim())
    setBusy(false)
    setMsg(error ?? (result ? t(`enter.${result}`) : null))
    if (!error && result === 'ok') {
      setLink('')
      setComment('')
    }
  }

  return (
    <div className="space-y-2">
      {existing && (
        <p className="text-sm">
          {t('challenge.yourWork')}
          <a
            href={existing.link}
            target="_blank"
            rel="noreferrer"
            className="text-[#750014] inline-flex items-center gap-1 hover:underline break-all"
          >
            <ExternalLink className="w-3.5 h-3.5" /> {t('challenge.linkWord')}
          </a>
        </p>
      )}
      <input
        className={inputClass}
        placeholder={t('challenge.linkPlaceholder')}
        value={link}
        onChange={(e) => setLink(e.target.value)}
      />
      <textarea
        className={inputClass}
        placeholder={t('challenge.commentPlaceholder')}
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
          {busy ? t('challenge.sending') : existing ? t('challenge.update') : t('challenge.participate')}
        </button>
        {msg && <span className="text-xs text-gray-600">{msg}</span>}
      </div>
    </div>
  )
}

function PlaceBadge({ entry }: { entry: ChallengeEntry }) {
  const { t } = useI18n()
  if (entry.place == null) return null
  return (
    <span className="text-xs px-2 py-1 rounded-full bg-[#750014]/10 text-[#750014] inline-flex items-center gap-1">
      <Award className="w-3.5 h-3.5" /> {t('challenge.place', { n: entry.place })}
      {entry.prizeAwarded ? ' · +AIP' : ''}
    </span>
  )
}

function JuryEntryRow({ challengeId, entry }: { challengeId: string; entry: ChallengeEntry }) {
  const { t } = useI18n()
  const [score, setScore] = useState(entry.score ?? 0)
  const [place, setPlace] = useState(entry.place ?? 0)
  const [aip, setAip] = useState(entry.place ? (PRIZE_BY_PLACE[entry.place] ?? 0) : 0)
  const [busy, setBusy] = useState(false)

  const onPlace = (p: number) => {
    setPlace(p)
    setAip(PRIZE_BY_PLACE[p] ?? 0)
  }

  const save = async () => {
    setBusy(true)
    await judgeEntry(challengeId, entry.id, score, place, aip)
    setBusy(false)
  }

  return (
    <div className="py-3 border-t border-white/40 first:border-t-0">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-sm font-normal">{entry.memberName}</span>
        <PlaceBadge entry={entry} />
      </div>
      <a
        href={entry.link}
        target="_blank"
        rel="noreferrer"
        className="text-xs text-[#750014] inline-flex items-center gap-1 hover:underline break-all"
      >
        <ExternalLink className="w-3.5 h-3.5" /> {entry.link}
      </a>
      <div className="flex flex-wrap items-end gap-2 mt-2">
        <label className="text-xs text-gray-600">
          {t('challenge.score')}
          <input
            type="number"
            className={`${inputClass} max-w-[90px]`}
            value={score}
            onChange={(e) => setScore(Number(e.target.value) || 0)}
          />
        </label>
        <label className="text-xs text-gray-600">
          {t('challenge.placeField')}
          <input
            type="number"
            min={0}
            className={`${inputClass} max-w-[80px]`}
            value={place}
            onChange={(e) => onPlace(Number(e.target.value) || 0)}
          />
        </label>
        <label className="text-xs text-gray-600">
          AIP
          <input
            type="number"
            className={`${inputClass} max-w-[90px]`}
            value={aip}
            onChange={(e) => setAip(Number(e.target.value) || 0)}
          />
        </label>
        <button
          onClick={save}
          disabled={busy}
          className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs hover:scale-105 transition-all duration-300 disabled:opacity-60"
        >
          {t('common.save')}
        </button>
      </div>
    </div>
  )
}

function ReadonlyEntryRow({ entry }: { entry: ChallengeEntry }) {
  return (
    <div className="py-3 border-t border-white/40 first:border-t-0 flex items-center justify-between gap-3">
      <a
        href={entry.link}
        target="_blank"
        rel="noreferrer"
        className="text-sm hover:underline inline-flex items-center gap-2"
      >
        <span className="font-normal">{entry.memberName}</span>
        <ExternalLink className="w-3.5 h-3.5 text-gray-500" />
      </a>
      <PlaceBadge entry={entry} />
    </div>
  )
}

export function ChallengePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useI18n()
  const { profile, role } = useAuth()
  const isJury = role === 'mentor' || role === 'admin'
  const isAdmin = role === 'admin'
  const { data, isLoading } = useChallenge(id, profile?.id)

  if (isLoading) {
    return <p className="max-w-3xl mx-auto text-center py-20 text-gray-500">{t('common.loading')}</p>
  }
  if (!data) {
    return <p className="max-w-3xl mx-auto text-center py-20 text-gray-500">{t('challenge.notFound')}</p>
  }

  const { challenge, entries, myEntry } = data
  const openForEntries =
    challenge.status === 'open' &&
    (!challenge.deadline || new Date(challenge.deadline) > new Date())

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="max-w-3xl mx-auto space-y-6"
    >
      <button
        onClick={() => navigate('/challenges')}
        className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
      >
        {t('challenge.back')}
      </button>

      <motion.div variants={cardVariants}>
        <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h2 className="text-3xl font-light">{challenge.title}</h2>
            <span className="text-xs px-2.5 py-1 rounded-full bg-gray-900/10 text-gray-700 shrink-0">
              {t(`challengeStatus.${challenge.status}`)}
            </span>
          </div>

          {challenge.description && <p className="text-sm text-gray-700 mb-3">{challenge.description}</p>}
          {challenge.deadline && (
            <p className="text-xs text-gray-500 flex items-center gap-1 mb-3">
              <Clock className="w-3.5 h-3.5" />{' '}
              {t('challenge.deadline', { date: new Date(challenge.deadline).toLocaleString() })}
            </p>
          )}
          {challenge.rules && (
            <div className="p-3 rounded-xl bg-white/20 border border-white/50 text-sm text-gray-800 mb-3 whitespace-pre-line">
              {challenge.rules}
            </div>
          )}
          {challenge.starterUrl && (
            <a
              href={challenge.starterUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-[#750014] inline-flex items-center gap-1 hover:underline mb-4"
            >
              <ExternalLink className="w-4 h-4" /> {t('challenge.starterKit')}
            </a>
          )}

          <div className="mt-2">
            {openForEntries ? (
              <ParticipateForm challengeId={challenge.id} existing={myEntry} />
            ) : (
              <p className="text-sm text-gray-500">{t('challenge.entriesClosed')}</p>
            )}
          </div>

          {isAdmin && (
            <div className="mt-4 pt-4 border-t border-white/40 flex flex-wrap gap-2">
              <span className="text-xs text-gray-500 self-center">{t('challenge.statusLabel')}</span>
              {(['open', 'judging', 'closed'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setChallengeStatus(challenge.id, s)}
                  className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                    challenge.status === s
                      ? 'bg-gray-900 text-white'
                      : 'border border-gray-900 hover:bg-gray-900 hover:text-white'
                  }`}
                >
                  {t(`challengeStatus.${s}`)}
                </button>
              ))}
            </div>
          )}
        </GlassCard>
      </motion.div>

      {(isJury || challenge.status === 'closed') && (
        <motion.div variants={cardVariants}>
          <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
            <h3 className="text-lg font-light mb-2">{t('challenge.works')}</h3>
            {entries.length === 0 ? (
              <p className="text-sm text-gray-500">{t('challenge.noWorks')}</p>
            ) : (
              <div>
                {entries.map((e) =>
                  isJury ? (
                    <JuryEntryRow key={e.id} challengeId={challenge.id} entry={e} />
                  ) : (
                    <ReadonlyEntryRow key={e.id} entry={e} />
                  ),
                )}
              </div>
            )}
          </GlassCard>
        </motion.div>
      )}
    </motion.div>
  )
}
