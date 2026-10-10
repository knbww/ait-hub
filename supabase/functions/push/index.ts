// Web Push for AIT Hub. Called by the Hub right after an action — a work reviewed, a news post,
// a request to join a team — and once a day by GitHub Actions for tomorrow's deadline and events
// and for the deadlines of competitions members saved.
// Each call is checked: the caller must be whoever did the action (their session), the daily run
// must carry CRON_SECRET. Payloads say what happened and where to look; no contact data.
//
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET, SITE_URL.

import { createClient } from 'npm:@supabase/supabase-js@2.108.1'
import webpush from 'npm:web-push@3.6.7'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SITE = (Deno.env.get('SITE_URL') ?? 'https://hub.aitclub.org').replace(/\/+$/, '')
const TRACK_SHORT: Record<string, string> = { ai: 'ИИ', algo: 'Алгоритмы', startup: 'Стартап' }

/** The new key variables hold JSON like {"default": "sb_secret_…"}. */
function key(name: string): string {
  const raw = Deno.env.get(name) ?? ''
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'string') return parsed
    const first = Object.values(parsed ?? {})[0]
    return typeof first === 'string' ? first : ''
  } catch {
    return raw
  }
}

const admin = createClient(SUPABASE_URL, key('SUPABASE_SECRET_KEYS'), { auth: { persistSession: false } })
webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT') ?? SITE,
  Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
  Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

interface Message { title: string; body: string; url: string; tag: string }

async function send(profileIds: string[], message: Message): Promise<number> {
  const ids = [...new Set(profileIds.filter(Boolean))]
  if (!ids.length) return 0
  const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').in('profile_id', ids)
  let sent = 0
  await Promise.all((subs ?? []).map(async (s) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(message),
        { TTL: 60 * 60 * 24 },
      )
      sent++
      await admin.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('id', s.id)
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode
      // The browser dropped this subscription: forget it.
      if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('id', s.id)
      else console.error('push failed', status)
    }
  }))
  return sent
}

/** The caller's profile, read through their own session (null if the token isn't valid). */
async function caller(req: Request): Promise<string | null> {
  const authorization = req.headers.get('Authorization')
  if (!authorization) return null
  const client = createClient(SUPABASE_URL, key('SUPABASE_PUBLISHABLE_KEYS'), {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })
  const { data, error } = await client.rpc('current_profile_id')
  return error ? null : (data as string | null)
}

async function activeProfiles(track: string | null): Promise<string[]> {
  let query = admin.from('profiles').select('id').eq('status', 'active')
  if (track) query = query.or(`track_id.eq.${track},role.in.(director,curator)`)
  const { data } = await query
  return (data ?? []).map((p) => p.id as string)
}

async function onReview(me: string, submissionId: string) {
  const { data: s } = await admin
    .from('submissions')
    .select('profile_id, status, reviewer_id, week:program_weeks(week_number, title)')
    .eq('id', submissionId)
    .single()
  const week = s?.week as unknown as { week_number: number; title: string } | null
  if (!s || !week || s.reviewer_id !== me || !['accepted', 'needs_work'].includes(s.status)) return reply(403, { error: 'forbidden' })
  const accepted = s.status === 'accepted'
  const sent = await send([s.profile_id], {
    title: accepted ? 'Работа принята' : 'Работу вернули на доработку',
    body: `Неделя ${week.week_number} · ${week.title}${accepted ? '' : ' — посмотрите отзыв руководителя'}`,
    url: `${SITE}/program#week-${week.week_number}`,
    tag: `work-${submissionId}`,
  })
  return reply(200, { sent })
}

async function onNews(me: string, newsId: string) {
  const { data: n } = await admin.from('news').select('id, title, track_id, author_id, published_at').eq('id', newsId).single()
  // Only the author, and only a fresh post — an old one isn't re-announced.
  if (!n || n.author_id !== me || Date.now() - Date.parse(n.published_at) > 15 * 60 * 1000) return reply(403, { error: 'forbidden' })
  const recipients = (await activeProfiles(n.track_id)).filter((id) => id !== me)
  const sent = await send(recipients, {
    title: n.track_id ? `Новость · ${TRACK_SHORT[n.track_id] ?? ''}` : 'Новость клуба',
    body: n.title,
    url: `${SITE}/news#news-${n.id}`,
    tag: `news-${n.id}`,
  })
  return reply(200, { sent })
}

