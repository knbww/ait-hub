import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { skillNodes } from '../data/mock'
import type { SkillNode } from '../types'
import type { SkillRow } from '../lib/db-rows'

/** A member's skills. Pass the current profile id to scope to the signed-in
 * user; with no id (logged out / not configured) it returns the mock preview. */
export function useSkills(profileId?: string) {
  return useQuery<SkillNode[]>({
    queryKey: ['skills', profileId ?? null],
    queryFn: async () => {
      if (!supabase || !profileId) return skillNodes
      const { data, error } = await supabase
        .from('skills')
        .select('id, skill, level, category')
        .eq('profile_id', profileId)
        .order('level', { ascending: false })
        .returns<SkillRow[]>()
      if (error) throw error
      return data.map((r) => ({ skill: r.skill, level: r.level, category: r.category ?? '' }))
    },
  })
}
