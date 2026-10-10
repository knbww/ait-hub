// Second factor (TOTP from an authenticator app) through Supabase Auth. Director and curator need
// it for exports, deletion, role changes and password resets — the database checks the session's
// assurance level (aal2). Anyone who turned it on is asked for a code after signing in.

import { supabase } from './supabase'
import { notConfigured } from './mutate'
import type { Result } from './mutate'

/** 'aal1' (password or GitHub only) or 'aal2' (confirmed with an app code). */
export interface Assurance {
  current: string | null
  next: string | null
}

export async function getAssurance(): Promise<Assurance> {
  if (!supabase) return { current: null, next: null }
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  if (error || !data) return { current: null, next: null }
  return { current: data.currentLevel, next: data.nextLevel }
}

/** The confirmed authenticator-app factor, if any. */
export async function verifiedTotpId(): Promise<string | null> {
  if (!supabase) return null
  const { data } = await supabase.auth.mfa.listFactors()
  return data?.totp[0]?.id ?? null
}

export interface TotpSetup {
  factorId: string
  qrCode: string
  secret: string
}

/** Starts adding an authenticator app; leftovers of an unfinished attempt are removed first. */
export async function startTotp(): Promise<Result<TotpSetup>> {
  if (!supabase) return notConfigured()
  const { data: factors } = await supabase.auth.mfa.listFactors()
  for (const f of factors?.all ?? []) {
    if (f.factor_type === 'totp' && f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id })
  }
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'AIT Hub' })
  if (error || !data) return { data: null, error: error ?? new Error('mfa_enroll_failed') }
  return { data: { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }, error: null }
}

/** Confirms a code for the given factor (finishing setup, or signing in). */
export async function confirmCode(factorId: string, code: string): Promise<Result> {
  if (!supabase) return notConfigured()
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: code.replace(/\s+/g, '') })
  return { data: null, error }
}

export async function disableTotp(factorId: string): Promise<Result> {
  if (!supabase) return notConfigured()
  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  return { data: null, error }
}
