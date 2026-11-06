// What the Hub accepts as a new password. The database holds the same rule for /reset
// (public.strong_password); Supabase Auth checks the length on sign-up. Leaked passwords are checked
// here too, because Supabase's own check is on paid plans only.

export const MIN_PASSWORD_LENGTH = 10
const MAX_PASSWORD_BYTES = 72

const COMMON_WORDS = [
  'password', 'passw', 'pass', 'qwerty', 'qwertyuiop', 'asdfgh', 'asdfghjkl', 'zxcvbn', 'admin', 'welcome', 'letmein',
  'iloveyou', 'dragon', 'monkey', 'football', 'baseball', 'superman', 'batman', 'abc', 'abcd', 'abcdef', 'abcdefgh',
  'пароль', 'йцукен', 'йцукенгшщз', 'фывапролдж', 'привет', 'любовь', 'aitclub', 'aithub', 'ait', 'club', 'hub', 'school', 'школа',
]

/** True when the password is too short, too long for bcrypt, lacks a letter or a digit, or is a
 * common word with numbers around it. */
export function isWeakPassword(password: string): boolean {
  if (password.length < MIN_PASSWORD_LENGTH) return true
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) return true
  if (!/[A-Za-zА-Яа-яЁё]/.test(password) || !/[0-9]/.test(password)) return true
  const letters = password.toLowerCase().replace(/[^a-zа-яё]/g, '')
  return COMMON_WORDS.includes(letters) || new Set(password.toLowerCase()).size < 4
}

/** Has this password turned up in a known leak (Have I Been Pwned)? The password never leaves the
 * browser: only the first five characters of its SHA-1 do, and the answer is padded so its size
 * says nothing either. A helpful check, not a gate: if the service can't be reached, nobody waits. */
export async function isLeakedPassword(password: string): Promise<boolean> {
  try {
    const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(password))
    const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase()
    const res = await fetch(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`, {
      headers: { 'Add-Padding': 'true' },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) return false
    const rest = hash.slice(5)
    return (await res.text()).split('\n').some((line) => {
      const [suffix, count] = line.trim().split(':')
      return suffix === rest && Number(count) > 0 // Padding lines have a count of zero.
    })
  } catch {
    return false
  }
}
