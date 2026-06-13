import { motion } from 'framer-motion'
import { Database, FileText, Zap } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cardVariants, pageVariants } from '../lib/animations'
import { useResources } from '../hooks/useResources'
import { useI18n } from '../context/i18nContext'

const ICONS: Record<string, LucideIcon> = {
  zap: Zap,
  'file-text': FileText,
  database: Database,
}

export function ResourcesPage() {
  const { t } = useI18n()
  const { data: resources = [] } = useResources()

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="max-w-7xl mx-auto"
    >
      <div className="relative">
        <motion.div
          variants={cardVariants}
          className="backdrop-blur-[40px] bg-white/15 border-2 border-white/80 rounded-3xl p-8 shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]"
        >
          <div className="flex items-center gap-3 mb-6">
            <Database className="w-7 h-7" />
            <h2 className="text-3xl font-light">{t('resources.title')}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {resources.map((resource, idx) => {
              const Icon = ICONS[resource.icon] ?? Database
              return (
                <a
                  key={idx}
                  href={resource.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block p-5 rounded-2xl border-2 border-white/60 bg-white/10 hover:bg-white/20 transition-all duration-300 cursor-pointer"
                >
                  <Icon className="w-6 h-6 mb-3" />
                  <h4 className="font-normal mb-2">{resource.title}</h4>
                  <p className="text-sm text-gray-600">{resource.description}</p>
                </a>
              )
            })}
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
