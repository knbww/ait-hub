import type { QueryKey } from '@tanstack/react-query'
import { supabase } from './supabase'
import { queryClient } from './queryClient'

export interface Result<T = null> {
  data: T | null
  error: unknown
}

export const notConfigured = <T>(): Result<T> => ({ data: null, error: new Error('not_configured') })

export async function refresh(keys: QueryKey[]) {
  await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
}

/** Call a database function; on success refresh the given queries. */
export async function rpc<T = null>(name: string, args: Record<string, unknown>, invalidate: QueryKey[] = []): Promise<Result<T>> {
  if (!supabase) return notConfigured()
  const { data, error } = await supabase.rpc(name, args)
  if (error) return { data: null, error }
  await refresh(invalidate)
  return { data: (data as T) ?? null, error: null }
}
