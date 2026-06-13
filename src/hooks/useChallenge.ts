import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { toChallenge } from './useChallenges'
import type { Challenge, ChallengeEntry } from '../types'
import type { ChallengeRow, ChallengeEntryRow } from '../lib/db-rows'

export interface ChallengeDetail {
  challenge: Challenge
  entries: ChallengeEntry[]
  myEntry?: ChallengeEntry
}

function toEntry(r: ChallengeEntryRow): ChallengeEntry {
  return {
    id: r.id,
    profileId: r.profile_id,
    memberName: r.profiles?.full_name ?? 'Участник',
    link: r.link,
    comment: r.comment,
    score: r.score,
    place: r.place,
    prizeAwarded: r.prize_awarded,
  }
}

/** A single challenge + the entries the caller may see (own / jury / archive) +
 * the caller's own entry. */
export function useChallenge(id?: string, profileId?: string) {
  return useQuery<ChallengeDetail | null>({
    queryKey: ['challenge', id ?? null],
    enabled: Boolean(supabase && id),
    queryFn: async () => {
      if (!supabase || !id) return null
      const { data: ch, error } = await supabase
        .from('challenges')
        .select('id, title, description, rules, starter_url, starts_at, deadline, status, created_at')
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      if (!ch) return null

      const { data: entries, error: entriesError } = await supabase
        .from('challenge_entries')
        .select('id, profile_id, link, comment, score, place, prize_awarded, created_at, profiles(full_name)')
        .eq('challenge_id', id)
        .order('place', { ascending: true, nullsFirst: false })
        .returns<ChallengeEntryRow[]>()
      if (entriesError) throw entriesError

      const mapped = (entries ?? []).map(toEntry)
      return {
        challenge: toChallenge(ch as ChallengeRow),
        entries: mapped,
        myEntry: profileId ? mapped.find((e) => e.profileId === profileId) : undefined,
      }
    },
  })
}
