import { motion } from 'framer-motion'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Pencil, Sparkles } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { pageVariants } from '../lib/animations'
import { useI18n } from '../context/i18nContext'
import { useAuth } from '../context/authContext'
import { useMyProfile } from '../hooks/useMyProfile'
import { useMyAip } from '../hooks/useMyAip'
import { aipRank } from '../lib/aip'

function scoreColor(score: number): string {
  if (score >= 70) return 'text-green-700'
  if (score >= 40) return 'text-amber-700'
  return 'text-red-700'
}

/** Public, read-only view of any member's profile (profiles are public-read). */
export function MemberProfilePage() {
  const { id } = useParams()
  const { t } = useI18n()
  const { profile: me } = useAuth()
  const { data: profile, isLoading } = useMyProfile(id)
  const { data: aip = 0 } = useMyAip(id)

  const links = profile
    ? [
        { label: 'GitHub', url: profile.github_url },
        { label: 'LeetCode', url: profile.leetcode_url },
        { label: 'LinkedIn', url: profile.linkedin_url },
      ].filter((l) => l.url)
    : []

  const aiScore = profile?.ai_profile_score ?? null
  const rank = aipRank(aip, profile?.role)

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="max-w-md mx-auto space-y-4"
    >
      <Link to="/network" className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4" /> {t('member.back')}
      </Link>

      <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
        {isLoading ? (
          <p className="text-center text-gray-500 py-10">{t('common.loading')}</p>
        ) : !profile ? (
          <p className="text-center text-gray-500 py-10">{t('member.notFound')}</p>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 overflow-hidden shrink-0">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : null}
              </div>
              <div className="min-w-0">
                <p className="text-xl font-normal leading-tight">{profile.full_name}</p>
                <p className="text-xs text-[#750014]">{t(`roles.${profile.role}`)}</p>
                {profile.title && <p className="text-sm text-gray-600">{profile.title}</p>}
              </div>
              {me?.id === id && (
                <Link
                  to="/profile"
                  className="ml-auto px-3 py-1 rounded-lg border border-gray-900 text-xs inline-flex items-center gap-1.5 hover:bg-gray-900 hover:text-white transition-all duration-300"
                >
                  <Pencil className="w-3.5 h-3.5" /> {t('member.edit')}
                </Link>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/60 bg-white/30 px-4 py-3">
                <p className="text-xs text-gray-600">{t('profile.balance')}</p>
                <p className="text-3xl font-light leading-none">{aip}</p>
                <p className="text-xs text-[#750014] mt-1">{t(`rank.${rank.current}`)}</p>
              </div>
              <div className="rounded-2xl border border-white/60 bg-white/30 px-4 py-3">
                <p className="text-xs text-gray-600 flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-[#750014]" /> {t('profile.aiScoreTitle')}
                </p>
                <p className={`text-3xl font-light leading-none ${aiScore != null ? scoreColor(aiScore) : 'text-gray-400'}`}>
                  {aiScore != null ? aiScore : '—'}
                </p>
              </div>
            </div>
            {profile.ai_profile_summary && (
              <p className="text-xs text-gray-600 italic">«{profile.ai_profile_summary}»</p>
            )}

            {profile.bio && <p className="text-sm text-gray-700 whitespace-pre-wrap">{profile.bio}</p>}

            {(profile.university || profile.grad_year) && (
              <p className="text-sm text-gray-600">
                {profile.university}
                {profile.grad_year ? ` · ${profile.grad_year}` : ''}
              </p>
            )}

            {links.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {links.map((l) => (
                  <a
                    key={l.label}
                    href={l.url as string}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1 rounded-full bg-white/40 border border-white/60 text-xs inline-flex items-center gap-1 hover:bg-white/70 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" /> {l.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </GlassCard>
    </motion.div>
  )
}
