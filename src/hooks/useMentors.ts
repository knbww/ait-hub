import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Mentor } from '../types'
import type { MentorRow } from '../lib/db-rows'

/** Community mentors (profiles with role 'mentor'). DB-only. */
export function useMentors() {
  return useQuery<Mentor[]>({
    queryKey: ['mentors'],
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, university, grad_year, title')
        .eq('role', 'mentor')
        .order('full_name', { ascending: true })
        .returns<MentorRow[]>()
      if (error) throw error
      return data.map((r) => ({
        id: r.id,
        name: r.full_name,
        university: r.university ?? '',
        year: r.grad_year ?? '',
        role: r.title ?? '',
      }))
    },
  })
}
