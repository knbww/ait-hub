import { Award, Code, ExternalLink, Github, Linkedin } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'

export function WallOfProofCard() {
  return (
    <div className="relative">
      <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-5 h-5" />
          <h3 className="text-lg font-light">Wall of Proof</h3>
        </div>
        <div className="space-y-3">
          <a
            href="#"
            className="flex items-center justify-between p-3 rounded-xl hover:bg-white/30 transition-all duration-300 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Github className="w-4 h-4" />
              <span className="text-sm font-normal">GitHub</span>
            </div>
            <ExternalLink className="w-4 h-4" />
          </a>
          <a
            href="#"
            className="flex items-center justify-between p-3 rounded-xl hover:bg-white/30 transition-all duration-300 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Code className="w-4 h-4" />
              <span className="text-sm font-normal">LeetCode</span>
            </div>
            <ExternalLink className="w-4 h-4" />
          </a>
          <a
            href="#"
            className="flex items-center justify-between p-3 rounded-xl hover:bg-white/30 transition-all duration-300 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Linkedin className="w-4 h-4" />
              <span className="text-sm font-normal">LinkedIn</span>
            </div>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </GlassCard>
    </div>
  )
}
