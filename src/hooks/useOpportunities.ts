import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { OpportunityRow, TrackId } from '../lib/db'

const OPPORTUNITY_COLUMNS =
  'id, key, title, kind, organizer, tracks, region, grade_min, grade_max, eligibility, team, fee, summary, ' +
  'description, how_to_apply, url, apply_url, deadline, starts_on, ends_on, dates_note, dates_verified, sources, ' +
  'notes, hidden, created_by, created_at, updated_at'

/** The whole catalog (staff also get hidden entries); small enough to filter in the browser. */
export function useOpportunities() {
  return useQuery<OpportunityRow[]>({
    queryKey: ['opportunities'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase.from('opportunities').select(OPPORTUNITY_COLUMNS).limit(1000)
      if (error) throw error
      return data as unknown as OpportunityRow[]
    },
  })
}

/** Ids of the entries this member marked «хочу участвовать». */
export function useMySaves(profileId: string | undefined) {
  return useQuery<Set<string>>({
    queryKey: ['opportunity-saves', profileId ?? null],
    enabled: Boolean(profileId),
    queryFn: async () => {
      if (!supabase || !profileId) return new Set()
      const { data, error } = await supabase.from('opportunity_saves').select('opportunity_id').eq('profile_id', profileId)
      if (error) throw error
      return new Set((data as { opportunity_id: string }[]).map((r) => r.opportunity_id))
    },
  })
}

export interface Saver {
  profile_id: string
  profile: { full_name: string; track_id: TrackId | null } | null
}

/** Who wants to take part — for staff, limited by the database to the members they manage. */
export function useOpportunitySavers(opportunityId: string | undefined, enabled: boolean) {
  return useQuery<Saver[]>({
    queryKey: ['opportunity-savers', opportunityId ?? null],
    enabled: Boolean(opportunityId) && enabled,
    queryFn: async () => {
      if (!supabase || !opportunityId) return []
      const { data, error } = await supabase
        .from('opportunity_saves')
        .select('profile_id, profile:profiles(full_name, track_id)')
        .eq('opportunity_id', opportunityId)
      if (error) throw error
      return (data as unknown as Saver[]).filter((s) => s.profile)
    },
  })
}
