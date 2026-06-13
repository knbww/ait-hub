import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { AipJournalEntry } from '../types'
import type { AipJournalRow } from '../lib/db-rows'

/** The public AIP audit journal (newest first). Pass a profile id to scope it to
 * one member; omit it for the club-wide feed. Mock preview when logged out. */
export function useAipJournal(profileId?: string) {
  return useQuery<AipJournalEntry[]>({
    queryKey: ['aip-journal', profileId ?? 'all'],
    queryFn: async () => {
      if (!supabase) return []
      let q = supabase
        .from('aip_journal')
        .select('id, profile_id, member_name, source, delta, note, awarder_name, created_at')
      if (profileId) q = q.eq('profile_id', profileId)
      const { data, error } = await q
        .order('created_at', { ascending: false })
        .limit(50)
        .returns<AipJournalRow[]>()
      if (error) throw error
      return data.map((r) => ({
        id: r.id,
        profileId: r.profile_id,
        memberName: r.member_name,
        source: r.source,
        delta: r.delta,
        note: r.note,
        awarderName: r.awarder_name,
        createdAt: r.created_at,
      }))
    },
  })
}
