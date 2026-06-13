import { supabase } from './supabase'

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
