import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { proofOfWork } from '../data/mock'
import type { ProofOfWorkItem } from '../types'
import type { ProofOfWorkRow } from '../lib/db-rows'

/** A member's proof-of-work timeline. Pass the current profile id to scope to
 * the signed-in user; with no id it returns the mock preview. */
export function useProofOfWork(profileId?: string) {
  return useQuery<ProofOfWorkItem[]>({
    queryKey: ['proof_of_work', profileId ?? null],
    queryFn: async () => {
      if (!supabase || !profileId) return proofOfWork
      const { data, error } = await supabase
        .from('proof_of_work')
        .select('id, period, task, status')
        .eq('profile_id', profileId)
        .order('created_at', { ascending: true })
        .returns<ProofOfWorkRow[]>()
      if (error) throw error
      return data.map((r) => ({ date: r.period, task: r.task, status: r.status }))
    },
  })
}
