// profile-score — generates an AI assessment of the signed-in member's profile (Groq), and
// writes the score + summary back with the service role so it can't be self-assigned.
//
// React (member JWT) → this function: verify JWT → read the member's profile (service role) →
// Groq structured {score, summary} → write ai_profile_* on the member's own row → return it.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') ?? ''
const GROQ_MODEL = Deno.env.get('GROQ_MODEL') ?? 'llama-3.3-70b-versatile'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  const preflight = handleCors(req)
  if (preflight) return preflight
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'unauthorized' })

  const asUser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userRes, error: authErr } = await asUser.auth.getUser(token)
  if (authErr || !userRes?.user) return json(401, { error: 'unauthorized' })
  if (!GROQ_API_KEY || !SUPABASE_SERVICE_ROLE_KEY) return json(503, { error: 'ai_unconfigured' })

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: profile, error: pErr } = await admin
    .from('profiles')
    .select('id, full_name, bio, title, university, grad_year, github_url, leetcode_url, linkedin_url')
    .eq('user_id', userRes.user.id)
    .single()
  if (pErr || !profile) return json(404, { error: 'profile_not_found' })

  const { data: lb } = await admin
    .from('leaderboard')
    .select('xp')
    .eq('profile_id', profile.id)
    .maybeSingle()
  const aip = (lb?.xp as number | undefined) ?? 0

  const facts = [
    `Name: ${profile.full_name ?? '—'}`,
    `Title: ${profile.title ?? '—'}`,
    `University: ${profile.university ?? '—'}, grad ${profile.grad_year ?? '—'}`,
    `Bio: ${profile.bio ?? '(empty)'}`,
    `Links: github=${profile.github_url ?? '—'} leetcode=${profile.leetcode_url ?? '—'} linkedin=${profile.linkedin_url ?? '—'}`,
    `AIP (club reputation points): ${aip}`,
  ].join('\n')

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.3,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You assess a member profile in an AI student club. Rate profile strength and completeness 0-100 (bio quality, links, specialization, engagement via AIP). Respond with strict JSON only: {"score": <int 0-100>, "summary": "<one or two encouraging sentences, max 240 chars, in the language of the bio or English>"}.',
        },
        { role: 'user', content: facts },
      ],
    }),
  })
  if (!groqRes.ok) {
    console.error('groq error', groqRes.status, await groqRes.text().catch(() => ''))
    return json(502, { error: 'ai_upstream' })
  }

  let score = 0
  let summary = ''
  try {
    const payload = await groqRes.json()
    const parsed = JSON.parse(payload.choices?.[0]?.message?.content ?? '{}')
    score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)))
    summary = String(parsed.summary ?? '').slice(0, 280)
  } catch {
    return json(502, { error: 'ai_unparseable' })
  }

  const { error: wErr } = await admin
    .from('profiles')
    .update({ ai_profile_score: score, ai_profile_summary: summary, ai_profile_at: new Date().toISOString() })
    .eq('id', profile.id)
  if (wErr) {
    console.error('write failed', wErr.message)
    return json(500, { error: 'write_failed' })
  }

  return json(200, { score, summary })
})
