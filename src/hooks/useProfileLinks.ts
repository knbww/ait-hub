import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { ProfileLinks } from '../types'
import type { ProfileLinksRow } from '../lib/db-rows'

const EMPTY: ProfileLinks = { github_url: '#', leetcode_url: '#', linkedin_url: '#' }

/** A member's external proof links (GitHub / LeetCode / LinkedIn). */
export function useProfileLinks(profileId?: string) {
  return useQuery<ProfileLinks>({
    queryKey: ['profile_links', profileId ?? null],
    queryFn: async () => {
      if (!supabase || !profileId) return EMPTY
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('github_url, leetcode_url, linkedin_url')
          .eq('id', profileId)
          .maybeSingle()
          .returns<ProfileLinksRow>()
        if (error) throw error
        return {
          github_url: data?.github_url ?? '#',
          leetcode_url: data?.leetcode_url ?? '#',
          linkedin_url: data?.linkedin_url ?? '#',
        }
      } catch (e) {
        console.warn('useProfileLinks fell back to empty links:', e)
        return EMPTY
      }
    },
  })
}
