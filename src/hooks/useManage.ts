import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { AuditRow, JoinCodeRow, MemberPrivateRow } from '../lib/db'

/** Active join codes the viewer may show (a lead: their track; director / curator: all). */
export function useJoinCodes(enabled: boolean) {
  return useQuery<JoinCodeRow[]>({
    queryKey: ['join-codes'],
    enabled,
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase
        .from('join_codes')
        .select('code, track_id, active, created_at')
        .eq('active', true)
      if (error) throw error
      return data as JoinCodeRow[]
    },
  })
}

export function useAuditLog(enabled: boolean) {
  return useQuery<AuditRow[]>({
    queryKey: ['audit-log'],
    enabled,
    queryFn: async () => {
      if (!supabase) return []
      const { data, error } = await supabase
        .from('audit_log')
        .select('id, action, target_id, details, created_at, actor:profiles!audit_log_actor_id_fkey(full_name)')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data as unknown as AuditRow[]
    },
  })
}

/** Email + Telegram: visible to the member, their track lead, director / curator. */
export function useMemberPrivate(profileId: string | undefined, enabled = true) {
  return useQuery<MemberPrivateRow | null>({
    queryKey: ['member-private', profileId ?? null],
    enabled: Boolean(profileId) && enabled,
    queryFn: async () => {
      if (!supabase || !profileId) return null
      const { data, error } = await supabase
        .from('member_private')
        .select('profile_id, email, telegram, photo_consent')
        .eq('profile_id', profileId)
        .maybeSingle()
      if (error) throw error
      return (data as MemberPrivateRow | null) ?? null
    },
  })
}

/** Short-lived signed URL for a photo in the private avatars bucket. */
export function useAvatarUrl(path: string | null | undefined) {
  return useQuery<string | null>({
    queryKey: ['avatar', path ?? null],
    enabled: Boolean(path),
    staleTime: 50 * 60_000,
    gcTime: 55 * 60_000,
    retry: false,
    queryFn: async () => {
      if (!supabase || !path) return null
      const { data, error } = await supabase.storage.from('avatars').createSignedUrl(path, 3600)
      if (error) return null
      return data.signedUrl
    },
  })
}
