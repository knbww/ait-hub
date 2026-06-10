import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { skillNodes } from '../data/mock'
import type { SkillNode } from '../types'
import type { SkillRow } from '../lib/db-rows'

export function useSkills() {
  return useQuery<SkillNode[]>({
    queryKey: ['skills'],
    queryFn: async () => {
      if (!supabase) return skillNodes
      const { data, error } = await supabase
        .from('skills')
        .select('id, skill, level, category')
        .order('level', { ascending: false })
        .returns<SkillRow[]>()
      if (error) throw error
      return data.map((r) => ({ skill: r.skill, level: r.level, category: r.category ?? '' }))
    },
  })
}
