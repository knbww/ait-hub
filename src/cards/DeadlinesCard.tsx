import { Calendar } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { deadlines } from '../data/mock'

export function DeadlinesCard() {
  return (
    <div className="relative">
      <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5" />
          <h3 className="text-lg font-light">Upcoming Deadlines</h3>
        </div>
        <div className="space-y-3">
          {deadlines.map((deadline, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl border border-white/30 hover:bg-white/20 transition-all duration-300"
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-normal">{deadline.event}</span>
                <span className="text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-700">
                  {deadline.daysLeft}d
                </span>
              </div>
              <p className="text-xs text-gray-600">{deadline.date}</p>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  )
}
