import { supabase } from './supabase'
import { queryClient } from './queryClient'
import type { ProfileInfo } from './db-rows'

/** Upload an avatar to the `avatars` bucket under the user's folder, then point
 * the profile at its public URL (cache-busted). */
export async function uploadAvatar(userId: string, file: File) {
  if (!supabase) return { error: 'Supabase не настроен.' }
  const ext = (file.name.split('.').pop() || 'png').toLowerCase()
  const path = `${userId}/avatar.${ext}`
  const { error: upErr } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type })
  if (upErr) return { error: upErr.message }
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  const url = `${data.publicUrl}?v=${Date.now()}`
  const { error: dbErr } = await supabase
    .from('profiles')
    .update({ avatar_url: url })
    .eq('user_id', userId)
  if (dbErr) return { error: dbErr.message }
  return { error: null }
}

/** Update the member's display name (own-row RLS). */
export async function updateProfileName(userId: string, fullName: string) {
  if (!supabase) return { error: 'Supabase не настроен.' }
  const { error } = await supabase.from('profiles').update({ full_name: fullName }).eq('user_id', userId)
  return { error: error?.message ?? null }
}

/** Update the member's general info (own-row RLS). The ai_profile_* columns are frozen by a DB
 * trigger, so this can only touch the general fields even though it's a member-side write. */
export async function updateProfileInfo(userId: string, profileId: string, info: ProfileInfo) {
  if (!supabase) return { error: 'Supabase не настроен.' }
  const trimmedOrNull = (v: string | null) => {
    const t = (v ?? '').trim()
    return t === '' ? null : t
  }
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: info.full_name.trim() || 'Member',
      bio: trimmedOrNull(info.bio),
      title: trimmedOrNull(info.title),
      university: trimmedOrNull(info.university),
      grad_year: trimmedOrNull(info.grad_year),
      github_url: trimmedOrNull(info.github_url),
      leetcode_url: trimmedOrNull(info.leetcode_url),
      linkedin_url: trimmedOrNull(info.linkedin_url),
    })
    .eq('user_id', userId)
  if (error) return { error: error.message }
  await queryClient.invalidateQueries({ queryKey: ['my-profile', profileId] })
  return { error: null }
}
