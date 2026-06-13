import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { AutomationErrorRow } from '../lib/db-rows'

/** Recent n8n dead-letter rows (admin-read; the table is admin-only via RLS). Returns [] if the
 * table isn't there yet (migration not pushed), so the panel degrades gracefully. */
export function useAutomationErrors() {
  return useQuery<AutomationErrorRow[]>({
    queryKey: ['admin', 'automation-errors'],
    queryFn: async () => {
      if (!supabase) return []
      try {
        const { data, error } = await supabase
          .from('automation_errors')
          .select('id, workflow, last_node, message, created_at')
          .order('created_at', { ascending: false })
          .limit(20)
          .returns<AutomationErrorRow[]>()
        if (error) throw error
        return data
      } catch (e) {
        console.warn('automation_errors query failed:', e)
        return []
      }
    },
  })
}