async function onTeamRequest(me: string, requestId: string) {
  const { data: r } = await admin
    .from('team_requests')
    .select('id, profile_id, status, team:teams(name, captain_id), member:profiles!team_requests_profile_id_fkey(full_name)')
    .eq('id', requestId)
    .single()
  const team = r?.team as unknown as { name: string; captain_id: string | null } | null
  const member = r?.member as unknown as { full_name: string } | null
  if (!r || !team?.captain_id || r.profile_id !== me || r.status !== 'pending') return reply(403, { error: 'forbidden' })
  const sent = await send([team.captain_id], {
    title: 'Заявка в команду',
    body: `${member?.full_name ?? 'Участник'} хочет в «${team.name}»`,
    url: `${SITE}/teams`,
    tag: `team-request-${r.id}`,
  })
  return reply(200, { sent })
}

/** Evening reminders (Petropavl time, UTC+5): tomorrow's deadline and tomorrow's events. */
async function daily() {
  const local = (offsetDays: number) => new Date(Date.now() + 5 * 3600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10)
  const tomorrow = local(1)
  let sent = 0

  // A week's work is due on its Sunday: the week that started six days before tomorrow.
  const weekStart = new Date(Date.parse(`${tomorrow}T00:00:00Z`) - 6 * 86_400_000).toISOString().slice(0, 10)
  const { data: weeks } = await admin.from('cohort_weeks').select('week_number').eq('starts_on', weekStart)
  for (const { week_number } of weeks ?? []) {
    const { data: programWeeks } = await admin.from('program_weeks').select('id, track_id, title').eq('week_number', week_number)
    for (const w of programWeeks ?? []) {
      if (w.title.trim().toLowerCase() === 'резерв') continue
      const { data: members } = await admin.from('profiles').select('id')
        .eq('track_id', w.track_id).eq('role', 'member').eq('status', 'active')
      const { data: handedIn } = await admin.from('submissions').select('profile_id').eq('week_id', w.id)
      const done = new Set((handedIn ?? []).map((s) => s.profile_id as string))
      sent += await send((members ?? []).map((m) => m.id as string).filter((id) => !done.has(id)), {
        title: 'Завтра срок сдачи',
        body: `Неделя ${week_number} · ${w.title}`,
        url: `${SITE}/program#week-${week_number}`,
        tag: `deadline-${w.id}`,
      })
    }
  }

  const from = new Date(`${tomorrow}T00:00:00+05:00`).toISOString()
  const to = new Date(Date.parse(from) + 86_400_000).toISOString()
  const { data: events } = await admin.from('events').select('id, title, track_id, starts_at, location')
    .eq('status', 'confirmed').gte('starts_at', from).lt('starts_at', to)
  for (const e of events ?? []) {
    const time = new Date(Date.parse(e.starts_at) + 5 * 3600_000).toISOString().slice(11, 16)
    sent += await send(await activeProfiles(e.track_id), {
      title: `Завтра: ${e.title}`,
      body: e.location ? `${time} · ${e.location}` : `в ${time}`,
      url: `${SITE}/calendar`,
      tag: `event-${e.id}`,
    })
  }

  // Competitions members marked «хочу участвовать»: three days before the deadline and the day before.
  const inThreeDays = local(3)
  const { data: due } = await admin.from('opportunities').select('id, title, deadline')
    .in('deadline', [tomorrow, inThreeDays]).eq('hidden', false)
  for (const o of due ?? []) {
    const { data: savers } = await admin.from('opportunity_saves')
      .select('profile_id, profile:profiles!inner(status)').eq('opportunity_id', o.id).eq('profile.status', 'active')
    const last = o.deadline === tomorrow
    sent += await send((savers ?? []).map((s) => s.profile_id as string), {
      title: last ? 'Завтра последний день подачи' : 'Через 3 дня закрывается приём',
      body: o.title,
      url: `${SITE}/opportunities/${o.id}`,
      tag: `opportunity-${o.id}-${last ? 1 : 3}`,
    })
  }
  return reply(200, { sent })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' })
  let body: Record<string, string> = {}
  try {
    body = await req.json()
  } catch {
    return reply(400, { error: 'bad_request' })
  }

  if (body.action === 'daily') {
    const secret = Deno.env.get('CRON_SECRET')
    if (!secret || req.headers.get('x-cron-secret') !== secret) return reply(401, { error: 'unauthorized' })
    return daily()
  }

  const me = await caller(req)
  if (!me) return reply(401, { error: 'unauthorized' })
  if (body.action === 'review' && body.submission_id) return onReview(me, body.submission_id)
  if (body.action === 'news' && body.news_id) return onNews(me, body.news_id)
  if (body.action === 'team_request' && body.request_id) return onTeamRequest(me, body.request_id)
  return reply(400, { error: 'bad_request' })
})
