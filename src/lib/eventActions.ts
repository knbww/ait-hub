import { supabase } from './supabase'
import { notConfigured, refresh } from './mutate'
import type { Result } from './mutate'
import type { EventStatus, EventType, TrackId } from './db'

export interface EventInput {
  type: EventType
  title: string
  track_id: TrackId | null
  starts_at: string
  ends_at: string | null
  location: string | null
  description: string | null
  responsible_id: string | null
  is_rated: boolean
  rules: string | null
  rules_url: string | null
  status: EventStatus
}

const EVENT_KEYS = [['events'], ['rating']]

export async function saveEvent(id: string | null, input: EventInput): Promise<Result> {
  if (!supabase) return notConfigured()
  const { error } = id
    ? await supabase.from('events').update(input).eq('id', id)
    : await supabase.from('events').insert(input)
  if (error) return { data: null, error }
  await refresh(EVENT_KEYS)
  return { data: null, error: null }
}

export async function setEventStatus(id: string, status: EventStatus): Promise<Result> {
  if (!supabase) return notConfigured()
  const { error } = await supabase.from('events').update({ status }).eq('id', id)
  if (error) return { data: null, error }
  await refresh(EVENT_KEYS)
  return { data: null, error: null }
}

/** Drafts only — anything members have seen is cancelled instead. */
export async function deleteEvent(id: string): Promise<Result> {
  if (!supabase) return notConfigured()
  const { error } = await supabase.from('events').delete().eq('id', id)
  if (error) return { data: null, error }
  await refresh(EVENT_KEYS)
  return { data: null, error: null }
}

export interface ResultInput {
  event_id: string
  profile_id: string | null
  team_id: string | null
  place: number | null
  score: number | null
  rating_delta: number
  note: string | null
}

export async function saveResult(id: string | null, input: ResultInput): Promise<Result> {
  if (!supabase) return notConfigured()
  const { error } = id
    ? await supabase.from('rating_results').update(input).eq('id', id)
    : await supabase.from('rating_results').insert(input)
  if (error) return { data: null, error }
  await refresh([['rating']])
  return { data: null, error: null }
}

export async function deleteResult(id: string): Promise<Result> {
  if (!supabase) return notConfigured()
  const { error } = await supabase.from('rating_results').delete().eq('id', id)
  if (error) return { data: null, error }
  await refresh([['rating']])
  return { data: null, error: null }
}
