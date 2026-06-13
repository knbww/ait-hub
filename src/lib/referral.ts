// Referral link helpers. The code that captures `?ref=` survives the signup /
// OAuth round-trip in localStorage, then AuthProvider claims it after login.

export const REFERRAL_STORAGE_KEY = 'ait_ref'

/** Public join link carrying a member's referral code. */
export function referralUrl(code: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/join?ref=${code}`
}
