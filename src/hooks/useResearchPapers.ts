import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { ResearchPaper } from '../types'
import type { ResearchPaperRow } from '../lib/db-rows'

/** Research & paper repository (DB-only). */
export function useResearchPapers() {
  return useQuery<ResearchPaper[]>({
    queryKey: ['research_papers'],
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase
        .from('research_papers')
        .select('id, author_name, title, tags, citations')
        .order('citations', { ascending: false })
        .returns<ResearchPaperRow[]>()
      if (error) throw error
      return data.map((r) => ({
        title: r.title,
        author: r.author_name ?? 'Неизвестен',
        tags: r.tags,
        citations: r.citations,
      }))
    },
  })
}
