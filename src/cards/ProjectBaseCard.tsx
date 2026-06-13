import { Folder } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { useProjects } from '../hooks/useProjects'
import { useAuth } from '../context/authContext'
import { useI18n } from '../context/i18nContext'

export function ProjectBaseCard() {
  const { profile } = useAuth()
  const { t } = useI18n()
  const { data: projects = [] } = useProjects(profile?.id)

  return (
    <div className="relative">
      <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)] transition-all duration-300 ease-out">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-light">{t('card.projectBase')}</h2>
          <Folder className="w-6 h-6" />
        </div>

        {projects.length === 0 ? (
          <p className="text-sm text-gray-600">{t('common.empty')}</p>
        ) : (
          <div className="space-y-4">
            {projects.map((project, idx) => (
              <div key={idx}>
                <p className="font-normal mb-2">{project.title}</p>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-[#750014] h-1.5 rounded-full"
                    style={{ width: `${project.progress}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  )
}
