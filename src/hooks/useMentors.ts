import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { alumni } from '../data/mock'
import type { Alumnus } from '../types'
import type { MentorRow } from '../lib/db-rows'

/** Community mentors (profiles with role 'mentor'). Global; falls back to the
 * mock roster if Supabase isn't configured or the query fails (e.g. migration
 * not yet applied), so the page never looks broken. */
export function useMentors() {
  return useQuery<Alumnus[]>({
    queryKey: ['mentors'],
    queryFn: async () => {
      if (!supabase) return alumni
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, university, grad_year, title')
          .eq('role', 'mentor')
          .order('full_name', { ascending: true })
          .returns<MentorRow[]>()
        if (error) throw error
        return data.map((r) => ({
          name: r.full_name,
          university: r.university ?? '',
          year: r.grad_year ?? '',
          role: r.title ?? '',
        }))
      } catch (e) {
        console.warn('useMentors fell back to mock data:', e)
        return alumni
      }
    },
  })
}
