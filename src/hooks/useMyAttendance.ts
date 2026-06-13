import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

/** Set of week ids the signed-in member has checked in to. Empty when logged out. */
export function useMyAttendance(profileId?: string) {
  return useQuery<Set<string>>({
    queryKey: ['attendance', 'mine', profileId ?? null],
    queryFn: async () => {
      if (!supabase || !profileId) return new Set<string>()
      const { data, error } = await supabase
        .from('attendance')
        .select('week_id')
        .eq('profile_id', profileId)
        .returns<{ week_id: string }[]>()
      if (error) throw error
      return new Set(data.map((r) => r.week_id))
    },
  })
}
