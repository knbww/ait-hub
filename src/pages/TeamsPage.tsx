import { useState } from 'react'
import { motion } from 'framer-motion'
import { Users } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { cardVariants, pageVariants } from '../lib/animations'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useTeams } from '../hooks/useTeams'
import { useTeamRequests } from '../hooks/useTeamRequests'
import { useHelpRequests } from '../hooks/useHelpRequests'
import { createTeam, requestJoin, respondRequest } from '../lib/teamActions'
import { postHelp, claimHelp, confirmHelp } from '../lib/helpActions'
import type { Team, TeamRequest, HelpRequest } from '../types'

const inputClass =
  'w-full px-4 py-2 rounded-lg border border-white/60 bg-white/40 text-sm outline-none focus:border-gray-900 transition-colors'

const ROLES = ['build', 'growth', 'data'] as const

function CreateTeamForm() {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('')
  const [roles, setRoles] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const toggle = (r: string) =>
    setRoles((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]))

  const submit = async () => {
    if (!name.trim()) return
    setBusy(true)
    await createTeam(name.trim(), goal.trim(), roles)
    setBusy(false)
    setName('')
    setGoal('')
    setRoles([])
  }

  return (
    <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
      <h3 className="text-lg font-light mb-4">{t('teams.create')}</h3>
      <div className="space-y-3">
        <input
          className={inputClass}
          placeholder={t('teams.namePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className={inputClass}
          placeholder={t('teams.goalPlaceholder')}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        />
        <div>
          <p className="text-xs text-gray-600 mb-2">{t('teams.neededRoles')}</p>
          <div className="flex gap-2">
            {ROLES.map((r) => (
              <button
                key={r}
                onClick={() => toggle(r)}
                className={`px-3 py-1 rounded-full text-xs transition-colors ${
                  roles.includes(r)
                    ? 'bg-gray-900 text-white'
                    : 'border border-white/60 bg-white/30 hover:bg-white/60'
                }`}
              >
                {t(`teamRole.${r}`)}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={submit}
          disabled={busy}
          className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:scale-[1.02] transition-all duration-300 disabled:opacity-60"
        >
          {busy ? t('teams.creating') : t('teams.createBtn')}
        </button>
      </div>
    </GlassCard>
  )
}

function TeamCard({ team, myId, requests }: { team: Team; myId?: string; requests: TeamRequest[] }) {
  const { t } = useI18n()
  const isMember = team.members.some((m) => m.profileId === myId)
  const isFounder = team.founderId === myId
  const teamRequests = requests.filter((r) => r.teamId === team.id)

  const [role, setRole] = useState('build')
  const [note, setNote] = useState('')
  const [msg, setMsg] = useState<string | null>(null)

  const join = async () => {
    const { result, error } = await requestJoin(team.id, role, note.trim())
    setMsg(
      error ??
        (result === 'ok'
          ? t('teams.requestSent')
          : result === 'already_member'
            ? t('teams.alreadyMember')
            : result),
    )
  }

  return (
    <motion.div variants={cardVariants}>
      <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.15)]">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-xl font-normal">{team.name}</h3>
          <span className="text-xs px-2.5 py-1 rounded-full bg-gray-900/10 text-gray-600 shrink-0">
            {t(`teamStatus.${team.status}`)}
          </span>
        </div>
        {team.goal && <p className="text-sm text-gray-700 mb-3">{team.goal}</p>}

        {team.neededRoles.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {team.neededRoles.map((r) => (
              <span
                key={r}
                className="px-2.5 py-1 rounded-full bg-white/40 border border-white/60 text-xs"
              >
                {t(`teamRole.${r}`)}
              </span>
            ))}
          </div>
        )}

        <div className="space-y-1 mb-3">
          {team.members.map((m) => (
            <div key={m.profileId} className="flex items-center justify-between text-sm">
              <span>{m.name}</span>
              <span className="text-xs text-gray-500">{t(`teamRole.${m.role}`)}</span>
            </div>
          ))}
        </div>

        {isFounder && teamRequests.length > 0 && (
          <div className="pt-3 border-t border-white/40">
            <p className="text-xs text-gray-600 mb-2">{t('teams.requests')}</p>
            {teamRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 py-1.5">
                <span className="text-sm">
                  {r.name} <span className="text-xs text-gray-500">· {t(`teamRole.${r.role}`)}</span>
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => respondRequest(r.id, true)}
                    className="px-2.5 py-1 rounded-lg bg-green-700 text-white text-xs hover:scale-105 transition-all duration-300"
                  >
                    {t('teams.accept')}
                  </button>
                  <button
                    onClick={() => respondRequest(r.id, false)}
                    className="px-2.5 py-1 rounded-lg border border-gray-900 text-xs hover:bg-gray-900 hover:text-white transition-all duration-300"
                  >
                    {t('teams.decline')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {!isMember && myId && team.status === 'forming' && (
          <div className="pt-3 border-t border-white/40 space-y-2">
            <div className="flex gap-2">
              <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {t(`teamRole.${r}`)}
                  </option>
                ))}
              </select>
              <button
                onClick={join}
                className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:scale-[1.02] transition-all duration-300 whitespace-nowrap"
              >
                {t('teams.requestJoin')}
              </button>
            </div>
            <input
              className={inputClass}
              placeholder={t('teams.requestNote')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            {msg && <p className="text-xs text-gray-600">{msg}</p>}
          </div>
        )}
      </GlassCard>
    </motion.div>
  )
}

function HelpStatusChip({ status }: { status: string }) {
  const { t } = useI18n()
  const tone =
    status === 'open'
      ? 'bg-green-600/15 text-green-700'
      : status === 'claimed'
        ? 'bg-amber-500/20 text-amber-700'
        : 'bg-gray-900/10 text-gray-600'
  return <span className={`text-xs px-2.5 py-1 rounded-full ${tone}`}>{t(`help.${status}`)}</span>
}

function HelpForm() {
  const { t } = useI18n()
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!title.trim()) return
    setBusy(true)
    await postHelp(title.trim(), desc.trim())
    setBusy(false)
    setTitle('')
    setDesc('')
  }

  return (
    <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
      <h3 className="text-lg font-light mb-4">{t('help.ask')}</h3>
      <div className="space-y-3">
        <input
          className={inputClass}
          placeholder={t('help.titlePlaceholder')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className={inputClass}
          rows={2}
          placeholder={t('help.descPlaceholder')}
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
        <button
          onClick={submit}
          disabled={busy}
          className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:scale-[1.02] transition-all duration-300 disabled:opacity-60"
        >
          {busy ? t('help.posting') : t('help.post')}
        </button>
      </div>
    </GlassCard>
  )
}

function HelpCard({ help, myId }: { help: HelpRequest; myId?: string }) {
  const { t } = useI18n()
  const isMine = help.requesterId === myId
  return (
    <motion.div variants={cardVariants}>
      <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.15)]">
        <div className="flex items-start justify-between gap-3 mb-1">
          <h3 className="text-base font-normal">{help.title}</h3>
          <HelpStatusChip status={help.status} />
        </div>
        {help.description && <p className="text-sm text-gray-700 mb-2">{help.description}</p>}
        <p className="text-xs text-gray-500 mb-3">
          {t('help.by', { name: help.requesterName })}
          {help.helperName ? ` · ${t('help.helper', { name: help.helperName })}` : ''}
        </p>

        {help.status === 'open' && myId && !isMine && (
          <button
            onClick={() => claimHelp(help.id)}
            className="px-4 py-1.5 rounded-lg border border-gray-900 text-sm hover:bg-gray-900 hover:text-white transition-all duration-300"
          >
            {t('help.claim')}
          </button>
        )}
        {help.status === 'claimed' && isMine && (
          <button
            onClick={() => confirmHelp(help.id)}
            className="px-4 py-1.5 rounded-lg bg-green-700 text-white text-sm hover:scale-105 transition-all duration-300"
          >
            {t('help.confirm')}
          </button>
        )}
      </GlassCard>
    </motion.div>
  )
}

