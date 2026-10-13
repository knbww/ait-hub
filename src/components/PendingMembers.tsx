import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Check, UserPlus, X } from 'lucide-react'
import { GlassCard } from './GlassCard'
import { TrackBadge } from './TrackBadge'
import { ErrorText } from './DataState'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useMembers } from '../hooks/useClub'
import { decideJoin } from '../lib/memberActions'
import { formatAgo } from '../lib/club'
import { btnPrimary, btnSmall } from '../lib/ui'

/** Newcomers who joined with a code and wait for a decision — for the lead of their track and the
 * director / curator. Shown on the home page only while there are some. */
export function PendingMembers() {
  const { t } = useI18n()
  const { profile, isStaff, isOversight } = useAuth()
  const members = useMembers(isStaff)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<unknown>(null)
  const pending = (members.data ?? []).filter(
    (m) => m.status === 'pending' && (isOversight || (m.track_id !== null && m.track_id === profile?.track_id)),
  )
  if (!isStaff || pending.length === 0) return null

  const decide = async (id: string, approve: boolean) => {
    if (!approve && !window.confirm(t('pending.rejectConfirm'))) return
    setBusy(id)
    setError(null)
    const res = await decideJoin(id, approve)
    setBusy(null)
    if (res.error) setError(res.error)
  }

  return (
    <GlassCard className="mb-5 !border-[#750014]/30">
      <div className="flex items-center gap-2 mb-3">
        <UserPlus className="w-5 h-5 text-[#750014]" />
        <h2 className="text-lg font-light">{t('pending.title', { n: pending.length })}</h2>
      </div>
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {pending.map((m) => (
            <motion.li key={m.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 24 }}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3 rounded-2xl bg-white/50 border border-white/80">
              <Link to={`/members/${m.id}`} className="min-w-0 flex-1 basis-48">
                <span className="block text-sm font-medium truncate">{m.full_name}</span>
                <span className="flex flex-wrap items-center gap-1.5 text-xs text-gray-600 mt-0.5">
                  {m.grade && t('common.gradeN', { n: m.grade })}
                  <TrackBadge track={m.track_id} />
                  <span>· {t('pending.joined', { ago: formatAgo(m.created_at) })}</span>
                </span>
              </Link>
              <div className="flex gap-2">
                <button disabled={busy === m.id} onClick={() => void decide(m.id, true)} className={`${btnPrimary} !min-h-[38px]`}>
                  <Check className="w-4 h-4" /> {t('pending.approve')}
                </button>
                <button disabled={busy === m.id} onClick={() => void decide(m.id, false)}
                  className={`${btnSmall} border border-gray-900/20 bg-white/40 text-gray-700`} aria-label={t('pending.reject')}>
                  <X className="w-4 h-4" /> {t('pending.reject')}
                </button>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      <p className="text-xs text-gray-600 mt-3">{t('pending.hint')}</p>
      <ErrorText error={error} />
    </GlassCard>
  )
}
