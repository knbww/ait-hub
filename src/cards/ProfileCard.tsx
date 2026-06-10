import { Settings } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { GlassCard } from '../components/GlassCard'
import { badges } from '../data/mock'
import { useAuth } from '../context/authContext'

export function ProfileCard() {
  const navigate = useNavigate()
  const { session, profile, role } = useAuth()

  if (!session) {
    return (
      <div className="relative">
        <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)] transition-all duration-300 ease-out">
          <h2 className="text-2xl font-light mb-4">Member Profile</h2>
          <p className="text-sm text-gray-600 mb-4">Sign in to see your profile and achievements.</p>
          <button
            onClick={() => navigate('/login')}
            className="px-4 py-2 border border-gray-900 rounded-lg text-sm hover:bg-gray-900 hover:text-white transition-all duration-300"
          >
            Sign in
          </button>
        </GlassCard>
      </div>
    )
  }

  const displayName = profile?.full_name ?? session.user.email ?? 'Member'

  return (
    <div className="relative">
      <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)] transition-all duration-300 ease-out">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-light">Member Profile</h2>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : null}
            </div>
            <div>
              <p className="font-normal">{displayName}</p>
              <p className="text-gray-600 font-light text-sm capitalize">{role}</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/profile')}
            title="Account settings"
            className="hover:scale-125 hover:rotate-12 transition-all duration-300"
          >
            <Settings className="w-6 h-6" />
          </button>
        </div>

        <div>
          <p className="text-xs font-normal text-gray-600 mb-2">Achievements</p>
          <div className="flex flex-wrap gap-2">
            {badges.map((badge, idx) => (
              <div
                key={idx}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#750014] text-white text-xs font-normal shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer"
              >
                <span>{badge.icon}</span>
                <span>{badge.label}</span>
              </div>
            ))}
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
