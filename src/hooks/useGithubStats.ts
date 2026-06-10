import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { GithubStats } from '../types'
import type { GithubStatsRow } from '../lib/db-rows'

// Shown until the GitHub sync workflow populates real data.
const SAMPLE: GithubStats = {
  openPrs: 3,
  lastCommitAt: null,
  series: [40, 70, 45, 90, 65, 80, 95],
}

export function useGithubStats(profileId?: string) {
  return useQuery<GithubStats>({
    queryKey: ['github_stats', profileId ?? null],
    queryFn: async () => {
      if (!supabase || !profileId) return SAMPLE
      try {
        const { data, error } = await supabase
          .from('github_stats')
          .select('open_prs, last_commit_at, commit_series')
          .eq('profile_id', profileId)
          .maybeSingle()
          .returns<GithubStatsRow>()
        if (error) throw error
        if (!data) return SAMPLE
        return {
          openPrs: data.open_prs,
          lastCommitAt: data.last_commit_at,
          series: data.commit_series?.length ? data.commit_series : SAMPLE.series,
        }
      } catch (e) {
        console.warn('useGithubStats fell back to sample:', e)
        return SAMPLE
      }
    },
  })
}
