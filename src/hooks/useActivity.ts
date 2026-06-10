import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { ActivityRow } from '../lib/db-rows'

const CELL_COUNT = 84
// Stable sample so the heatmap looks alive before the GitHub sync runs.
const SAMPLE = Array.from({ length: CELL_COUNT }, (_, i) => (i * 7 + 3) % 11)

/** Daily contribution counts for the heatmap (most recent ~84 days). */
export function useActivity(profileId?: string) {
  return useQuery<number[]>({
    queryKey: ['activity', profileId ?? null],
    queryFn: async () => {
      if (!supabase || !profileId) return SAMPLE
      try {
        const { data, error } = await supabase
          .from('activity')
          .select('day, count')
          .eq('profile_id', profileId)
          .order('day', { ascending: true })
          .returns<ActivityRow[]>()
        if (error) throw error
        if (!data || data.length === 0) return SAMPLE
        return data.slice(-CELL_COUNT).map((r) => r.count)
      } catch (e) {
        console.warn('useActivity fell back to sample:', e)
        return SAMPLE
      }
    },
  })
}
