import { TrendingUp } from 'lucide-react'
import { GlassCard } from '../components/GlassCard'
import { skillNodes } from '../data/mock'

export function SkillMatrixCard() {
  return (
    <div className="relative">
      <GlassCard className="shadow-[0_8px_32px_0_rgba(31,38,135,0.2)]">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-5 h-5" />
          <h3 className="text-lg font-light">Skill Matrix</h3>
        </div>
        <div className="space-y-3">
          {skillNodes.map((skill, idx) => (
            <div key={idx}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-normal">{skill.skill}</span>
                <span className="text-xs text-black-600">{skill.level}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-[#750014] h-1.5 rounded-full"
                  style={{ width: `${skill.level}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  )
}
