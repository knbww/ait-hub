import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Download, ExternalLink, KeyRound, Trash2 } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { DataState, ErrorText } from '../components/DataState'
import { Avatar } from '../components/Avatar'
import { TrackBadge } from '../components/TrackBadge'
import { pageVariants } from '../lib/animations'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useMember } from '../hooks/useClub'
import { useMemberPrivate } from '../hooks/useManage'
import { usePointsJournal, usePointsTotal } from '../hooks/usePoints'
import { useRatingHistory } from '../hooks/useEvents'
import { useProjects, useTeams } from '../hooks/useTeams'
import { useMySubmissions } from '../hooks/useProgram'
import {
  adminSetPassword, deleteMember, exportMemberData, setMemberRole, setMemberStatus, setMemberTrack,
} from '../lib/memberActions'
import { downloadJson, stampedName } from '../lib/download'
import { TRACK_IDS, formatDate } from '../lib/club'
import type { ProfileRow, Role, TrackId } from '../lib/db'
import { btnDanger, btnSecondary, chip, inputClass, labelClass, pageTitle, sectionTitle } from '../lib/ui'

const ROLES: Role[] = ['member', 'track_lead', 'director', 'curator']

function ManagePanel({ member }: { member: ProfileRow }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { isDirector } = useAuth()
  const priv = useMemberPrivate(member.id)
  const works = useMySubmissions(member.id)
  const journal = usePointsJournal(member.id, true, 50)
  const [role, setRole] = useState<Role>(member.role)
  const [track, setTrack] = useState<TrackId | ''>(member.track_id ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const run = async (fn: () => Promise<{ error: unknown }>, ok?: string) => {
    setBusy(true)
    setError(null)
    setNotice(null)
    const res = await fn()
    setBusy(false)
    if (res.error) return setError(res.error)
    if (ok) setNotice(ok)
  }

  const resetPassword = () => {
    const password = window.prompt(t('member.manage.passwordPrompt'))
    if (password === null) return
    void run(() => adminSetPassword(member.id, password), t('member.manage.passwordDone'))
  }

  const remove = async () => {
    const typed = window.prompt(t('member.manage.deletePrompt', { name: member.full_name }))
    if (typed === null) return
    if (typed.trim() !== member.full_name) return setError('confirm_mismatch')
    setBusy(true)
    const res = await deleteMember(member.id, member.user_id)
    setBusy(false)
    if (res.error) return setError(res.error)
    window.alert(res.data?.auth_deleted ? t('member.manage.deleted') : t('member.manage.deletedNoLogin'))
    navigate('/manage', { replace: true })
  }

  const download = async () => {
    const res = await exportMemberData(member.id)
    if (res.error) return setError(res.error)
    downloadJson(stampedName(`ait-hub-member-${member.id.slice(0, 8)}`, 'json'), res.data)
  }

  const submitted = [...(works.data?.values() ?? [])]
  return (
    <GlassCard className="!border-[#750014]/30">
      <h2 className={sectionTitle}>{t('member.manage.title')}</h2>
      <p className="text-xs text-gray-600 mb-3">{t('member.manage.hint')}</p>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
        <div>
          <dt className="text-xs text-gray-600">{t('join.form.email')}</dt>
          <dd className="break-all">{priv.data?.email ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-600">{t('join.form.telegram')}</dt>
          <dd>{priv.data?.telegram ? `@${priv.data.telegram}` : '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-600">{t('member.manage.works')}</dt>
          <dd>{t('member.manage.worksCount', {
            total: submitted.length,
            accepted: submitted.filter((s) => s.status === 'accepted').length,
          })}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-600">{t('member.manage.photo')}</dt>
          <dd>{priv.data?.photo_consent == null ? '—' : t(priv.data.photo_consent ? 'common.yes' : 'common.no')}</dd>
        </div>
      </dl>

      {isDirector && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className={labelClass}>{t('member.manage.role')}</label>
            <div className="flex gap-2">
              <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {ROLES.map((r) => <option key={r} value={r}>{t(`role.${r}`)}</option>)}
              </select>
              <button disabled={busy || role === member.role} onClick={() => run(() => setMemberRole(member.id, role), t('common.saved'))}
                className={btnSecondary}>{t('common.save')}</button>
            </div>
          </div>
          <div>
            <label className={labelClass}>{t('member.manage.track')}</label>
            <div className="flex gap-2">
              <select className={inputClass} value={track} onChange={(e) => setTrack(e.target.value as TrackId | '')}>
                <option value="">—</option>
                {TRACK_IDS.map((id) => <option key={id} value={id}>{t(`track.${id}`)}</option>)}
              </select>
              <button disabled={busy || track === (member.track_id ?? '')}
                onClick={() => run(() => setMemberTrack(member.id, track || null), t('common.saved'))} className={btnSecondary}>
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button onClick={download} className={btnSecondary}><Download className="w-4 h-4" /> {t('member.manage.download')}</button>
        <button disabled={busy}
          onClick={() => run(() => setMemberStatus(member.id, member.status === 'active' ? 'inactive' : 'active'), t('common.saved'))}
          className={btnSecondary}>
          {member.status === 'active' ? t('member.manage.deactivate') : t('member.manage.activate')}
        </button>
        {isDirector && (
          <>
            <button disabled={busy} onClick={resetPassword} className={btnSecondary}><KeyRound className="w-4 h-4" /> {t('member.manage.password')}</button>
            <button disabled={busy} onClick={remove} className={btnDanger}><Trash2 className="w-4 h-4" /> {t('member.manage.delete')}</button>
          </>
        )}
      </div>
      {error === 'confirm_mismatch' ? <p className="text-sm text-red-700 mt-2">{t('member.manage.confirmMismatch')}</p> : <ErrorText error={error} />}
      {notice && <p className="text-sm text-green-800 mt-2">{notice}</p>}

      <h3 className="text-sm font-medium mt-5 mb-1">{t('member.manage.journal')}</h3>
      <DataState isLoading={journal.isLoading} error={journal.error} onRetry={() => void journal.refetch()}
        empty={(journal.data ?? []).length === 0} emptyText={t('points.noEntries')}>
        <ul className="divide-y divide-white/50 text-sm">
          {(journal.data ?? []).map((e) => (
            <li key={e.id} className="py-2 flex justify-between gap-3">
              <span className="min-w-0">
                <span className="block break-words">{e.note}</span>
                <span className="block text-xs text-gray-600">
                  {t(`points.category.${e.category}`)} · {formatDate(e.created_at)}
                  {e.awarder && ` · ${t('points.confirmedBy', { name: e.awarder.full_name })}`}
                </span>
              </span>
              <span className={e.amount >= 0 ? 'text-green-800' : 'text-red-700'}>{e.amount > 0 ? `+${e.amount}` : e.amount}</span>
            </li>
          ))}
        </ul>
      </DataState>
    </GlassCard>
  )
}

export function MemberPage() {
  const { id } = useParams()
  const { t } = useI18n()
  const { profile: me, isOversight, role } = useAuth()
  const member = useMember(id)
  const total = usePointsTotal(id)
  const history = useRatingHistory(id)
  const teams = useTeams()
  const projects = useProjects()
  const m = member.data

  const canManage = Boolean(
    m && m.id !== me?.id && (isOversight || (role === 'track_lead' && m.role === 'member' && m.track_id === me?.track_id)),
  )
  const team = (teams.data ?? []).find((tm) => tm.team_members?.some((x) => x.profile_id === id))
  const memberProjects = (projects.data ?? []).filter((p) => p.project_members?.some((x) => x.profile_id === id))
  const ratings = TRACK_IDS.map((track) => {
    const rows = (history.data ?? []).filter((r) => r.event?.track_id === track)
    return { track, rating: rows.reduce((s, r) => s + r.rating_delta, 0), events: rows.length }
  }).filter((r) => r.events > 0)

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="max-w-3xl mx-auto space-y-4">
      <button onClick={() => window.history.back()} className="inline-flex items-center gap-1 text-sm text-gray-700 px-1">
        <ArrowLeft className="w-4 h-4" /> {t('common.back')}
      </button>
      <DataState isLoading={member.isLoading} error={member.error} onRetry={() => void member.refetch()}
        empty={!m} emptyText={<GlassCard><p className="text-sm">{t('member.notFound')}</p></GlassCard>}>
        {m && (
          <>
            <GlassCard>
              <div className="flex items-center gap-4">
                <Avatar path={m.avatar_path} name={m.full_name} size="lg" />
                <div className="min-w-0">
                  <h1 className={pageTitle}>{m.full_name}</h1>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-700">
                    {m.grade && <span>{t('common.gradeN', { n: m.grade })}</span>}
                    <TrackBadge track={m.track_id} short={false} />
                    {m.role !== 'member' && <span className={`${chip} bg-[#750014]/10 text-[#750014]`}>{t(`role.${m.role}`)}</span>}
                    {m.status === 'inactive' && <span className={`${chip} bg-gray-900/10`}>{t('member.inactive')}</span>}
                  </div>
                </div>
                {me?.id === m.id && <Link to="/profile" className="ml-auto text-sm underline">{t('common.edit')}</Link>}
              </div>
            </GlassCard>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <GlassCard>
                <p className="text-xs text-gray-600">AIT Points</p>
                <p className="text-4xl font-light">{total.data ?? 0}</p>
              </GlassCard>
              <GlassCard>
                <p className="text-xs text-gray-600 mb-1">{t('member.ratings')}</p>
                {ratings.length === 0 ? (
                  <p className="text-sm text-gray-700">{t('member.noRating')}</p>
                ) : (
                  <ul className="space-y-1">
                    {ratings.map((r) => (
                      <li key={r.track} className="flex items-center justify-between text-sm">
                        <TrackBadge track={r.track} />
                        <span>{t('member.ratingLine', { rating: r.rating, events: r.events })}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </GlassCard>
            </div>

            {(history.data ?? []).length > 0 && (
              <GlassCard>
                <h2 className={sectionTitle}>{t('member.results')}</h2>
                <ul className="divide-y divide-white/50 mt-2">
                  {history.data!.map((r) => (
                    <li key={r.id} className="py-2 flex items-center gap-3 text-sm">
                      <span className="flex-1 min-w-0 truncate">{r.event?.title}</span>
                      <span className="text-gray-600">{r.place ? t('member.place', { n: r.place }) : '—'}</span>
                      <span className="w-12 text-right font-medium">{r.rating_delta > 0 ? `+${r.rating_delta}` : r.rating_delta}</span>
                    </li>
                  ))}
                </ul>
              </GlassCard>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <GlassCard>
                <h2 className={sectionTitle}>{t('card.team')}</h2>
                {team ? (
                  <p className="text-sm mt-2">{team.name} · {t('teams.count', { n: team.team_members?.length ?? 0, max: 5 })}</p>
                ) : (
                  <p className="text-sm text-gray-700 mt-2">{t('member.noTeam')}</p>
                )}
              </GlassCard>
              <GlassCard>
                <h2 className={sectionTitle}>{t('card.projects')}</h2>
                {memberProjects.length === 0 ? (
                  <p className="text-sm text-gray-700 mt-2">{t('member.noProjects')}</p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {memberProjects.map((p) => (
                      <li key={p.id}><Link to={`/projects/${p.id}`} className="text-sm hover:underline">{p.title}</Link></li>
                    ))}
                  </ul>
                )}
              </GlassCard>
            </div>

            {(m.github_username || m.codeforces_handle) && (
              <GlassCard>
                <h2 className={sectionTitle}>{t('profile.connected')}</h2>
                <div className="flex flex-wrap gap-2 mt-2">
                  {m.github_username && (
                    <a href={`https://github.com/${m.github_username}`} target="_blank" rel="noreferrer" className={btnSecondary}>
                      <ExternalLink className="w-4 h-4" /> GitHub · {m.github_username}
                    </a>
                  )}
                  {m.codeforces_handle && (
                    <a href={`https://codeforces.com/profile/${m.codeforces_handle}`} target="_blank" rel="noreferrer" className={btnSecondary}>
                      <ExternalLink className="w-4 h-4" /> Codeforces · {m.codeforces_handle}
                    </a>
                  )}
                </div>
              </GlassCard>
            )}

            {canManage && <ManagePanel key={m.id + m.role + (m.track_id ?? '')} member={m} />}
          </>
        )}
      </DataState>
    </motion.div>
  )
}
