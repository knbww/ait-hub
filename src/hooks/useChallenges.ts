import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { Challenge } from '../types'
import type { ChallengeRow } from '../lib/db-rows'

export function toChallenge(r: ChallengeRow): Challenge {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    rules: r.rules,
    starterUrl: r.starter_url,
    startsAt: r.starts_at,
    deadline: r.deadline,
    status: r.status,
  }
}

/** All challenges, newest first (DB-only). */
export function useChallenges() {
  return useQuery<Challenge[]>({
    queryKey: ['challenges'],
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase
        .from('challenges')
        .select('id, title, description, rules, starter_url, starts_at, deadline, status, created_at')
        .order('created_at', { ascending: false })
        .returns<ChallengeRow[]>()
      if (error) throw error
      return data.map(toChallenge)
    },
  })
}
