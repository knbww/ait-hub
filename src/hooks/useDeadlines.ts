import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Deadline } from '../types'
import type { DeadlineRow } from '../lib/db-rows'

const MS_PER_DAY = 86_400_000

/** Upcoming deadlines (DB-only). */
export function useDeadlines() {
  return useQuery<Deadline[]>({
    queryKey: ['deadlines'],
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase
        .from('deadlines')
        .select('id, title, due_date, scope')
        .order('due_date', { ascending: true })
        .returns<DeadlineRow[]>()
      if (error) throw error
      const now = Date.now()
      return data.map((r) => ({
        event: r.title,
        date: r.due_date,
        daysLeft: Math.max(0, Math.ceil((new Date(r.due_date).getTime() - now) / MS_PER_DAY)),
      }))
    },
  })
}
