import { Github } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { useGithubStats } from '../hooks/useGithubStats'
import { useAuth } from '../context/authContext'

function relativeTime(iso: string | null): string {
  if (!iso) return 'no recent commits'
  const hours = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000)
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function ProjectPulseCard() {
  const { profile } = useAuth()
  const { data: stats } = useGithubStats(profile?.id)
  const series = stats?.series ?? []
  const max = Math.max(...series, 1)

  return (
    <GlassCard className="shadow-lg">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-light">Project Pulse</h2>
        <Github className="w-6 h-6" />
      </div>
      <div className="mb-4">
        <div className="flex justify-between text-xs mb-2">
          <span className="font-normal text-green-600">● {stats?.openPrs ?? 0} Open PRs</span>
          <span className="text-gray-500">Last commit: {relativeTime(stats?.lastCommitAt ?? null)}</span>
        </div>
        <div className="flex items-end gap-1 h-12 w-full bg-gray-100/50 rounded-lg p-2">
          {series.map((value, i) => (
            <div
              key={i}
              style={{ height: `${Math.round((value / max) * 100)}%` }}
              className="flex-1 bg-[#750014] rounded-t-sm"
            />
          ))}
        </div>
      </div>
    </GlassCard>
  )
}
