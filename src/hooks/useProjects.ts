import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { projects as mockProjects } from '../data/mock'
import type { Project } from '../types'
import type { ProjectRow } from '../lib/db-rows'

/** A member's projects. Scoped to the signed-in user; mock preview when logged out. */
export function useProjects(profileId?: string) {
  return useQuery<Project[]>({
    queryKey: ['projects', profileId ?? null],
    queryFn: async () => {
      if (!supabase || !profileId) return mockProjects
      const { data, error } = await supabase
        .from('projects')
        .select('id, title, progress')
        .eq('owner_id', profileId)
        .returns<ProjectRow[]>()
      if (error) throw error
      return data.map((r) => ({ title: r.title, progress: r.progress }))
    },
  })
}
