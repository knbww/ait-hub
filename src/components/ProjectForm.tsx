import { useState } from 'react'
import type { FormEvent } from 'react'
import { ErrorText } from './DataState'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useTeams } from '../hooks/useTeams'
import { createProject, updateProject } from '../lib/projectActions'
import type { ProjectInput } from '../lib/projectActions'
import type { ProjectRow, ProjectStatus } from '../lib/db'
import { btnPrimary, btnSecondary, inputClass, labelClass, segment } from '../lib/ui'

const STATUSES: ProjectStatus[] = ['idea', 'active', 'done', 'archived']

/** Create or edit a project: the problem, its user, scope, roles, dates, how it's checked and shown. */
export function ProjectForm({ project, onDone }: { project?: ProjectRow; onDone: (id?: string) => void }) {
  const { t } = useI18n()
  const { profile } = useAuth()
  const teams = useTeams()
  const [form, setForm] = useState<ProjectInput>({
    title: project?.title ?? '',
    problem: project?.problem ?? '',
    target_user: project?.target_user ?? '',
    scope: project?.scope ?? '',
    roles: project?.roles ?? '',
    starts_on: project?.starts_on ?? '',
    ends_on: project?.ends_on ?? '',
    verification: project?.verification ?? '',
    demo: project?.demo ?? '',
    links: project?.links ?? '',
    team_id: project?.team_id ?? null,
  })
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? 'active')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const myTeams = (teams.data ?? []).filter((tm) => tm.team_members?.some((m) => m.profile_id === profile?.id) || tm.id === project?.team_id)

  const set = (key: keyof ProjectInput) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    if (project) {
      const res = await updateProject(project.id, { ...form, status })
      setBusy(false)
      if (res.error) return setError(res.error)
      onDone(project.id)
    } else {
      const res = await createProject(form)
      setBusy(false)
      if (res.error) return setError(res.error)
      onDone(res.data ?? undefined)
    }
  }

  const area = (key: keyof ProjectInput, rows = 2, max = 2000) => (
    <div>
      <label className={labelClass}>{t(`project.field.${key}`)}</label>
      <textarea className={inputClass} rows={rows} value={(form[key] as string) ?? ''} onChange={set(key)} maxLength={max}
        placeholder={t(`project.hint.${key}`)} required={key === 'problem' || key === 'target_user'} />
    </div>
  )

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className={labelClass}>{t('project.field.title')}</label>
        <input className={inputClass} value={form.title} onChange={set('title')} required maxLength={120} />
      </div>
      {area('problem', 3)}
      {area('target_user', 2, 500)}
      {area('scope')}
      {area('roles', 2, 1000)}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>{t('project.field.starts_on')}</label>
          <input className={inputClass} type="date" value={form.starts_on} onChange={set('starts_on')} />
        </div>
        <div>
          <label className={labelClass}>{t('project.field.ends_on')}</label>
          <input className={inputClass} type="date" value={form.ends_on} onChange={set('ends_on')} />
        </div>
      </div>
      {area('verification', 2, 1000)}
      {area('demo', 2, 1000)}
      {area('links', 2, 1000)}
      {myTeams.length > 0 && (
        <div>
          <label className={labelClass}>{t('project.field.team')}</label>
          <select className={inputClass} value={form.team_id ?? ''} onChange={(e) => setForm((f) => ({ ...f, team_id: e.target.value || null }))}>
            <option value="">—</option>
            {myTeams.map((tm) => <option key={tm.id} value={tm.id}>{tm.name}</option>)}
          </select>
        </div>
      )}
      {project && (
        <div className="flex flex-wrap gap-2">
          {STATUSES.map((s) => (
            <button type="button" key={s} onClick={() => setStatus(s)} className={segment(status === s)}>{t(`project.status.${s}`)}</button>
          ))}
        </div>
      )}
      <ErrorText error={error} />
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={btnPrimary}>{project ? t('common.save') : t('projects.create')}</button>
        <button type="button" onClick={() => onDone()} className={btnSecondary}>{t('common.cancel')}</button>
      </div>
    </form>
  )
}
