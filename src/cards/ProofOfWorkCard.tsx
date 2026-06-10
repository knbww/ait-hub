import { TrendingUp } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { useProofOfWork } from '../hooks/useProofOfWork'
import { useAuth } from '../context/authContext'

export function ProofOfWorkCard() {
  const { profile } = useAuth()
  const { data: proofOfWork = [] } = useProofOfWork(profile?.id)

  return (
    <GlassCard className="shadow-lg">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="w-6 h-6" />
        <h2 className="text-2xl font-light">Proof of Work</h2>
      </div>
      <div className="relative border-l-2 border-[#750014]/30 ml-2 space-y-6">
        {proofOfWork.map((item, i) => (
          <div key={i} className="relative pl-6">
            <div
              className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full ${
                item.status === 'completed' ? 'bg-[#750014]' : 'bg-gray-300 border-2 border-white'
              }`}
            />
            <p className="text-xs font-bold text-[#750014] uppercase tracking-tighter">{item.date}</p>
            <p className="text-sm font-normal text-gray-800">{item.task}</p>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}
