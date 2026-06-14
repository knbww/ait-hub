import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { MyProfileRow } from '../lib/db-rows'

const BASE = 'id, role, avatar_url, full_name, bio, title, university, grad_year, github_url, leetcode_url, linkedin_url'
const AI = 'ai_profile_score, ai_profile_summary, ai_profile_at'

/** The signed-in member's full profile (general info + AI score). If the profile-AI-score
 * migration isn't applied yet, it falls back to the base columns (ai_* = null) so the
 * general-info form still works before `db push`. */
export function useMyProfile(profileId?: string) {
  return useQuery<MyProfileRow | null>({
    queryKey: ['my-profile', profileId ?? null],
    queryFn: async () => {
      if (!supabase || !profileId) return null
      const full = await supabase.from('profiles').select(`${BASE}, ${AI}`).eq('id', profileId).maybeSingle()
      if (!full.error) return (full.data as MyProfileRow | null) ?? null
      // ai_* columns missing → fall back to base columns.
      const base = await supabase.from('profiles').select(BASE).eq('id', profileId).maybeSingle()
      if (base.error) throw base.error
      if (!base.data) return null
      return { ...(base.data as object), ai_profile_score: null, ai_profile_summary: null, ai_profile_at: null } as MyProfileRow
    },
    retry: false,
  })
}
