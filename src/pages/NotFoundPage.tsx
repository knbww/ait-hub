import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { GlassCard } from '../components/GlassCard'
import { pageVariants } from '../lib/animations'
import { useI18n } from '../context/i18nContext'

export function NotFoundPage() {
  const navigate = useNavigate()
  const { t } = useI18n()

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="max-w-xl mx-auto"
    >
      <GlassCard className="text-center py-14 shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
        <motion.div
          animate={{ y: [0, -16, 0], rotate: [0, -6, 6, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          className="text-7xl mb-2 select-none"
        >
          🛸
        </motion.div>

        <div className="text-[7rem] leading-none font-black bg-gradient-to-r from-[#750014] via-purple-500 to-[#00B5AD] bg-clip-text text-transparent mb-4">
          404
        </div>

        <h2 className="text-2xl font-light mb-2">{t('notfound.heading')}</h2>
        <p className="text-gray-600 mb-8">{t('notfound.text')}</p>

        <button
          onClick={() => navigate('/')}
          className="px-8 py-3 rounded-full bg-gray-900 text-white font-normal hover:scale-105 hover:shadow-[0_4px_16px_0_rgba(0,0,0,0.25)] transition-all duration-300"
        >
          {t('notfound.home')}
        </button>
      </GlassCard>
    </motion.div>
  )
}
