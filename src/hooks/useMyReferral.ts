import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface MyReferral {
  code: string
  invitedCount: number
  rewardedCount: number
}

/** The signed-in member's referral code + funnel counts. Null when logged out. */
export function useMyReferral(profileId?: string) {
  return useQuery<MyReferral | null>({
    queryKey: ['my-referral', profileId ?? null],
    queryFn: async () => {
      if (!supabase || !profileId) return null
      const { data: me, error } = await supabase
        .from('profiles')
        .select('referral_code')
        .eq('id', profileId)
        .maybeSingle()
      if (error) throw error

      const { count: invited } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('referred_by', profileId)
      const { count: rewarded } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('referred_by', profileId)
        .eq('referral_rewarded', true)

      return {
        code: (me?.referral_code as string | undefined) ?? '',
        invitedCount: invited ?? 0,
        rewardedCount: rewarded ?? 0,
      }
    },
  })
}
