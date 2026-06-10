import { Settings } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { badges } from '../data/mock'

export function ProfileCard() {
  return (
    <div className="relative">
      <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)] transition-all duration-300 ease-out">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-light">Member Profile</h2>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-300 to-gray-400"></div>
            <div>
              <p className="font-normal">Anna</p>
              <p className="text-gray-600 font-light text-sm">Core Member</p>
            </div>
          </div>
          <button className="hover:scale-125 hover:rotate-12 transition-all duration-300">
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
