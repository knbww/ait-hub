import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { proofOfWork } from '../data/mock'
import type { ProofOfWorkItem } from '../types'
import type { ProofOfWorkRow } from '../lib/db-rows'

export function useProofOfWork() {
  return useQuery<ProofOfWorkItem[]>({
    queryKey: ['proof_of_work'],
    queryFn: async () => {
      if (!supabase) return proofOfWork
      const { data, error } = await supabase
        .from('proof_of_work')
        .select('id, period, task, status')
        .order('created_at', { ascending: true })
        .returns<ProofOfWorkRow[]>()
      if (error) throw error
      return data.map((r) => ({ date: r.period, task: r.task, status: r.status }))
    },
  })
}
