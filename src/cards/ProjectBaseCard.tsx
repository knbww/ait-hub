import { Folder } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'

export function ProjectBaseCard() {
  return (
    <div className="relative">
      <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)] transition-all duration-300 ease-out">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-light">Project Base</h2>
          <Folder className="w-6 h-6" />
        </div>

        <div className="space-y-4">
          <div>
            <p className="font-normal mb-2">Sample Project Title</p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-[#750014] h-1.5 rounded-full" style={{ width: '75%' }}></div>
            </div>
          </div>
          <div>
            <p className="font-normal mb-2">Sample Project Title</p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-[#750014] h-1.5 rounded-full" style={{ width: '40%' }}></div>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  )
}
