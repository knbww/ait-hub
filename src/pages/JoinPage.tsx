import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  GraduationCap, Rocket, Trophy, BadgeCheck, BookOpen, Users, Crown, Sparkles, ArrowRight,
} from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { ApplyModal } from '../components/ApplyModal'
import { cardVariants, pageVariants } from '../lib/animations'
import { useI18n } from '../context/i18nContext'
import type { Lang } from '../lib/messages'
import logo from '../assets/aitlogo.png'

const ACTIVITIES = [
  { icon: GraduationCap, t: 'join.do.academy.t', d: 'join.do.academy.d' },
  { icon: Rocket, t: 'join.do.studio.t', d: 'join.do.studio.d' },
  { icon: Trophy, t: 'join.do.arena.t', d: 'join.do.arena.d' },
  { icon: BadgeCheck, t: 'join.do.portfolio.t', d: 'join.do.portfolio.d' },
]

const PATH = [
  { icon: BookOpen, t: 'join.path.learn.t', d: 'join.path.learn.d' },
  { icon: Users, t: 'join.path.team.t', d: 'join.path.team.d' },
  { icon: Crown, t: 'join.path.lead.t', d: 'join.path.lead.d' },
]

const AIP = [
  { k: 'join.aip.attendance', v: '+10' },
  { k: 'join.aip.assignment', v: '+20' },
  { k: 'join.aip.help', v: '+15' },
  { k: 'join.aip.referral', v: '+40' },
]

const sectionCard = 'shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]'

export function JoinPage() {
  const navigate = useNavigate()
  const { t, lang, setLang } = useI18n()
  const [params] = useSearchParams()
  const invited = Boolean(params.get('ref'))
  const [applyOpen, setApplyOpen] = useState(false)

  const applyBtn = (
    <button
      onClick={() => setApplyOpen(true)}
      className="inline-flex items-center gap-2 px-7 py-3 rounded-full bg-gray-900 text-white font-normal hover:scale-105 hover:shadow-lg transition-all duration-300"
    >
      {t('join.apply')} <ArrowRight className="w-4 h-4" />
    </button>
  )

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="max-w-3xl mx-auto space-y-6"
    >
      {/* Hero */}
      <motion.div variants={cardVariants}>
        <GlassCard className={`${sectionCard} text-center relative`}>
          {/* Language toggle — visitors here are logged out, so the in-app settings switch
              isn't reachable; offer EN/RU right on the landing. */}
          <div className="absolute right-6 top-6 inline-flex gap-1 rounded-full border border-white/50 bg-white/20 p-1">
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

          <img
            src={logo}
            alt="AIT Club"
            className="h-16 w-auto mx-auto mb-4"
            style={{ mixBlendMode: 'multiply' }}
          />

          {invited && (
            <span className="inline-block mb-3 text-xs px-3 py-1 rounded-full bg-[#750014]/10 text-[#750014]">
              {t('join.invited')}
            </span>
          )}

          <h1 className="text-4xl sm:text-5xl font-bold mb-2">AIT&nbsp;Club</h1>
          <p className="text-[#750014] font-medium mb-3">{t('join.tagline')}</p>
          <p className="text-gray-700 max-w-xl mx-auto mb-6">{t('join.intro')}</p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {applyBtn}
            <button
              onClick={() => navigate('/login')}
              className="px-7 py-3 rounded-full border border-gray-900 font-normal hover:bg-gray-900 hover:text-white transition-all duration-300"
            >
              {t('join.signin')}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-4">{t('join.school')}</p>
        </GlassCard>
      </motion.div>

      {/* What you'll do */}
      <motion.div variants={cardVariants}>
        <GlassCard className={sectionCard}>
          <h2 className="text-lg font-light mb-4">{t('join.do.title')}</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {ACTIVITIES.map((a) => (
              <div key={a.t} className="flex gap-3 p-4 rounded-2xl border border-white/50 bg-white/20">
                <a.icon className="w-6 h-6 text-[#750014] shrink-0" />
                <div>
                  <h3 className="font-normal mb-0.5">{t(a.t)}</h3>
                  <p className="text-xs text-gray-600">{t(a.d)}</p>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </motion.div>

      {/* Your path */}
      <motion.div variants={cardVariants}>
        <GlassCard className={sectionCard}>
          <h2 className="text-lg font-light mb-4">{t('join.path.title')}</h2>
          <div className="grid sm:grid-cols-3 gap-3">
            {PATH.map((p, i) => (
              <div key={p.t} className="p-4 rounded-2xl border border-white/50 bg-white/20 text-center">
                <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-gray-900 text-white flex items-center justify-center">
                  <p.icon className="w-5 h-5" />
                </div>
                <h3 className="font-normal mb-0.5">
                  {i + 1}. {t(p.t)}
                </h3>
                <p className="text-xs text-gray-600">{t(p.d)}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      </motion.div>

      {/* AIP */}
      <motion.div variants={cardVariants}>
        <GlassCard className={sectionCard}>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-[#750014]" />
            <h2 className="text-lg font-light">{t('join.aip.title')}</h2>
          </div>
          <p className="text-sm text-gray-600 mb-4">{t('join.aip.sub')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {AIP.map((a) => (
              <div key={a.k} className="rounded-2xl border border-white/50 bg-white/20 px-3 py-3 text-center">
                <div className="text-xl font-light text-[#750014]">{a.v}</div>
                <div className="text-xs text-gray-500">{t(a.k)}</div>
              </div>
            ))}
          </div>
        </GlassCard>
      </motion.div>

      {/* Footer CTA */}
      <motion.div variants={cardVariants} className="text-center pb-4">
        {applyBtn}
        <p className="text-xs text-gray-500 mt-3">{t('join.ctaNote')}</p>
      </motion.div>

      {applyOpen && <ApplyModal onClose={() => setApplyOpen(false)} />}
    </motion.div>
  )
}
