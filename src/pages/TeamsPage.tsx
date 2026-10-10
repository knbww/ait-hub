import { useState } from 'react'
import type { FormEvent } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Crown, Plus } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { DataState, ErrorText } from '../components/DataState'
import { Avatar } from '../components/Avatar'
import { pageVariants } from '../lib/animations'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useTeamRequests, useTeams } from '../hooks/useTeams'
import {
  archiveTeam, createTeam, removeTeamMember, requestJoinTeam, respondJoinRequest, updateTeam,
} from '../lib/teamActions'
import { TRACK_IDS } from '../lib/club'
import type { TeamRequestRow, TeamRow, TrackId } from '../lib/db'
import { btnPrimary, btnSecondary, btnSmall, inputClass, labelClass, pageTitle, sectionTitle, segment } from '../lib/ui'

const TEAM_LIMIT = 5

function useAction() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const run = async (fn: () => Promise<{ error: unknown }>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return false
    setBusy(true)
    setError(null)
    const res = await fn()
    setBusy(false)
    setError(res.error)
    return !res.error
  }
  return { busy, error, run, setError }
}

function TeamForm({ team, onDone }: { team?: TeamRow; onDone: () => void }) {
  const { t } = useI18n()
  const [name, setName] = useState(team?.name ?? '')
  const [goal, setGoal] = useState(team?.goal ?? '')
  const { busy, error, run } = useAction()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const ok = await run(() => (team ? updateTeam(team.id, name, goal) : createTeam(name, goal)))
    if (ok) onDone()
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className={labelClass}>{t('teams.name')}</label>
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
      </div>
      <div>
        <label className={labelClass}>{t('teams.goal')}</label>
        <textarea className={inputClass} rows={2} value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={500} />
      </div>
      <ErrorText error={error} />
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={btnPrimary}>{team ? t('common.save') : t('teams.create')}</button>
        <button type="button" onClick={onDone} className={btnSecondary}>{t('common.cancel')}</button>
      </div>
    </form>
  )
}

function RequestRow({ request }: { request: TeamRequestRow }) {
  const { t } = useI18n()
  const { busy, error, run } = useAction()
  return (
    <li className="py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 text-sm">
          <Link to={`/members/${request.profile_id}`} className="hover:underline">{request.profile?.full_name}</Link>
          {request.note && <span className="block text-xs text-gray-600">«{request.note}»</span>}
        </span>
        <button disabled={busy} onClick={() => run(() => respondJoinRequest(request.id, true))} className={`${btnSmall} bg-gray-900 text-white`}>
          {t('teams.accept')}
        </button>
        <button disabled={busy} onClick={() => run(() => respondJoinRequest(request.id, false))} className={`${btnSmall} border border-gray-900/30`}>
          {t('teams.decline')}
        </button>
      </div>
      <ErrorText error={error} />
    </li>
  )
}

