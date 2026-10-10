import { supabase } from './supabase'
import { notConfigured, refresh } from './mutate'
import { queryClient } from './queryClient'
import type { Result } from './mutate'
import type { OpportunityRow } from './db'

export type OpportunityInput = Pick<OpportunityRow,
  'title' | 'kind' | 'organizer' | 'tracks' | 'region' | 'grade_min' | 'grade_max' | 'eligibility' | 'team' | 'fee'
  | 'summary' | 'description' | 'how_to_apply' | 'url' | 'apply_url' | 'deadline' | 'starts_on' | 'ends_on'
  | 'dates_note' | 'dates_verified' | 'sources' | 'notes' | 'hidden'>

export async function saveOpportunity(id: string | null, input: OpportunityInput): Promise<Result<string>> {
  if (!supabase) return notConfigured()
  const query = id
    ? supabase.from('opportunities').update(input).eq('id', id).select('id').single()
    : supabase.from('opportunities').insert(input).select('id').single()
  const { data, error } = await query
  if (error) return { data: null, error }
  await refresh([['opportunities']])
  return { data: (data as { id: string }).id, error: null }
}

export async function setOpportunityHidden(id: string, hidden: boolean): Promise<Result> {
  if (!supabase) return notConfigured()
  const { error } = await supabase.from('opportunities').update({ hidden }).eq('id', id)
  if (error) return { data: null, error }
  await refresh([['opportunities']])
  return { data: null, error: null }
}

export async function deleteOpportunity(id: string): Promise<Result> {
  if (!supabase) return notConfigured()
  const { data, error } = await supabase.from('opportunities').delete().eq('id', id).select('id')
  if (error) return { data: null, error }
  // Policies hide what the caller may not delete: nothing removed means it wasn't theirs to remove.
  if (!data?.length) return { data: null, error: new Error('forbidden') }
  await refresh([['opportunities']])
  return { data: null, error: null }
}

/** «Хочу участвовать», shown at once; re-read if the database says no. */
export async function setSaved(opportunityId: string, profileId: string, saved: boolean): Promise<Result> {
  if (!supabase) return notConfigured()
  const key = ['opportunity-saves', profileId]
  queryClient.setQueryData<Set<string>>(key, (prev) => {
    const next = new Set(prev)
    if (saved) next.add(opportunityId)
    else next.delete(opportunityId)
    return next
  })
  const { error } = saved
    ? await supabase.from('opportunity_saves').insert({ opportunity_id: opportunityId, profile_id: profileId })
    : await supabase.from('opportunity_saves').delete().eq('opportunity_id', opportunityId).eq('profile_id', profileId)
  if (error && !(saved && (error as { code?: string }).code === '23505')) {
    await refresh([key])
    return { data: null, error }
  }
  await refresh([['opportunity-savers', opportunityId]])
  return { data: null, error: null }
}
