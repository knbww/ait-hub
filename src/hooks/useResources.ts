import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { resources as mockResources } from '../data/mock'
import type { Resource } from '../types'
import type { ResourceRow } from '../lib/db-rows'

/** Resource library. Global; falls back to the mock list if Supabase isn't
 * configured or the query fails (e.g. migration not yet applied). */
export function useResources() {
  return useQuery<Resource[]>({
    queryKey: ['resources'],
    queryFn: async () => {
      if (!supabase) return mockResources
      try {
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
        }))
      } catch (e) {
        console.warn('useResources fell back to mock data:', e)
        return mockResources
      }
    },
  })
}