export function TeamsPage() {
  const { t } = useI18n()
  const { profile } = useAuth()
  const myId = profile?.id
  const [tab, setTab] = useState<'teams' | 'help'>('teams')
  const { data: teams = [] } = useTeams()
  const { data: requests = [] } = useTeamRequests()
  const { data: help = [] } = useHelpRequests()

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
      className="max-w-3xl mx-auto space-y-6"
    >
      <motion.div variants={cardVariants}>
        <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-7 h-7" />
            <h2 className="text-3xl font-light">{t('teams.title')}</h2>
          </div>
          <div className="flex gap-2">
            <button className={tabClass(tab === 'teams')} onClick={() => setTab('teams')}>
              {t('teams.tabTeams')}
            </button>
            <button className={tabClass(tab === 'help')} onClick={() => setTab('help')}>
              {t('teams.tabHelp')}
            </button>
          </div>
        </GlassCard>
      </motion.div>

      {tab === 'teams' ? (
        <>
          {myId && (
            <motion.div variants={cardVariants}>
              <CreateTeamForm />
            </motion.div>
          )}
          {teams.length === 0 ? (
            <p className="text-center text-gray-500 py-6">{t('teams.noTeams')}</p>
          ) : (
            teams.map((team) => (
              <TeamCard key={team.id} team={team} myId={myId} requests={requests} />
            ))
          )}
        </>
      ) : (
        <>
          {myId && (
            <motion.div variants={cardVariants}>
              <HelpForm />
            </motion.div>
          )}
          {help.length === 0 ? (
            <p className="text-center text-gray-500 py-6">{t('help.noRequests')}</p>
          ) : (
            help.map((h) => <HelpCard key={h.id} help={h} myId={myId} />)
          )}
        </>
      )}
    </motion.div>
  )
}
