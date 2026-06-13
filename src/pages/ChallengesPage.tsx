import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Trophy } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { cardVariants, pageVariants } from '../lib/animations'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useChallenges } from '../hooks/useChallenges'
import { createChallenge } from '../lib/challengeActions'
import type { Challenge } from '../types'

const inputClass =
  'w-full px-4 py-2 rounded-lg border border-white/60 bg-white/40 text-sm outline-none focus:border-gray-900 transition-colors'

export function StatusChip({ status }: { status: string }) {
  const { t } = useI18n()
  const tone =
    status === 'open'
      ? 'bg-green-600/15 text-green-700'
      : status === 'judging'
        ? 'bg-amber-500/20 text-amber-700'
        : status === 'closed'
          ? 'bg-gray-900/10 text-gray-600'
          : 'bg-blue-500/15 text-blue-700'
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full ${tone}`}>{t(`challengeStatus.${status}`)}</span>
  )
}

function CreateChallengeForm() {
  const { t } = useI18n()
  const [title, setTitle] = useState('')
  const [rules, setRules] = useState('')
  const [starterUrl, setStarterUrl] = useState('')
  const [deadline, setDeadline] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const submit = async () => {
    if (!title.trim()) return
    setBusy(true)
    setMsg(null)
    const { error } = await createChallenge({ title: title.trim(), rules, starterUrl, deadline })
    setBusy(false)
    if (error) {
      setMsg(error)
      return
    }
    setMsg(t('challenges.created'))
    setTitle('')
    setRules('')
    setStarterUrl('')
    setDeadline('')
  }

  return (
    <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
      <h3 className="text-lg font-light mb-4">{t('challenges.create')}</h3>
      <div className="space-y-3">
        <input
          className={inputClass}
          placeholder={t('challenges.namePlaceholder')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className={inputClass}
          placeholder={t('challenges.rulesPlaceholder')}
          rows={3}
          value={rules}
          onChange={(e) => setRules(e.target.value)}
        />
        <input
          className={inputClass}
          placeholder={t('challenges.starterPlaceholder')}
          value={starterUrl}
          onChange={(e) => setStarterUrl(e.target.value)}
        />
        <label className="block text-xs text-gray-600">
          {t('challenges.deadlineLabel')}
          <input
            type="datetime-local"
            className={inputClass}
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </label>
        <div className="flex items-center gap-3">
          <button
            onClick={submit}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:scale-[1.02] transition-all duration-300 disabled:opacity-60"
          >
            {busy ? t('challenges.creating') : t('challenges.createOpen')}
          </button>
          {msg && <span className="text-xs text-gray-600">{msg}</span>}
        </div>
      </div>
    </GlassCard>
  )
}

export function ChallengesPage() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const { role } = useAuth()
  const isAdmin = role === 'admin'
  const { data: challenges = [] } = useChallenges()

  const visible = challenges.filter((c) => isAdmin || c.status !== 'draft')
  const active = visible.filter((c) => c.status !== 'closed')
  const archive = visible.filter((c) => c.status === 'closed')

  const Row = (c: Challenge) => (
    <button
      key={c.id}
      onClick={() => navigate(`/challenges/${c.id}`)}
      className="w-full flex items-center justify-between gap-3 p-4 rounded-2xl border border-white/50 bg-white/15 hover:bg-white/30 transition-all duration-300 text-left"
    >
      <div>
        <p className="font-normal">{c.title}</p>
        {c.deadline && (
          <p className="text-xs text-gray-500">
            {t('challenges.until', { date: new Date(c.deadline).toLocaleDateString() })}
          </p>
        )}
      </div>
      <StatusChip status={c.status} />
    </button>
  )

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="max-w-3xl mx-auto space-y-6"
    >
      <motion.div variants={cardVariants}>
        <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
          <div className="flex items-center gap-3">
            <Trophy className="w-7 h-7" />
            <h2 className="text-3xl font-light">{t('challenges.title')}</h2>
          </div>
        </GlassCard>
      </motion.div>

      {isAdmin && (
        <motion.div variants={cardVariants}>
          <CreateChallengeForm />
        </motion.div>
      )}

      <motion.div variants={cardVariants}>
        <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
          <h3 className="text-lg font-light mb-4">{t('challenges.active')}</h3>
          {active.length === 0 ? (
            <p className="text-sm text-gray-500">{t('challenges.noActive')}</p>
          ) : (
            <div className="space-y-2">{active.map(Row)}</div>
          )}
        </GlassCard>
      </motion.div>

      {archive.length > 0 && (
        <motion.div variants={cardVariants}>
          <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
            <h3 className="text-lg font-light mb-4">{t('challenges.archive')}</h3>
            <div className="space-y-2">{archive.map(Row)}</div>
          </GlassCard>
        </motion.div>
      )}
    </motion.div>
  )
}
