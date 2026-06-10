import { Github } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'

const COMMIT_BARS = [40, 70, 45, 90, 65, 80, 95]

export function ProjectPulseCard() {
  return (
    <GlassCard className="shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-light">Project Pulse</h2>
        <Github className="w-6 h-6" />
      </div>
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-2">
          <span className="font-normal text-green-600">● 3 Open PRs</span>
          <span className="text-gray-500">Last commit: 2h ago</span>
        </div>
        <div className="flex items-end gap-1 h-12 w-full bg-gray-100/50 rounded-lg p-2">
          {COMMIT_BARS.map((h, i) => (
            <div key={i} style={{ height: `${h}%` }} className="flex-1 bg-[#750014] rounded-t-sm" />
          ))}
        </div>
      </div>
    </GlassCard>
  )
}
