import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { GlassCard } from '../components/GlassCard'
import { pageVariants } from '../lib/animations'
import { supabase } from '../lib/supabase'
import { useI18n } from '../context/i18nContext'
import { useMembers } from '../hooks/useMembers'
import { useAipJournal } from '../hooks/useAipJournal'
import { useReferralFunnel } from '../hooks/useReferralFunnel'
import { awardAip } from '../lib/aipActions'
import { Link } from 'react-router-dom'
import { acceptApplication, rejectApplication } from '../lib/applicationActions'
import { AutomationsPanel } from '../components/AutomationsPanel'

function scoreColor(s: number): string {
  if (s >= 70) return 'bg-green-600/15 text-green-700'
  if (s >= 40) return 'bg-amber-500/20 text-amber-700'
  return 'bg-red-600/15 text-red-700'
}
import { AIP_AWARD_SOURCES, AIP_DEFAULT_POINTS } from '../lib/aip'
import type { ApplicationRow, BookingRow, ProfileRow } from '../lib/db-rows'

const inputClass =
  'w-full px-4 py-2 rounded-lg border border-white/60 bg-white/40 text-sm outline-none focus:border-gray-900 transition-colors'

function AwardAipForm() {
  const { t } = useI18n()
  const { data: members = [] } = useMembers(true)
  const [profileId, setProfileId] = useState('')
  const [source, setSource] = useState('manual')
  const [points, setPoints] = useState(0)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const onSource = (s: string) => {
    setSource(s)
    setPoints(AIP_DEFAULT_POINTS[s] ?? 0)
  }

  const submit = async () => {
    if (!profileId || points === 0) {
      setMsg(t('admin.awardValidation'))
      return
    }
    setBusy(true)
    setMsg(null)
    const { error } = await awardAip(profileId, source, points, note.trim())
    setBusy(false)
    if (error) {
      setMsg(error)
      return
    }
    setMsg(t('admin.awarded'))
    setNote('')
  }

  return (
    <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
      <h2 className="text-2xl font-light mb-1">{t('admin.awardTitle')}</h2>
      <p className="text-sm text-gray-600 mb-6">{t('admin.awardHint')}</p>

      <div className="space-y-3">
        <select className={inputClass} value={profileId} onChange={(e) => setProfileId(e.target.value)}>
          <option value="">{t('admin.memberOption')}</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.fullName}
            </option>
          ))}
        </select>

        <div className="flex gap-3">
          <select className={inputClass} value={source} onChange={(e) => onSource(e.target.value)}>
            {AIP_AWARD_SOURCES.map((s) => (
              <option key={s} value={s}>
                {t(`aip.action.${s}`)}
              </option>
            ))}
          </select>
          <input
            type="number"
            className={`${inputClass} max-w-[120px]`}
            value={points}
            onChange={(e) => setPoints(Number(e.target.value) || 0)}
            placeholder="AIP"
          />
        </div>

        <input
          className={inputClass}
          placeholder={t('admin.commentPlaceholder')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="flex items-center gap-3">
          <button
            onClick={submit}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:scale-[1.02] transition-all duration-300 disabled:opacity-60"
          >
            {busy ? t('admin.awarding') : t('admin.award')}
          </button>
          {msg && <span className="text-xs text-gray-600">{msg}</span>}
        </div>
      </div>
    </GlassCard>
  )
}

