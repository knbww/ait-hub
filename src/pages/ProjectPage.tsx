import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CircleCheck, Pencil, UserPlus } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { LinkifiedText } from '../components/LinkifiedText'
import { DataState, ErrorText } from '../components/DataState'
import { Avatar } from '../components/Avatar'
import { ProjectForm } from '../components/ProjectForm'
import { TrackBadge } from '../components/TrackBadge'
import { pageVariants } from '../lib/animations'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useMembers } from '../hooks/useClub'
import { useProject } from '../hooks/useTeams'
import { addProjectMember, confirmContribution, removeProjectMember, updateContribution } from '../lib/projectActions'
import { formatDay } from '../lib/club'
import type { ProjectMemberRow, ProjectRow } from '../lib/db'
import { btnPrimary, btnSecondary, btnSmall, chip, inputClass, labelClass, pageTitle, sectionTitle } from '../lib/ui'

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-medium text-gray-600">{label}</p>
      <LinkifiedText text={value} className="text-sm" />
    </div>
  )
}

function MemberRow({ project, member, canEdit }: { project: ProjectRow; member: ProjectMemberRow; canEdit: boolean }) {
  const { t } = useI18n()
  const { profile, isOversight, role } = useAuth()
  const isMe = member.profile_id === profile?.id
  // A member's contribution is confirmed by staff of *their* track (or director / curator).
  const canConfirm = !isMe && (isOversight || (role === 'track_lead' && member.profile?.track_id === profile?.track_id))
  const [editing, setEditing] = useState(false)
  const [roleText, setRoleText] = useState(member.role ?? '')
  const [contribution, setContribution] = useState(member.contribution ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)

  const act = async (fn: () => Promise<{ error: unknown }>, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(true)
    setError(null)
    const res = await fn()
    setBusy(false)
    if (res.error) setError(res.error)
    else setEditing(false)
  }

  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <Avatar path={member.profile?.avatar_path} name={member.profile?.full_name ?? ''} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link to={`/members/${member.profile_id}`} className="text-sm hover:underline">{member.profile?.full_name}</Link>
            <TrackBadge track={member.profile?.track_id} />
            {member.role && <span className="text-xs text-gray-600">{member.role}</span>}
            {member.profile_id === project.owner_id && <span className={`${chip} bg-gray-900/5`}>{t('project.owner')}</span>}
          </div>
          {editing ? (
            <div className="space-y-2 mt-2">
              <input className={inputClass} value={roleText} onChange={(e) => setRoleText(e.target.value)} placeholder={t('project.rolePlaceholder')} maxLength={80} />
              <textarea className={inputClass} rows={3} value={contribution} onChange={(e) => setContribution(e.target.value)}
                placeholder={t('project.contributionPlaceholder')} maxLength={1000} />
              <p className="text-xs text-gray-600">{t('project.contributionHint')}</p>
              <div className="flex gap-2">
                <button disabled={busy} onClick={() => act(() => updateContribution(project.id, member.profile_id, roleText, contribution))} className={btnPrimary}>
                  {t('common.save')}
                </button>
                <button onClick={() => setEditing(false)} className={btnSecondary}>{t('common.cancel')}</button>
              </div>
            </div>
          ) : (
            <>
              {member.contribution ? (
                <p className="text-sm mt-1 whitespace-pre-wrap">{member.contribution}</p>
              ) : (
                <p className="text-sm mt-1 text-gray-500">{t('project.noContribution')}</p>
              )}
              {member.confirmed_at && (
                <p className="text-xs text-green-800 inline-flex items-center gap-1 mt-1">
                  <CircleCheck className="w-3 h-3" /> {t('project.confirmed', { name: member.confirmer?.full_name ?? '' })}
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-2">
                {isMe && <button onClick={() => setEditing(true)} className={`${btnSmall} border border-gray-900/30`}>{t('project.editContribution')}</button>}
                {canConfirm && member.contribution && !member.confirmed_at && (
                  <button disabled={busy} onClick={() => act(() => confirmContribution(project.id, member.profile_id))}
                    className={`${btnSmall} bg-gray-900 text-white`}>{t('project.confirm')}</button>
                )}
                {(isMe || canEdit) && member.profile_id !== project.owner_id && (
                  <button disabled={busy} onClick={() => act(() => removeProjectMember(project.id, member.profile_id), t('project.removeConfirm'))}
                    className="text-xs text-red-700 px-2 py-1">{isMe ? t('project.leave') : t('project.remove')}</button>
                )}
              </div>
            </>
          )}
          <ErrorText error={error} />
        </div>
      </div>
    </li>
  )
}

function AddMember({ project }: { project: ProjectRow }) {
  const { t } = useI18n()
  const members = useMembers()
  const [profileId, setProfileId] = useState('')
  const [error, setError] = useState<unknown>(null)
  const inProject = new Set((project.project_members ?? []).map((m) => m.profile_id))
  const options = (members.data ?? []).filter((m) => m.status === 'active' && !inProject.has(m.id))

  const add = async () => {
    const res = await addProjectMember(project.id, profileId)
    setError(res.error)
    if (!res.error) setProfileId('')
  }

  return (
    <div className="mt-3">
      <label className={labelClass}>{t('project.addMember')}</label>
      <div className="flex gap-2">
        <select className={inputClass} value={profileId} onChange={(e) => setProfileId(e.target.value)}>
          <option value="">{t('project.pickMember')}</option>
          {options.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
        </select>
        <button onClick={add} disabled={!profileId} className={btnSecondary} aria-label={t('project.addMember')}>
          <UserPlus className="w-4 h-4" />
        </button>
      </div>
      <ErrorText error={error} />
    </div>
  )
}

export function ProjectPage() {
  const { id } = useParams()
  const { t } = useI18n()
  const { profile, isOversight, role } = useAuth()
  const project = useProject(id)
  const [editing, setEditing] = useState(false)
  const p = project.data

  const memberTracks = new Set((p?.project_members ?? []).map((m) => m.profile?.track_id))
  const canEdit = Boolean(p && (p.owner_id === profile?.id || isOversight || (role === 'track_lead' && memberTracks.has(profile?.track_id ?? null))))

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="max-w-3xl mx-auto space-y-4">
      <Link to="/projects" className="inline-flex items-center gap-1 text-sm text-gray-700 px-1"><ArrowLeft className="w-4 h-4" /> {t('projects.title')}</Link>
      <DataState isLoading={project.isLoading} error={project.error} onRetry={() => void project.refetch()}
        empty={!p} emptyText={<GlassCard><p className="text-sm">{t('project.notFound')}</p></GlassCard>}>
        {p && (
          editing ? (
            <GlassCard><ProjectForm project={p} onDone={() => setEditing(false)} /></GlassCard>
          ) : (
            <>
              <GlassCard>
                <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                  <div>
                    <h1 className={pageTitle}>{p.title}</h1>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <span className={`${chip} bg-gray-900/5 text-gray-700`}>{t(`project.status.${p.status}`)}</span>
                      {p.team && <span className="text-xs text-gray-600">{t('project.team', { name: p.team.name })}</span>}
                      {(p.starts_on || p.ends_on) && (
                        <span className="text-xs text-gray-600">
                          {p.starts_on ? formatDay(p.starts_on) : '…'} – {p.ends_on ? formatDay(p.ends_on) : '…'}
                        </span>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <button onClick={() => setEditing(true)} className={btnSecondary}><Pencil className="w-4 h-4" /> {t('common.edit')}</button>
                  )}
                </div>
                <div className="space-y-3">
                  <Field label={t('project.field.problem')} value={p.problem} />
                  <Field label={t('project.field.target_user')} value={p.target_user} />
                  <Field label={t('project.field.scope')} value={p.scope} />
                  <Field label={t('project.field.roles')} value={p.roles} />
                  <Field label={t('project.field.verification')} value={p.verification} />
                  <Field label={t('project.field.demo')} value={p.demo} />
                  <Field label={t('project.field.links')} value={p.links} />
                </div>
              </GlassCard>
              <GlassCard>
                <h2 className={sectionTitle}>{t('project.membersTitle')}</h2>
                <ul className="divide-y divide-white/50">
                  {(p.project_members ?? []).map((m) => (
                    <MemberRow key={m.profile_id} project={p} member={m} canEdit={canEdit} />
                  ))}
                </ul>
                {canEdit && <AddMember project={p} />}
              </GlassCard>
            </>
          )
        )}
      </DataState>
    </motion.div>
  )
}
