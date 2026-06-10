import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { researchPapers } from '../data/mock'
import type { ResearchPaper } from '../types'
import type { ResearchPaperRow } from '../lib/db-rows'

export function useResearchPapers() {
  return useQuery<ResearchPaper[]>({
    queryKey: ['research_papers'],
    queryFn: async () => {
      if (!supabase) return researchPapers
      const { data, error } = await supabase
        .from('research_papers')
        .select('id, author_name, title, tags, citations')
        .order('citations', { ascending: false })
        .returns<ResearchPaperRow[]>()
      if (error) throw error
      return data.map((r) => ({
        title: r.title,
        author: r.author_name ?? 'Unknown',
        tags: r.tags,
        citations: r.citations,
      }))
    },
  })
}
