import { Target } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { useActivity } from '../hooks/useActivity'
import { useAuth } from '../context/authContext'

function intensityClass(ratio: number): string {
  if (ratio > 0.7) return 'bg-green-600'
  if (ratio > 0.4) return 'bg-green-400'
  if (ratio > 0.2) return 'bg-green-200'
  return 'bg-gray-200'
}

export function ActivityHeatmapCard() {
  const { profile } = useAuth()
  const { data: counts = [] } = useActivity(profile?.id)
  const max = Math.max(...counts, 1)
  const total = counts.reduce((sum, c) => sum + c, 0)

  return (
    <div className="relative">
      <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5" />
          <h3 className="text-lg font-light">Activity Heatmap</h3>
        </div>
        <div className="grid grid-cols-12 gap-2">
          {counts.map((count, idx) => (
            <div
              key={idx}
              className={`aspect-square rounded ${intensityClass(count / max)} hover:scale-125 transition-all duration-200 cursor-pointer`}
            ></div>
          ))}
        </div>
        <p className="text-xs text-gray-600 mt-3">{total} contributions in the last 3 months</p>
      </GlassCard>
    </div>
  )
}