function RecentJournal() {
  const { t } = useI18n()
  const { data: journal = [] } = useAipJournal()
  return (
    <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
      <h2 className="text-2xl font-light mb-1">{t('admin.journalTitle')}</h2>
      <p className="text-sm text-gray-600 mb-6">{t('admin.journalSub')}</p>
      {journal.length === 0 ? (
        <p className="text-sm text-gray-500">{t('common.empty')}</p>
      ) : (
        <div className="space-y-1">
          {journal.slice(0, 12).map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-white/30 transition-colors"
            >
              <span className="text-sm">
                {e.memberName} <span className="text-gray-500">· {t(`aip.action.${e.source}`)}</span>
              </span>
              <span
                className={`text-sm font-medium ${e.delta >= 0 ? 'text-green-700' : 'text-red-700'}`}
              >
                {e.delta >= 0 ? `+${e.delta}` : e.delta}
              </span>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  )
}

function ReferralFunnel() {
  const { t } = useI18n()
  const { data: rows = [] } = useReferralFunnel()
  return (
    <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
      <h2 className="text-2xl font-light mb-1">{t('admin.funnelTitle')}</h2>
      <p className="text-sm text-gray-600 mb-6">{t('admin.funnelCount', { n: rows.length })}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">{t('admin.noReferrals')}</p>
      ) : (
        <div className="space-y-1">
          {rows.map((r) => (
            <div
              key={r.member_id}
              className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-white/30 transition-colors"
            >
              <span className="text-sm">
                {r.referrer_name} → {r.member_name}
              </span>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  r.rewarded
                    ? 'bg-green-600/15 text-green-700'
                    : r.reached_week3
                      ? 'bg-amber-500/20 text-amber-700'
                      : 'bg-gray-900/10 text-gray-600'
                }`}
              >
                {r.rewarded ? t('admin.rewarded') : r.reached_week3 ? t('admin.week3') : t('admin.registered')}
              </span>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  )
}

export function AdminPage() {
  const { t } = useI18n()
  const { data: roster = [] } = useQuery<ProfileRow[]>({
    queryKey: ['admin', 'roster'],
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, avatar_url')
        .order('full_name', { ascending: true })
        .returns<ProfileRow[]>()
      if (error) throw error
      return data
    },
  })

  const { data: applications = [] } = useQuery<ApplicationRow[]>({
    queryKey: ['admin', 'applications'],
    queryFn: async () => {
      if (!supabase) return []
      try {
        const { data, error } = await supabase
          .from('applications')
          .select('id, full_name, email, status, ai_score, ai_screening, payload, created_at')
          .order('created_at', { ascending: false })
          .returns<ApplicationRow[]>()
        if (error) throw error
        return data
      } catch (e) {
        console.warn('admin applications query failed:', e)
        return []
      }
    },
  })

  const [busyId, setBusyId] = useState<string | null>(null)
  const accept = async (id: string) => {
    setBusyId(id)
    await acceptApplication(id)
    setBusyId(null)
  }
  const reject = async (id: string) => {
    setBusyId(id)
    await rejectApplication(id)
    setBusyId(null)
  }

  const { data: bookings = [] } = useQuery<BookingRow[]>({
    queryKey: ['admin', 'bookings'],
    queryFn: async () => {
      if (!supabase) return []
      try {
        const { data, error } = await supabase
          .from('mentorship_bookings')
          .select('id, mentor_name, requester_name, requester_email, status, created_at')
          .order('created_at', { ascending: false })
          .returns<BookingRow[]>()
        if (error) throw error
        return data
      } catch (e) {
        console.warn('admin bookings query failed:', e)
        return []
      }
    },
  })

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="max-w-2xl mx-auto space-y-6"
    >
      <AutomationsPanel applications={applications} />
      <AwardAipForm />
      <RecentJournal />
      <ReferralFunnel />

      <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
        <h2 className="text-2xl font-light mb-1">{t('admin.membersTitle')}</h2>
        <p className="text-sm text-gray-600 mb-6">{t('admin.membersCount', { n: roster.length })}</p>
        <div className="space-y-1">
          {roster.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-white/30 transition-colors"
            >
              <Link
                to={`/members/${m.id}`}
                className="text-sm font-normal hover:text-[#750014] hover:underline"
              >
                {m.full_name}
              </Link>
              <span className="text-xs px-2 py-1 rounded-full bg-[#750014]/10 text-[#750014]">
                {t(`roles.${m.role}`)}
              </span>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
        <h2 className="text-2xl font-light mb-1">{t('admin.appsTitle')}</h2>
        <p className="text-sm text-gray-600 mb-6">{t('admin.appsCount', { n: applications.length })}</p>
        {applications.length === 0 ? (
          <p className="text-sm text-gray-500">{t('admin.noApps')}</p>
        ) : (
          <div className="space-y-1">
            {applications.map((a) => {
              const screening = a.ai_screening
              const pending = a.status === 'pending' || a.status === 'screened'
              return (
                <div
                  key={a.id}
                  className="py-3 px-3 rounded-xl hover:bg-white/30 transition-colors border-b border-white/30 last:border-0"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-normal">
                        {a.full_name ?? '—'} <span className="text-gray-500">&lt;{a.email}&gt;</span>
                      </p>
                      {screening?.recommended_role && (
                        <p className="text-xs text-gray-500">
                          {t('admin.suggested', { role: screening.recommended_role })}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {a.ai_score != null && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${scoreColor(a.ai_score)}`}>
                          {a.ai_score}
                        </span>
                      )}
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-900/10 capitalize">{a.status}</span>
                    </div>
                  </div>

                  {a.payload?.motivation && (
                    <p className="text-xs text-gray-600 mt-1.5 whitespace-pre-wrap">{a.payload.motivation}</p>
                  )}
                  {screening?.reasons?.length ? (
                    <p className="text-xs text-gray-500 mt-1">✓ {screening.reasons.join(' · ')}</p>
                  ) : null}
                  {screening?.flags?.length ? (
                    <p className="text-xs text-red-600 mt-0.5">⚠ {screening.flags.join(' · ')}</p>
                  ) : null}

                  {pending && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => accept(a.id)}
                        disabled={busyId === a.id}
                        className="text-xs px-3 py-1 rounded-lg bg-gray-900 text-white hover:scale-[1.02] transition-all duration-300 disabled:opacity-60"
                      >
                        {busyId === a.id ? t('admin.accepting') : t('admin.accept')}
                      </button>
                      <button
                        onClick={() => reject(a.id)}
                        disabled={busyId === a.id}
                        className="text-xs px-3 py-1 rounded-lg border border-gray-900 hover:bg-gray-900 hover:text-white transition-all duration-300 disabled:opacity-60"
                      >
                        {t('admin.reject')}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </GlassCard>

      <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
        <h2 className="text-2xl font-light mb-1">{t('admin.requestsTitle')}</h2>
        <p className="text-sm text-gray-600 mb-6">{t('admin.requestsCount', { n: bookings.length })}</p>
        {bookings.length === 0 ? (
          <p className="text-sm text-gray-500">{t('admin.noRequests')}</p>
        ) : (
          <div className="space-y-1">
            {bookings.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between py-2 px-3 rounded-xl hover:bg-white/30 transition-colors"
              >
                <span className="text-sm font-normal">
                  {b.requester_name} → {b.mentor_name ?? '—'}
                </span>
                <span className="text-xs px-2 py-1 rounded-full bg-gray-900/10 capitalize">
                  {b.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </motion.div>
  )
}
