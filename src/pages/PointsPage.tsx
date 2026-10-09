import { useState } from 'react'
import type { FormEvent } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { GlassCard } from '../components/GlassCard'
import { DataState, ErrorText } from '../components/DataState'
import { Avatar } from '../components/Avatar'
import { TrackBadge } from '../components/TrackBadge'
import { pageVariants } from '../lib/animations'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useMembers } from '../hooks/useClub'
import { useLeaderboard, usePointsJournal, usePointsTotal } from '../hooks/usePoints'
import { awardPoints } from '../lib/pointsActions'
import { POINT_CATEGORIES, TRACK_IDS, formatDate } from '../lib/club'
import type { PointsCategory, PointsEntryRow, TrackId } from '../lib/db'
import { btnPrimary, inputClass, labelClass, pageTitle, sectionTitle, segment } from '../lib/ui'

function Journal({ entries, showMember }: { entries: PointsEntryRow[]; showMember: boolean }) {
  const { t } = useI18n()
  return (
    <ul className="divide-y divide-white/50">
      {entries.map((e) => (
        <li key={e.id} className="py-2.5 flex items-start justify-between gap-3">
          <div className="min-w-0 text-sm">
            {showMember && e.member && <p className="font-normal">{e.member.full_name}</p>}
            <p className="break-words">{e.note}</p>
            <p className="text-xs text-gray-600">
              {t(`points.category.${e.category}`)} · {formatDate(e.created_at)}
              {e.awarder && ` · ${t('points.confirmedBy', { name: e.awarder.full_name })}`}
            </p>
          </div>
          <span className={`text-sm font-medium tabular-nums ${e.amount >= 0 ? 'text-green-800' : 'text-red-700'}`}>
            {e.amount > 0 ? `+${e.amount}` : e.amount}
          </span>
        </li>
      ))}
    </ul>
  )
}

