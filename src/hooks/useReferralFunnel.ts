import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { ReferralFunnelRow } from '../lib/db-rows'

/** Council referral funnel: who referred whom → joined → reached week 3 → rewarded. */
export function useReferralFunnel() {
  return useQuery<ReferralFunnelRow[]>({
    queryKey: ['referral-funnel'],
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase
        .from('referral_funnel')
        .select('referrer_id, referrer_name, member_id, member_name, joined_at, rewarded, reached_week3')
        .order('joined_at', { ascending: false })
        .returns<ReferralFunnelRow[]>()
      if (error) throw error
      return data
    },
  })
}
