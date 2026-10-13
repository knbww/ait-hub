import { supabase } from './supabase'
import { notConfigured, refresh, rpc } from './mutate'
import { clearWorkFolder } from './workFiles'
import { shrinkPhoto } from './images'
import type { Result } from './mutate'
import type { Role, TrackId } from './db'

const MEMBER_KEYS = [['members'], ['member'], ['member-private'], ['points'], ['week-work']]

export interface MyProfileInput {
  full_name: string
  /** null for the curator (an adult) and for staff who never set one. */
  grade: number | null
  github_username: string
  codeforces_handle: string
}

export async function updateMyProfile(userId: string, input: MyProfileInput): Promise<Result> {
  if (!supabase) return notConfigured()
  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: input.full_name.trim(),
      grade: input.grade,
      github_username: input.github_username.trim().replace(/^@/, '') || null,
      codeforces_handle: input.codeforces_handle.trim() || null,
    })
    .eq('user_id', userId)
  if (error) return { data: null, error }
  await refresh(MEMBER_KEYS)
  return { data: null, error: null }
}

export async function updateMyTelegram(profileId: string, telegram: string): Promise<Result> {
  if (!supabase) return notConfigured()
  const { error } = await supabase
    .from('member_private')
    .update({ telegram: telegram.trim() || null })
    .eq('profile_id', profileId)
  if (error) return { data: null, error }
  await refresh([['member-private']])
  return { data: null, error: null }
}

/** Remove every file in a member's avatar folder (own folder, or any for the director). */
async function clearAvatarFolder(userId: string) {
  if (!supabase) return
  const { data } = await supabase.storage.from('avatars').list(userId)
  const paths = (data ?? []).map((f) => `${userId}/${f.name}`)
  if (paths.length) await supabase.storage.from('avatars').remove(paths)
}

export async function setPhotoConsent(profileId: string, userId: string, consent: boolean): Promise<Result> {
  if (!supabase) return notConfigured()
  // Saying "no" also removes the photo itself, not just the link to it (the database drops
  // the link; the file goes here).
  if (!consent) await clearAvatarFolder(userId)
  const { error } = await supabase.from('member_private').update({ photo_consent: consent }).eq('profile_id', profileId)
  if (error) return { data: null, error }
  await refresh(MEMBER_KEYS)
  return { data: null, error: null }
}

/** The photo is re-drawn at 512 px first — which also drops what a phone writes into the file
 * (location, camera) — then replaces the previous one. */
export async function uploadAvatar(userId: string, file: File, previousPath: string | null): Promise<Result> {
  if (!supabase) return notConfigured()
  let photo
  try {
    photo = await shrinkPhoto(file, 512)
  } catch (error) {
    return { data: null, error }
  }
  const path = `${userId}/avatar-${Date.now()}.${photo.ext}`
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, photo.blob, { contentType: photo.blob.type, upsert: false })
  if (uploadError) return { data: null, error: uploadError }
  const { error } = await supabase.from('profiles').update({ avatar_path: path }).eq('user_id', userId)
  if (error) return { data: null, error }
  if (previousPath) await supabase.storage.from('avatars').remove([previousPath])
  await refresh(MEMBER_KEYS)
  return { data: null, error: null }
}

export async function removeAvatar(userId: string): Promise<Result> {
  if (!supabase) return notConfigured()
  await clearAvatarFolder(userId)
  const { error } = await supabase.from('profiles').update({ avatar_path: null }).eq('user_id', userId)
  if (error) return { data: null, error }
  await refresh(MEMBER_KEYS)
  return { data: null, error: null }
}

export async function changePassword(password: string): Promise<Result> {
  if (!supabase) return notConfigured()
  const { error } = await supabase.auth.updateUser({ password })
  return { data: null, error }
}

export const claimTrack = (code: string) =>
  rpc<TrackId>('claim_track', { p_code: code.trim().toUpperCase() }, MEMBER_KEYS)

export const exportMemberData = (profileId: string) =>
  rpc<Record<string, unknown>>('export_member_data', { p_profile: profileId })

// ── Staff ────────────────────────────────────────────────────────────────────
export const setMemberRole = (profileId: string, role: Role) =>
  rpc('set_member_role', { p_profile: profileId, p_role: role }, MEMBER_KEYS)

export const setMemberTrack = (profileId: string, trackId: TrackId | null) =>
  rpc('set_member_track', { p_profile: profileId, p_track: trackId }, MEMBER_KEYS)

export const setMemberStatus = (profileId: string, status: 'active' | 'inactive') =>
  rpc('set_member_status', { p_profile: profileId, p_status: status }, MEMBER_KEYS)

/** Full deletion on request: photos and work files first (Storage API), then everything else
 * in one call. */
export async function deleteMember(profileId: string, userId: string | null): Promise<Result<{ auth_deleted: boolean }>> {
  if (userId) await clearAvatarFolder(userId)
  await clearWorkFolder(profileId)
  return rpc<{ auth_deleted: boolean }>('delete_member', { p_profile: profileId }, MEMBER_KEYS)
}

/** A new code for the track: works for `days` days, for at most `maxUses` sign-ups when given. */
export const rotateJoinCode = (trackId: TrackId, days = 14, maxUses: number | null = null) =>
  rpc<string>('rotate_join_code', { p_track: trackId, p_days: days, p_max_uses: maxUses }, [['join-codes']])

/** Let a newcomer in, or turn them away (the account is switched off). */
export const decideJoin = (profileId: string, approve: boolean) =>
  rpc('decide_join', { p_profile: profileId, p_approve: approve }, [...MEMBER_KEYS, ['pending-members']])

/** A one-time code (15 minutes) the member enters at /reset to set a new password. */
export const createResetCode = (profileId: string) => rpc<string>('create_reset_code', { p_profile: profileId })

/** Signed out: email + code + new password. */
export async function resetPasswordWithCode(email: string, code: string, password: string): Promise<Result> {
  const res = await rpc<string>('reset_password_with_code', { p_email: email.trim(), p_code: code.trim(), p_password: password })
  if (res.error) return { data: null, error: res.error }
  return res.data === 'ok' ? { data: null, error: null } : { data: null, error: new Error('invalid_reset_code') }
}
