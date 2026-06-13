import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Resource } from '../types'
import type { ResourceRow } from '../lib/db-rows'

/** Resource library (DB-only). */
export function useResources() {
  return useQuery<Resource[]>({
    queryKey: ['resources'],
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase
        .from('resources')
        .select('id, title, description, category, url, icon')
        .order('created_at', { ascending: true })
        .returns<ResourceRow[]>()
      if (error) throw error
      return data.map((r) => ({
        title: r.title,
        description: r.description ?? '',
        icon: r.icon ?? 'database',
        url: r.url ?? '#',
      }))
    },
  })
}
