import { Link } from 'react-router-dom'
import { FolderKanban, Users } from 'lucide-react'
import { CardShell } from './CardShell'
import { DataState } from '../components/DataState'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useProjects, useTeams } from '../hooks/useTeams'
import { chip } from '../lib/ui'

export function TeamCard() {
  const { t } = useI18n()
  const { profile } = useAuth()
  const teams = useTeams()
  const mine = (teams.data ?? []).find((team) => team.team_members?.some((m) => m.profile_id === profile?.id))

  return (
    <CardShell icon={Users} title={t('card.team')} to="/teams" linkLabel={t('card.teams')}>
      <DataState isLoading={teams.isLoading} error={teams.error} onRetry={() => void teams.refetch()}
        empty={!mine} emptyText={t('team.none')}>
        {mine && (
          <div>
            <p className="text-base font-normal">{mine.name}</p>
            {mine.goal && <p className="text-sm text-gray-700 mb-2">{mine.goal}</p>}
            <p className="text-xs text-gray-600">
              {mine.team_members?.map((m) => m.profile?.full_name).filter(Boolean).join(', ')}
            </p>
          </div>
        )}
      </DataState>
    </CardShell>
  )
}

export function ProjectsCard() {
  const { t } = useI18n()
  const { profile } = useAuth()
  const projects = useProjects()
  const mine = (projects.data ?? []).filter(
    (p) => p.status !== 'archived' && p.project_members?.some((m) => m.profile_id === profile?.id),
  )

  return (
    <CardShell icon={FolderKanban} title={t('card.projects')} to="/projects" linkLabel={t('card.all')}>
      <DataState isLoading={projects.isLoading} error={projects.error} onRetry={() => void projects.refetch()}
        empty={mine.length === 0} emptyText={t('projects.mineEmpty')}>
        <ul className="space-y-2">
          {mine.slice(0, 4).map((p) => (
            <li key={p.id}>
              <Link to={`/projects/${p.id}`} className="flex items-center justify-between gap-2 p-3 rounded-2xl border border-white/50 bg-white/20 hover:bg-white/40">
                <span className="truncate text-sm">{p.title}</span>
                <span className={`${chip} bg-gray-900/5 text-gray-700`}>{t(`project.status.${p.status}`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </DataState>
    </CardShell>
  )
}
