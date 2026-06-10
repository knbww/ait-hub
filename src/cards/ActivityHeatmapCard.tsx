import { Target } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'

const CELL_COUNT = 84

// Placeholder activity intensities, generated once at module load so the grid is
// stable across renders. Phase 1 replaces this with real per-day contribution data.
const HEATMAP_CELLS = Array.from({ length: CELL_COUNT }, () => Math.random())

function intensityClass(intensity: number): string {
  if (intensity > 0.7) return 'bg-green-600'
  if (intensity > 0.4) return 'bg-green-400'
  if (intensity > 0.2) return 'bg-green-200'
  return 'bg-gray-200'
}

export function ActivityHeatmapCard() {
  return (
    <div className="relative">
      <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5" />
          <h3 className="text-lg font-light">Activity Heatmap</h3>
        </div>
        <div className="grid grid-cols-12 gap-2">
          {HEATMAP_CELLS.map((intensity, idx) => (
            <div
              key={idx}
              className={`aspect-square rounded ${intensityClass(intensity)} hover:scale-125 transition-all duration-200 cursor-pointer`}
            ></div>
          ))}
        </div>
        <p className="text-xs text-gray-600 mt-3">42 contributions in the last 3 months</p>
      </GlassCard>
    </div>
  )
}
