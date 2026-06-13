import { useEffect } from 'react'
import { REFERRAL_STORAGE_KEY } from '../lib/referral'

/** Captures a `?ref=CODE` query param into localStorage so a referral survives
 * the signup / OAuth round-trip. AuthProvider claims it after login. Renders nothing. */
export function ReferralCapture() {
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('ref')
    if (code) localStorage.setItem(REFERRAL_STORAGE_KEY, code.trim())
  }, [])
  return null
}
