import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface Member {
  id: string
  fullName: string
}

/** The full member roster (id + name), cached under one key so host panels can
 * share it instead of refetching profiles per week. Host-only. */
export function useMembers(enabled: boolean) {
  return useQuery<Member[]>({
    queryKey: ['members'],
    enabled: Boolean(supabase && enabled),
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name')
        .order('full_name', { ascending: true })
        .returns<{ id: string; full_name: string }[]>()
      if (error) throw error
      return data.map((r) => ({ id: r.id, fullName: r.full_name }))
    },
  })
}
