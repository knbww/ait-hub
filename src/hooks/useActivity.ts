import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { ActivityRow } from '../lib/db-rows'

const CELL_COUNT = 84

/** Daily contribution counts for the heatmap (most recent ~84 days). DB-only. */
export function useActivity(profileId?: string) {
  return useQuery<number[]>({
    queryKey: ['activity', profileId ?? null],
    queryFn: async () => {
      if (!supabase || !profileId) return []
      const { data, error } = await supabase
        .from('activity')
        .select('day, count')
        .eq('profile_id', profileId)
        .order('day', { ascending: true })
        .returns<ActivityRow[]>()
      if (error) throw error
      return (data ?? []).slice(-CELL_COUNT).map((r) => r.count)
    },
  })
}
