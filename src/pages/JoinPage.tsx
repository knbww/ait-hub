import { motion } from 'framer-motion'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { GraduationCap, Trophy, Users } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { cardVariants, pageVariants } from '../lib/animations'
import { useI18n } from '../context/i18nContext'
import type { Lang } from '../lib/messages'

const STEPS = [
  { icon: Users, titleKey: 'join.what.title', textKey: 'join.what.text' },
  { icon: GraduationCap, titleKey: 'join.how.title', textKey: 'join.how.text' },
  { icon: Trophy, titleKey: 'join.why.title', textKey: 'join.why.text' },
]

export function JoinPage() {
  const navigate = useNavigate()
  const { t, lang, setLang } = useI18n()
  const [params] = useSearchParams()
  const invited = Boolean(params.get('ref'))

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="max-w-2xl mx-auto"
    >
      <motion.div variants={cardVariants}>
        <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)] text-center">
          {/* Language toggle — visitors on /join are logged out, so the in-app
              settings switch isn't reachable; offer EN/RU right here. */}
          <div className="flex justify-end mb-2">
            <div className="inline-flex gap-1 rounded-full border border-white/50 bg-white/20 p-1">
              {(['en', 'ru'] as Lang[]).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  aria-pressed={lang === l}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    lang === l ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-white/40'
                  }`}
                >
                  {l === 'en' ? 'EN' : 'RU'}
                </button>
              ))}
            </div>
          </div>
          {invited && (
            <span className="inline-block mb-4 text-xs px-3 py-1 rounded-full bg-[#750014]/10 text-[#750014]">
              {t('join.invited')}
            </span>
          )}
          <h2 className="text-4xl font-light mb-3">
            {t('join.welcome')} <span className="font-bold">AIT&nbsp;Hub</span>
          </h2>
          <p className="text-gray-700 mb-8">{t('join.intro')}</p>

          <div className="grid sm:grid-cols-3 gap-4 mb-8 text-left">
            {STEPS.map((s) => (
              <div key={s.titleKey} className="p-4 rounded-2xl border border-white/50 bg-white/20">
                <s.icon className="w-6 h-6 mb-2" />
                <h3 className="font-normal mb-1">{t(s.titleKey)}</h3>
                <p className="text-xs text-gray-600">{t(s.textKey)}</p>
              </div>
            ))}
          </div>

          <button
            onClick={() => navigate('/login')}
            className="px-8 py-3 rounded-full bg-gray-900 text-white font-normal hover:scale-105 hover:shadow-lg transition-all duration-300"
          >
            {t('join.cta')}
          </button>
        </GlassCard>
      </motion.div>
    </motion.div>
  )
}
