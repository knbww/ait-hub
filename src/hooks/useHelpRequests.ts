import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { HelpRequest } from '../types'
import type { HelpRow } from '../lib/db-rows'

/** The help board (newest first). Requester/helper names resolved via profiles. */
export function useHelpRequests() {
  return useQuery<HelpRequest[]>({
    queryKey: ['help'],
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase
        .from('help_requests')
        .select('id, requester_id, title, description, status, helper_id, rewarded, created_at')
        .order('created_at', { ascending: false })
        .returns<HelpRow[]>()
      if (error) throw error

      const ids = new Set<string>()
      for (const h of data) {
        ids.add(h.requester_id)
        if (h.helper_id) ids.add(h.helper_id)
      }
      const names = new Map<string, string>()
      if (ids.size) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', [...ids])
          .returns<{ id: string; full_name: string }[]>()
        for (const p of profs ?? []) names.set(p.id, p.full_name)
      }

      return data.map((h) => ({
        id: h.id,
        requesterId: h.requester_id,
        requesterName: names.get(h.requester_id) ?? '—',
        title: h.title,
        description: h.description,
        status: h.status,
        helperId: h.helper_id,
        helperName: h.helper_id ? (names.get(h.helper_id) ?? '—') : null,
      }))
    },
  })
}
