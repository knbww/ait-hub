import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { NewsCommentRow, NewsRow } from '../lib/db'

const NEWS_COLUMNS =
  'id, title, body, link_url, track_id, pinned, author_id, published_at, updated_at, photos, allow_comments, ' +
  'author:profiles!news_author_id_fkey(full_name), ' +
  'likes:news_likes(profile_id, profile:profiles(full_name)), ' +
  'comments:news_comments(id)'

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

/** A post's comments, oldest first — loaded when the post's comments are opened. */
export function useNewsComments(newsId: string, enabled: boolean) {
  return useQuery<NewsCommentRow[]>({
    queryKey: ['news-comments', newsId],
    enabled,
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase
        .from('news_comments')
        .select('id, news_id, author_id, body, created_at, author:profiles!news_comments_author_id_fkey(full_name, avatar_path)')
        .eq('news_id', newsId)
        .order('created_at')
        .limit(500)
      if (error) throw error
      return data as unknown as NewsCommentRow[]
    },
  })
}

/** Short-lived signed links for photos in the private news bucket, by path. */
export function useNewsPhotoUrls(paths: string[]) {
  return useQuery<Record<string, string>>({
    queryKey: ['news-photos', ...paths],
    enabled: paths.length > 0,
    staleTime: 50 * 60_000,
    gcTime: 55 * 60_000,
    retry: false,
    queryFn: async () => {
      if (!supabase || paths.length === 0) return {}
      const { data, error } = await supabase.storage.from('news').createSignedUrls(paths, 3600)
      if (error) throw error
      const urls: Record<string, string> = {}
      for (const item of data) {
        if (item.path && item.signedUrl) urls[item.path] = item.signedUrl
      }
      return urls
    },
  })
}

/** Members the author can see who didn't agree to photos (or haven't answered) — for the
 * reminder in the post form. A lead sees their track; director / curator see everyone. */
export function usePhotoRefusals(enabled: boolean) {
  return useQuery<string[]>({
    queryKey: ['photo-refusals'],
    enabled,
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase
        .from('member_private')
        .select('photo_consent, profile:profiles!inner(full_name, status)')
        .or('photo_consent.is.null,photo_consent.eq.false')
        .eq('profile.status', 'active')
      if (error) throw error
      return (data as unknown as { profile: { full_name: string } }[])
        .map((r) => r.profile.full_name)
        .sort((a, b) => a.localeCompare(b, 'ru'))
    },
  })
}
