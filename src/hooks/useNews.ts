import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { NewsRow } from '../lib/db'

const NEWS_COLUMNS =
  'id, title, body, link_url, track_id, pinned, author_id, published_at, updated_at, ' +
  'author:profiles!news_author_id_fkey(full_name)'

/** Club news: pinned posts first, then the newest. */
export function useNews() {
  return useQuery<NewsRow[]>({
    queryKey: ['news'],
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase
        .from('news')
        .select(NEWS_COLUMNS)
        .order('pinned', { ascending: false })
        .order('published_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data as unknown as NewsRow[]
    },
  })
}
