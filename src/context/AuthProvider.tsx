import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'
import type { ProfileRow } from '../lib/db'
import { AuthContext } from './authContext'
import type { AuthValue, SignUpInput } from './authContext'

const PROFILE_COLUMNS =
  'id, user_id, full_name, role, grade, track_id, cohort_id, avatar_path, ' +
  'github_username, codeforces_handle, status, course_completed_at, created_at'

async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (data as unknown as ProfileRow | null) ?? null
}

/** Supabase reports a failed OAuth sign-in as `error_description` in the URL (query or hash). */
function readOauthError(): string | null {
  const query = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  return query.get('error_description') ?? hash.get('error_description')
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoading, setSessionLoading] = useState(isSupabaseConfigured)
  const [profile, setProfile] = useState<ProfileRow | null>(null)
  // The user id the current `profile` belongs to — lets `loading` stay true while it catches up.
  const [profileFor, setProfileFor] = useState<string | null>(null)
  const [profileError, setProfileError] = useState<unknown>(null)
  const [oauthError] = useState<string | null>(readOauthError)

  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setSessionLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const userId = session?.user.id ?? null

  useEffect(() => {
    if (!userId) return
    let active = true
    fetchProfile(userId)
      .then((row) => {
        if (!active) return
        setProfile(row)
        setProfileError(null)
        setProfileFor(userId)
      })
      .catch((e) => {
        console.error('profile load failed', e)
        if (!active) return
        setProfile(null)
        setProfileError(e)
        setProfileFor(userId)
      })
    return () => {
      active = false
    }
  }, [userId])

  const refreshProfile = useCallback(async () => {
    if (!userId) return
    try {
      setProfile(await fetchProfile(userId))
      setProfileError(null)
    } catch (e) {
      setProfileError(e)
    }
    setProfileFor(userId)
  }, [userId])

  const signIn = useCallback<AuthValue['signIn']>(async (email, password) => {
    if (!supabase) return { error: new Error('not_configured') }
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    return { error }
  }, [])

  const signInWithGitHub = useCallback<AuthValue['signInWithGitHub']>(async () => {
    if (!supabase) return { error: new Error('not_configured') }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: window.location.origin },
    })
    return { error }
  }, [])

  const signUp = useCallback(async (input: SignUpInput) => {
    if (!supabase) return { error: new Error('not_configured') }
    const { data, error } = await supabase.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        data: {
          full_name: input.fullName.trim(),
          grade: input.grade,
          join_code: input.joinCode.trim().toUpperCase(),
          telegram: input.telegram.trim(),
          photo_consent: input.photoConsent,
        },
      },
    })
    if (error) return { error }
    return { error: null, needsConfirmation: !data.session }
  }, [])

  const signOut = useCallback(async () => {
    setSession(null)
    setProfile(null)
    setProfileFor(null)
    queryClient.clear()
    if (!supabase) return
    // 'local' drops the stored session without a server round-trip that can 403 on an
    // already-expired token and leave the user stuck signed in.
    await supabase.auth.signOut({ scope: 'local' })
  }, [])

  const value = useMemo<AuthValue>(() => {
    const current = userId && profileFor === userId ? profile : null
    const role = current && current.status === 'active' ? current.role : null
    return {
      session,
      profile: current,
      loading: sessionLoading || (!!userId && profileFor !== userId),
      profileError: userId && profileFor === userId ? profileError : null,
      role,
      isStaff: role === 'track_lead' || role === 'director' || role === 'curator',
      isOversight: role === 'director' || role === 'curator',
      isDirector: role === 'director',
      signIn,
      signInWithGitHub,
      oauthError,
      signUp,
      signOut,
      refreshProfile,
    }
  }, [session, sessionLoading, userId, profile, profileFor, profileError, signIn, signInWithGitHub, oauthError, signUp, signOut, refreshProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