function TeamCardFull({ team, manage, mine, requests }: {
  team: TeamRow
  manage: boolean
  mine: boolean
  requests: TeamRequestRow[]
}) {
  const { t } = useI18n()
  const { profile } = useAuth()
  const [editing, setEditing] = useState(false)
  const { busy, error, run } = useAction()
  const members = team.team_members ?? []

  if (editing) {
    return (
      <GlassCard>
        <TeamForm team={team} onDone={() => setEditing(false)} />
      </GlassCard>
    )
  }

  return (
    <GlassCard>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
        <div>
          <h3 className="text-lg font-normal"><Link to={`/teams/${team.id}`} className="hover:underline">{team.name}</Link></h3>
          {team.goal && <p className="text-sm text-gray-700">{team.goal}</p>}
        </div>
        <span className="text-xs text-gray-600">{t('teams.count', { n: members.length, max: TEAM_LIMIT })}</span>
      </div>
      <ul className="space-y-1 mb-3">
        {members.map((m) => (
          <li key={m.profile_id} className="flex items-center gap-2 text-sm">
            <Avatar path={m.profile?.avatar_path} name={m.profile?.full_name ?? ''} size="sm" />
            <Link to={`/members/${m.profile_id}`} className="flex-1 truncate hover:underline">{m.profile?.full_name}</Link>
            {m.profile_id === team.captain_id && (
              <span className="inline-flex items-center gap-1 text-xs text-[#750014]"><Crown className="w-3 h-3" /> {t('teams.captain')}</span>
            )}
            {manage && m.profile_id !== profile?.id && (
              <button disabled={busy} onClick={() => run(() => removeTeamMember(team.id, m.profile_id), t('teams.removeConfirm'))}
                className="text-xs text-red-700 px-2 py-1">{t('teams.remove')}</button>
            )}
          </li>
        ))}
      </ul>
      {manage && requests.length > 0 && (
        <div className="mb-3">
          <p className="text-sm font-medium">{t('teams.requests')}</p>
          <ul className="divide-y divide-white/50">{requests.map((r) => <RequestRow key={r.id} request={r} />)}</ul>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {manage && <button onClick={() => setEditing(true)} className={`${btnSmall} border border-gray-900/30`}>{t('common.edit')}</button>}
        {mine && (
          <button disabled={busy} onClick={() => run(() => removeTeamMember(team.id, profile!.id), t('teams.leaveConfirm'))}
            className={`${btnSmall} border border-gray-900/30`}>{t('teams.leave')}</button>
        )}
        {manage && (
          <button disabled={busy} onClick={() => run(() => archiveTeam(team.id), t('teams.archiveConfirm'))}
            className={`${btnSmall} border border-red-600/50 text-red-700`}>{t('teams.archive')}</button>
        )}
      </div>
      <ErrorText error={error} />
    </GlassCard>
  )
}

function JoinButton({ team, pending }: { team: TeamRow; pending: boolean }) {
  const { t } = useI18n()
  const [note, setNote] = useState('')
  const [open, setOpen] = useState(false)
  const { busy, error, run } = useAction()
  const full = (team.team_members?.length ?? 0) >= TEAM_LIMIT

  if (pending) return <span className="text-xs text-gray-600">{t('teams.pending')}</span>
  if (full) return <span className="text-xs text-gray-600">{t('teams.full')}</span>
  if (!open) return <button onClick={() => setOpen(true)} className={`${btnSmall} border border-gray-900/30`}>{t('teams.ask')}</button>
  return (
    <div className="w-full space-y-2 mt-2">
      <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('teams.notePlaceholder')} maxLength={300} />
      <div className="flex gap-2">
        <button disabled={busy} onClick={async () => { if (await run(() => requestJoinTeam(team.id, note))) setOpen(false) }} className={btnPrimary}>
          {t('teams.send')}
        </button>
        <button onClick={() => setOpen(false)} className={btnSecondary}>{t('common.cancel')}</button>
      </div>
      <ErrorText error={error} />
    </div>
  )
}

export function TeamsPage() {
  const { t } = useI18n()
  const { profile, isStaff, isOversight, role } = useAuth()
  const teams = useTeams()
  const requests = useTeamRequests()
  const [creating, setCreating] = useState(false)
  const [filter, setFilter] = useState<TrackId>(profile?.track_id ?? 'ai')
  const track = isOversight ? filter : (profile?.track_id ?? null)

  const all = teams.data ?? []
  const myTeam = all.find((tm) => tm.team_members?.some((m) => m.profile_id === profile?.id))
  const trackTeams = all.filter((tm) => tm.track_id === track && tm.id !== myTeam?.id)
  const myPending = new Set((requests.data ?? []).filter((r) => r.profile_id === profile?.id).map((r) => r.team_id))
  const canManage = (tm: TeamRow) => tm.captain_id === profile?.id || isOversight || (role === 'track_lead' && tm.track_id === profile?.track_id)
  const requestsFor = (tm: TeamRow) => (requests.data ?? []).filter((r) => r.team_id === tm.id && r.profile_id !== profile?.id)

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="max-w-3xl mx-auto space-y-4">
      <GlassCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className={pageTitle}>{t('teams.title')}</h1>
          {!myTeam && !isStaff && profile?.track_id && !creating && (
            <button onClick={() => setCreating(true)} className={btnPrimary}><Plus className="w-4 h-4" /> {t('teams.create')}</button>
          )}
        </div>
        <p className="text-sm text-gray-700 mt-1">{t('teams.intro', { max: TEAM_LIMIT })}</p>
        {isOversight && (
          <div className="flex gap-2 mt-3 overflow-x-auto">
            {TRACK_IDS.map((id) => (
              <button key={id} className={segment(filter === id)} onClick={() => setFilter(id)}>{t(`track.${id}.short`)}</button>
            ))}
          </div>
        )}
      </GlassCard>

      {creating && (
        <GlassCard>
          <h2 className={`${sectionTitle} mb-3`}>{t('teams.new')}</h2>
          <TeamForm onDone={() => setCreating(false)} />
        </GlassCard>
      )}

      <DataState isLoading={teams.isLoading} error={teams.error} onRetry={() => void teams.refetch()}>
        {myTeam && (
          <>
            <h2 className="text-sm uppercase tracking-wider text-gray-600 px-1">{t('teams.mine')}</h2>
            <TeamCardFull team={myTeam} manage={canManage(myTeam)} mine requests={requestsFor(myTeam)} />
          </>
        )}
        {!track ? (
          <GlassCard><p className="text-sm text-gray-700">{t('week.noTrack')}</p></GlassCard>
        ) : (
          <>
            <h2 className="text-sm uppercase tracking-wider text-gray-600 px-1 pt-2">
              {t('teams.ofTrack', { track: t(`track.${track}`) })}
            </h2>
            {trackTeams.length === 0 ? (
              <GlassCard><p className="text-sm text-gray-700">{t('teams.none')}</p></GlassCard>
            ) : (
              trackTeams.map((tm) =>
                canManage(tm) ? (
                  <TeamCardFull key={tm.id} team={tm} manage mine={false} requests={requestsFor(tm)} />
                ) : (
                  <GlassCard key={tm.id}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="text-lg font-normal"><Link to={`/teams/${tm.id}`} className="hover:underline">{tm.name}</Link></h3>
                        {tm.goal && <p className="text-sm text-gray-700">{tm.goal}</p>}
                        <p className="text-xs text-gray-600 mt-1">
                          {tm.team_members?.map((m) => m.profile?.full_name).join(', ')} · {t('teams.count', { n: tm.team_members?.length ?? 0, max: TEAM_LIMIT })}
                        </p>
                      </div>
                      {!myTeam && !isStaff && <JoinButton team={tm} pending={myPending.has(tm.id)} />}
                    </div>
                  </GlassCard>
                ),
              )
            )}
          </>
        )}
      </DataState>
    </motion.div>
  )
}
