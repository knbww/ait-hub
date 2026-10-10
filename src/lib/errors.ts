// Turns Supabase / network errors into a message key for the user. Database functions raise
// short codes (`raise exception 'forbidden'`); auth and network errors are matched by text.

const DB_CODES = [
  'forbidden',
  'not_authenticated',
  'not_found',
  'invalid_join_code',
  'invalid_full_name',
  'invalid_grade',
  'track_already_set',
  'invalid_link',
  'wrong_track',
  'self_award',
  'last_director',
  'cannot_change_self',
  'weak_password',
  'team_full',
  'already_in_team',
  'already_member',
  'no_track',
  'not_in_team',
  'rules_locked',
  'rules_not_announced_in_advance',
  'event_not_started',
  'team_wrong_track',
  'nothing_to_confirm',
  'avatar_path_foreign',
  'invalid_schedule',
  'invalid_shift',
  'mfa_required',
  'captcha_needed',
  'push_denied',
  'comments_closed',
  'too_fast',
  'invalid_photo_path',
  'photo_unreadable',
  'photo_too_big',
  'too_many_photos',
  'photo_consent_needed',
  'invalid_file',
  'too_many_files',
  'link_or_file',
  'file_type',
  'file_too_big',
  'file_empty',
] as const

function rawMessage(error: unknown): string {
  if (!error) return ''
  if (typeof error === 'string') return error
  if (typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message)
  return String(error)
}

/** i18n key under `errors.*` for any thrown value or `{ message }` object. */
export function errorKey(error: unknown): string {
  const message = rawMessage(error)
  const lower = message.toLowerCase()

  const code = DB_CODES.find((c) => message === c || message.startsWith(`${c}\n`) || lower.includes(`"${c}"`))
  if (code) return `errors.${code}`

  if (lower.includes('failed to fetch') || lower.includes('networkerror') || lower.includes('load failed')
      || lower.includes('network request failed')) {
    return 'errors.network'
  }
  if (lower.includes('invalid login credentials')) return 'errors.badLogin'
  if (lower.includes('captcha')) return 'errors.captcha'
  if (lower.includes('invalid totp') || lower.includes('mfa_verification_failed') || lower.includes('invalid code')) {
    return 'errors.badCode'
  }
  if (lower.includes('already registered') || lower.includes('already been registered') || lower.includes('user_already_exists')) {
    return 'errors.emailTaken'
  }
  // The sign-up trigger raised (bad code / grade / name): GoTrue hides the reason.
  if (lower.includes('database error saving new user')) return 'errors.signupRejected'
  if (lower.includes('password should be') || lower.includes('weak password')) return 'errors.weak_password'
  if (lower.includes('rate limit') || lower.includes('too many')) return 'errors.rateLimit'
  if (lower.includes('email not confirmed')) return 'errors.emailNotConfirmed'
  if (lower.includes('signups not allowed')) return 'errors.signupsClosed'
  if (lower.includes('mime type') || lower.includes('invalid_mime_type')) return 'errors.file_type'
  if (lower.includes('maximum allowed size') || lower.includes('payload too large')) return 'errors.file_too_big'
  if (lower.includes('row-level security') || lower.includes('permission denied')) return 'errors.forbidden'
  if (lower.includes('violates check constraint') || lower.includes('invalid input')) return 'errors.invalidInput'
  if (lower.includes('duplicate key')) return 'errors.duplicate'
  if (lower.includes('jwt') || lower.includes('refresh token')) return 'errors.sessionExpired'
  return 'errors.generic'
}