function AwardForm() {
  const { t } = useI18n()
  const { profile, isOversight } = useAuth()
  const members = useMembers()
  const [profileId, setProfileId] = useState('')
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState<PointsCategory>('required_work')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [done, setDone] = useState(false)

  // Who the viewer may award: director / curator — any active member; a lead — their track.
  const options = (members.data ?? []).filter(
    (m) => m.status === 'active' && m.id !== profile?.id
      && (isOversight || (m.role === 'member' && m.track_id === profile?.track_id)),
  )

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const value = Number(amount)
    if (!Number.isInteger(value) || value === 0 || (category !== 'correction' && value < 0)) return setError('invalid_amount')
    setBusy(true)
    setError(null)
    setDone(false)
    const res = await awardPoints(profileId, value, category, note)
    setBusy(false)
    if (res.error) return setError(res.error)
    setDone(true)
    setNote('')
    setAmount('')
  }

  return (
    <GlassCard>
      <h2 className={sectionTitle}>{t('points.award.title')}</h2>
      <p className="text-sm text-gray-700 mb-4">{t('points.award.hint')}</p>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className={labelClass}>{t('points.award.member')}</label>
          <select className={inputClass} value={profileId} onChange={(e) => setProfileId(e.target.value)} required>
            <option value="" disabled>{t('points.award.pick')}</option>
            {options.map((m) => (
              <option key={m.id} value={m.id}>{m.full_name}{m.grade ? `, ${t('common.gradeN', { n: m.grade })}` : ''}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <div>
            <label className={labelClass}>{t('points.award.category')}</label>
            <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value as PointsCategory)}>
              {POINT_CATEGORIES.map((c) => <option key={c} value={c}>{t(`points.category.${c}`)}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>{t('points.award.amount')}</label>
            <input className={inputClass} type="number" inputMode="numeric" step={1} value={amount}
              onChange={(e) => setAmount(e.target.value)} required />
          </div>
        </div>
        <div>
          <label className={labelClass}>{t('points.award.note')}</label>
          <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} required maxLength={300}
            placeholder={t('points.award.notePlaceholder')} />
        </div>
        {error === 'invalid_amount' ? (
          <p className="text-sm text-red-700" role="alert">{t('points.award.badAmount')}</p>
        ) : (
          <ErrorText error={error} />
        )}
        {done && <p className="text-sm text-green-800">{t('points.award.done')}</p>}
        <button type="submit" disabled={busy || !profileId} className={btnPrimary}>{t('points.award.submit')}</button>
      </form>
    </GlassCard>
  )
}

function Leaderboard() {
  const { t } = useI18n()
  const { profile } = useAuth()
  const [track, setTrack] = useState<TrackId | null>(profile?.role === 'member' ? (profile.track_id ?? null) : null)
  const board = useLeaderboard(track)
  const ranked = (board.data ?? []).filter((r) => r.total > 0)

  return (
    <GlassCard>
      <h2 className={sectionTitle}>{t('points.board')}</h2>
      <div className="flex gap-2 overflow-x-auto py-3 -mx-1 px-1">
        <button className={segment(track === null)} onClick={() => setTrack(null)}>{t('track.all')}</button>
        {TRACK_IDS.map((id) => (
          <button key={id} className={segment(track === id)} onClick={() => setTrack(id)}>{t(`track.${id}.short`)}</button>
        ))}
      </div>
      <DataState isLoading={board.isLoading} error={board.error} onRetry={() => void board.refetch()}
        empty={ranked.length === 0} emptyText={t('points.boardEmpty')}>
        <ol className="space-y-1">
          {ranked.map((r, i) => (
            <li key={r.profile_id}>
              <Link to={`/members/${r.profile_id}`}
                className={`flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/40 ${r.profile_id === profile?.id ? 'bg-[#750014]/10' : ''}`}>
                <span className="w-6 text-sm text-gray-500 tabular-nums">{i + 1}</span>
                <Avatar path={r.avatar_path} name={r.full_name} size="sm" />
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-sm">{r.full_name}</span>
                  <span className="flex items-center gap-1.5 text-xs text-gray-600">
                    {r.grade && t('common.gradeN', { n: r.grade })}
                    {track === null && <TrackBadge track={r.track_id} />}
                  </span>
                </span>
                <span className="text-sm font-medium tabular-nums">{r.total}</span>
              </Link>
            </li>
          ))}
        </ol>
      </DataState>
    </GlassCard>
  )
}

export function PointsPage() {
  const { t } = useI18n()
  const { profile, isStaff } = useAuth()
  const total = usePointsTotal(profile?.id)
  const mine = usePointsJournal(profile?.id ?? null, !isStaff && Boolean(profile?.id))
  const scope = usePointsJournal(null, isStaff, 100)

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="max-w-5xl mx-auto">
      <GlassCard className="mb-4">
        <h1 className={pageTitle}>AIT Points</h1>
        <p className="text-sm text-gray-700 mt-1">{t('points.intro')}</p>
      </GlassCard>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div className="space-y-4">
          {isStaff ? (
            <>
              <AwardForm />
              <GlassCard>
                <h2 className={sectionTitle}>{t('points.scopeJournal')}</h2>
                <p className="text-xs text-gray-600 mb-2">{t('points.scopeJournalHint')}</p>
                <DataState isLoading={scope.isLoading} error={scope.error} onRetry={() => void scope.refetch()}
                  empty={(scope.data ?? []).length === 0} emptyText={t('points.noEntries')}>
                  <Journal entries={scope.data ?? []} showMember />
                </DataState>
              </GlassCard>
            </>
          ) : (
            <GlassCard>
              <h2 className={sectionTitle}>{t('points.mine')}</h2>
              <p className="text-5xl font-light my-3">{total.data ?? 0}</p>
              <DataState isLoading={mine.isLoading} error={mine.error} onRetry={() => void mine.refetch()}
                empty={(mine.data ?? []).length === 0} emptyText={t('points.noneYet')}>
                <Journal entries={mine.data ?? []} showMember={false} />
              </DataState>
            </GlassCard>
          )}
        </div>
        <Leaderboard />
      </div>
    </motion.div>
  )
}
