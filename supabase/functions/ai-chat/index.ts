// ai-chat — the AIT Copilot. A JWT-gated streaming assistant grounded in the club's live data.
//
// React → this Edge Function (verifies the member's Supabase JWT) → Groq (OpenAI-compatible,
// streaming) → SSE piped straight back to the browser for a token-by-token reply. The GROQ_API_KEY
// never leaves the server. Provider-agnostic: swap the base URL/model to move off Groq later.

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, handleCors } from '../_shared/cors.ts'

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY') ?? ''
const GROQ_MODEL = Deno.env.get('GROQ_MODEL') ?? 'llama-3.3-70b-versatile'
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

// Curated knowledge base — the assistant's ground truth about how the club works.
const KB = `You are AIT Copilot, the assistant for AIT Hub — the operating system for an AI student club.
What you know:
- AIP is the club's points/reputation. Members earn it ONLY through verified actions: +10 attendance
  check-in (host-announced code), +20 a passed Academy assignment, +15 confirmed help on the Help board,
  and challenge prizes (1st/2nd/3rd = +100/+75/+50). Points can't be self-assigned; the Council can
  award or roll back AIP by hand. Display ranks by AIP: Участник (0), Специалист (500), Фаундер (1500);
  admins are the Совет.
- Academy runs in Seasons of weekly topics. Each week has materials, an assignment (submit a link),
  and self check-in with the host's meeting code. Hosts open attendance and review submissions.
- Challenges: the Council opens a challenge; members submit a result link; a jury scores entries and
  awards placed prizes.
- Teams (up to 4) form around a goal; the Help board lets members request and confirm help.
- Referrals: share your code; when a referred member reaches week 3 you get +40 AIP.`

type Msg = { role: 'user' | 'assistant'; content: string }

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  const preflight = handleCors(req)
  if (preflight) return preflight
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  // --- auth: members only ---
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return json(401, { error: 'unauthorized' })
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userRes, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !userRes?.user) return json(401, { error: 'unauthorized' })

  if (!GROQ_API_KEY) return json(503, { error: 'ai_unconfigured' })

  let parsed: { messages?: Msg[] }
  try {
    parsed = await req.json()
  } catch {
    return json(400, { error: 'invalid_json' })
  }
  const history = (parsed.messages ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-10)
  if (!history.length) return json(400, { error: 'no_messages' })

  // --- live grounding (public-read tables) ---
  let context = ''
  try {
    const { data: season } = await supabase
      .from('seasons')
      .select('title')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const { data: courses } = await supabase.from('courses').select('title').order('title').limit(20)
    if (season?.title) context += `Current active season: ${season.title}. `
    if (courses?.length) {
      context += `Course catalogue: ${courses.map((c: { title: string }) => c.title).join(', ')}.`
    }
  } catch {
    // grounding is best-effort — the assistant still answers from the KB if this fails.
  }

  const system = `${KB}

Live context: ${context || 'none available'}

Answer concisely and warmly. Reply in the user's language (Russian or English). Only answer about AIT
Hub and learning AI; if you don't know, say so briefly and suggest where to look in the app.`

  // --- stream from Groq, pipe SSE straight to the browser ---
  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GROQ_MODEL,
      stream: true,
      temperature: 0.4,
      max_tokens: 700,
      messages: [{ role: 'system', content: system }, ...history],
    }),
  })

  if (!groqRes.ok || !groqRes.body) {
    const detail = await groqRes.text().catch(() => '')
    console.error('groq upstream error', groqRes.status, detail)
    return json(502, { error: 'ai_upstream' })
  }

  return new Response(groqRes.body, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  })
})
