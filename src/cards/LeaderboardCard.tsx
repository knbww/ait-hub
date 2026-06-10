import { Crown } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { useLeaderboard } from '../hooks/useLeaderboard'

export function LeaderboardCard() {
  const { data: leaderboardData = [] } = useLeaderboard()

  return (
    <div className="relative">
      <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)] transition-all duration-300 ease-out">
        <div className="flex items-center gap-2 mb-6">
          <h2 className="text-2xl font-light">Leaderboard &amp; XP</h2>
          <Crown className="w-6 h-6" />
        </div>

        <div className="space-y-4">
          {leaderboardData.map((user, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-3 px-4 border-b border-gray-200/50 last:border-0 rounded-xl hover:bg-white/30 hover:shadow-[0_4px_16px_0_rgba(31,38,135,0.15)] hover:scale-[1.02] hover:-translate-y-1 transition-all duration-300 ease-out cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-xl">
                  {user.avatar}
                </div>
                <span className="font-normal">{user.name}</span>
              </div>
              <span className="font-medium text-lg">{user.xp}</span>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  )
}
