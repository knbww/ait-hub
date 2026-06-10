import { Award, Code, ExternalLink, Github, Linkedin } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { useProfileLinks } from '../hooks/useProfileLinks'
import { useAuth } from '../context/authContext'

export function WallOfProofCard() {
  const { profile } = useAuth()
  const { data: links } = useProfileLinks(profile?.id)

  const items = [
    { label: 'GitHub', href: links?.github_url ?? '#', Icon: Github },
    { label: 'LeetCode', href: links?.leetcode_url ?? '#', Icon: Code },
    { label: 'LinkedIn', href: links?.linkedin_url ?? '#', Icon: Linkedin },
  ]

  return (
    <div className="relative">
      <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-5 h-5" />
          <h3 className="text-lg font-light">Wall of Proof</h3>
        </div>
        <div className="space-y-3">
          {items.map(({ label, href, Icon }) => (
            <a
              key={label}
              href={href}
              target={href === '#' ? undefined : '_blank'}
              rel="noreferrer"
              className="flex items-center justify-between p-3 rounded-xl hover:bg-white/30 transition-all duration-300 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4" />
                <span className="text-sm font-normal">{label}</span>
              </div>
              <ExternalLink className="w-4 h-4" />
            </a>
          ))}
        </div>
      </GlassCard>
    </div>
  )
}
