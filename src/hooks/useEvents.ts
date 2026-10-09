import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { EventRow, RatingResultRow, TeamRatingRow, TrackId, TrackRatingRow } from '../lib/db'

const EVENT_COLUMNS =
  'id, type, title, track_id, starts_at, ends_at, location, description, responsible_id, is_rated, ' +
  'rules, rules_url, rules_published_at, status, responsible:profiles!events_responsible_id_fkey(full_name)'

/** Every event the viewer may see (members: confirmed / cancelled / completed; staff: drafts too). */
export function useEvents() {
  return useQuery<EventRow[]>({
    queryKey: ['events'],
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase.from('events').select(EVENT_COLUMNS).order('starts_at')
      if (error) throw error
      return data as unknown as EventRow[]
    },
  })
}

export function useTrackRating(trackId: TrackId) {
  return useQuery<TrackRatingRow[]>({
    queryKey: ['rating', 'members', trackId],
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase.rpc('track_rating', { p_track: trackId })
      if (error) throw error
      return (data ?? []) as TrackRatingRow[]
    },
  })
}

export function useTeamRating(trackId: TrackId) {
  return useQuery<TeamRatingRow[]>({
    queryKey: ['rating', 'teams', trackId],
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase.rpc('team_rating', { p_track: trackId })
      if (error) throw error
      return (data ?? []) as TeamRatingRow[]
    },
  })
}

const RESULT_COLUMNS =
  'id, event_id, profile_id, team_id, place, score, rating_delta, note, ' +
  'profile:profiles!rating_results_profile_id_fkey(full_name), team:teams(name)'

/** Results of one rated event (members see them once the event is completed). */
export function useEventResults(eventId: string | null) {
  return useQuery<RatingResultRow[]>({
    queryKey: ['rating', 'results', eventId],
    enabled: Boolean(eventId),
    queryFn: async () => {
      if (!supabase || !eventId) return []
      const { data, error } = await supabase
        .from('rating_results')
        .select(RESULT_COLUMNS)
        .eq('event_id', eventId)
        .order('place', { ascending: true, nullsFirst: false })
      if (error) throw error
      return data as unknown as RatingResultRow[]
    },
  })
}

/** A member's published rating history across tracks. */
export function useRatingHistory(profileId: string | undefined) {
  return useQuery<(RatingResultRow & { event: { title: string; track_id: TrackId; starts_at: string } | null })[]>({
    queryKey: ['rating', 'history', profileId ?? null],
    enabled: Boolean(profileId),
    queryFn: async () => {
      if (!supabase || !profileId) return []
      const { data, error } = await supabase
        .from('rating_results')
        .select(`${RESULT_COLUMNS}, event:events!inner(title, track_id, starts_at, status)`)
        .eq('profile_id', profileId)
        .eq('event.status', 'completed')
      if (error) throw error
      return (data as unknown as (RatingResultRow & { event: { title: string; track_id: TrackId; starts_at: string } | null })[])
        .sort((a, b) => (b.event?.starts_at ?? '').localeCompare(a.event?.starts_at ?? ''))
    },
  })
}
