import { supabase } from './supabase'
import { queryClient } from './queryClient'

// Triggers the AI assessment of the signed-in member's profile. The score is computed and
// written server-side by the `profile-score` Edge Function (members can't set it themselves).

const FUNCTIONS_BASE = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1`

export async function generateProfileScore(
  profileId: string,
): Promise<{ score: number; summary: string } | { error: string }> {
  if (!supabase) return { error: 'unconfigured' }
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return { error: 'unauthorized' }

  try {
    const res = await fetch(`${FUNCTIONS_BASE}/profile-score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: '{}',
    })
    if (!res.ok) return { error: `ai_error_${res.status}` }
    const out = (await res.json()) as { score: number; summary: string }
    await queryClient.invalidateQueries({ queryKey: ['my-profile', profileId] })
    return out
  } catch {
    return { error: 'network' }
  }
}
