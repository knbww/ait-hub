import { supabase } from './supabase'
import { notConfigured, refresh } from './mutate'
import type { Result } from './mutate'
import type { TrackId } from './db'

export interface NewsInput {
  title: string
  body: string
  link_url: string | null
  track_id: TrackId | null
  pinned: boolean
}

export async function saveNews(id: string | null, input: NewsInput): Promise<Result> {
  if (!supabase) return notConfigured()
  const { error } = id
    ? await supabase.from('news').update(input).eq('id', id)
    : await supabase.from('news').insert(input)
  if (error) return { data: null, error }
  await refresh([['news']])
  return { data: null, error: null }
}

export async function deleteNews(id: string): Promise<Result> {
  if (!supabase) return notConfigured()
  const { error } = await supabase.from('news').delete().eq('id', id)
  if (error) return { data: null, error }
  await refresh([['news']])
  return { data: null, error: null }
}
