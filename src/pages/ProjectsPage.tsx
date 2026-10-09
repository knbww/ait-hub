import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { DataState } from '../components/DataState'
import { Modal } from '../components/Modal'
import { ProjectForm } from '../components/ProjectForm'
import { TrackBadge } from '../components/TrackBadge'
import { pageVariants } from '../lib/animations'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'
import { useProjects } from '../hooks/useTeams'
import type { ProjectRow, TrackId } from '../lib/db'
import { btnPrimary, chip, pageTitle, segment } from '../lib/ui'

type Filter = 'all' | 'mine' | 'track'

const tracksOf = (p: ProjectRow) =>
  [...new Set((p.project_members ?? []).map((m) => m.profile?.track_id).filter(Boolean))] as TrackId[]

export function ProjectsPage() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const projects = useProjects()
  const [filter, setFilter] = useState<Filter>('all')
  const [creating, setCreating] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  const list = (projects.data ?? [])
    .filter((p) => showArchived || p.status !== 'archived')
    .filter((p) => {
      if (filter === 'mine') return p.project_members?.some((m) => m.profile_id === profile?.id)
      if (filter === 'track') return tracksOf(p).includes(profile?.track_id as TrackId)
      return true
    })

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit" className="max-w-4xl mx-auto space-y-4">
      <GlassCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className={pageTitle}>{t('projects.title')}</h1>
          <button onClick={() => setCreating(true)} className={btnPrimary}><Plus className="w-4 h-4" /> {t('projects.new')}</button>
        </div>
        <p className="text-sm text-gray-700 mt-1 mb-3">{t('projects.intro')}</p>
        <div className="flex flex-wrap gap-2 items-center">
          {(['all', 'track', 'mine'] as Filter[])
            .filter((f) => f !== 'track' || profile?.track_id)
            .map((f) => (
              <button key={f} className={segment(filter === f)} onClick={() => setFilter(f)}>{t(`projects.filter.${f}`)}</button>
            ))}
          <label className="flex items-center gap-2 text-sm ml-1">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            {t('projects.showArchived')}
          </label>
        </div>
      </GlassCard>

      <DataState isLoading={projects.isLoading} error={projects.error} onRetry={() => void projects.refetch()}
        empty={list.length === 0} emptyText={<GlassCard><p className="text-sm text-gray-700">{t('projects.empty')}</p></GlassCard>}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {list.map((p) => (
            <Link key={p.id} to={`/projects/${p.id}`} className="block">
              <GlassCard className="h-full hover:bg-white/40 transition-colors">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h2 className="text-lg font-normal">{p.title}</h2>
                  <span className={`${chip} bg-gray-900/5 text-gray-700`}>{t(`project.status.${p.status}`)}</span>
                </div>
                <p className="text-sm text-gray-700 line-clamp-3 mb-2">{p.problem}</p>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
                  {tracksOf(p).map((tr) => <TrackBadge key={tr} track={tr} />)}
                  <span>{t('projects.members', { n: p.project_members?.length ?? 0 })}</span>
                  {p.team && <span>· {p.team.name}</span>}
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      </DataState>

      {creating && (
        <Modal title={t('projects.new')} onClose={() => setCreating(false)} wide>
          <ProjectForm onDone={(id) => { setCreating(false); if (id) navigate(`/projects/${id}`) }} />
        </Modal>
      )}
    </motion.div>
  )
}
