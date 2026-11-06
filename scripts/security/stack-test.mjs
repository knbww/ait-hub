// Attacks a real local Supabase stack (GoTrue, PostgREST, Storage, Realtime) the way an intruder
// would — through the public API, with real sessions and real second factors. PGlite
// (scripts/db-test.mjs) proves the rules in SQL; this proves them end to end.
//
//   npx supabase start && npx supabase db reset
//   npm run test:stack
//
// Only ever runs against localhost: it creates and deletes accounts and it signs in as the demo
// staff from supabase/seed.sql.

import { createHmac } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const URL_ = process.env.STACK_URL ?? 'http://127.0.0.1:54321'
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(URL_)) throw new Error('stack-test runs against a local stack only')

const DB_CONTAINER = process.env.STACK_DB_CONTAINER ?? 'supabase_db_ait-hub'
const PASSWORD = 'demo-ait-2026'

const status = JSON.parse(execFileSync('npx', ['--no-install', 'supabase', 'status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }))
const KEY = status.PUBLISHABLE_KEY ?? status.ANON_KEY

const sql = (query) =>
  execFileSync('docker', ['exec', '-i', DB_CONTAINER, 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1', '-c', query], { encoding: 'utf8' }).trim()

let passed = 0
const failures = []
function check(name, ok, detail = '') {
  if (ok) passed++
  else failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${!ok && detail ? ` — ${detail}` : ''}`)
}

const client = () => createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } })

async function signIn(email, password = PASSWORD) {
  const c = client()
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`sign-in ${email}: ${error.message}`)
  return c
}

// RFC 6238, the code an authenticator app shows.
function totp(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const ch of secret.replace(/=+$/, '')) bits += alphabet.indexOf(ch).toString(2).padStart(5, '0')
  const key = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)))
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)))
  const hash = createHmac('sha1', key).update(counter).digest()
  const offset = hash[hash.length - 1] & 15
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0')
}

/** Adds an authenticator app; the client's session becomes aal2. Returns the shared secret. */
async function enrollTotp(c) {
  const { data, error } = await c.auth.mfa.enroll({ factorType: 'totp', friendlyName: `t-${Date.now()}` })
  if (error) throw new Error(`enroll: ${error.message}`)
  const verified = await c.auth.mfa.challengeAndVerify({ factorId: data.id, code: totp(data.totp.secret) })
  if (verified.error) throw new Error(`verify: ${verified.error.message}`)
  return { factorId: data.id, secret: data.totp.secret }
}

async function raiseToAal2(c, { factorId, secret }) {
  // A code is good once: wait for the next window when this one was just used.
  for (let i = 0; i < 3; i++) {
    const r = await c.auth.mfa.challengeAndVerify({ factorId, code: totp(secret) })
    if (!r.error) return
    await new Promise((resolve) => setTimeout(resolve, 11000))
  }
  throw new Error('could not raise the session to aal2')
}

const email = (like) => sql(`select mp.email from public.member_private mp join public.profiles p on p.id = mp.profile_id where ${like} limit 1`)
const profileIdOf = (mail) => sql(`select profile_id from public.member_private where email = '${mail}'`)

const directorEmail = 'director@demo.aitclub.org'
const curatorEmail = 'curator@demo.aitclub.org'
const leadEmail = 'lead.ai@demo.aitclub.org'
const memberEmail = 'aruzhan@demo.aitclub.org'
const otherMemberEmail = 'nikita@demo.aitclub.org'
const pendingEmail = email(`p.status = 'pending'`)
const inactiveEmail = email(`p.status = 'inactive'`)

// The demo database relaxes the staff second factor; here it must apply as in production.
try { sql(`delete from private.settings where key = 'mfa_optional'`) } catch { /* before the migration */ }
sql(`delete from auth.mfa_factors where user_id in (select id from auth.users where email like '%@demo.aitclub.org')`)
try { sql(`delete from private.rate_limits`) } catch { /* before the migration */ }

// ── 1. Unconfirmed and switched-off accounts ────────────────────────────────
console.log('\n1. Accounts that are not active')
{
  const project = sql(`select pm.project_id from public.project_members pm join public.profiles p on p.id = pm.profile_id
    where p.track_id = (select track_id from public.profiles where id = '${profileIdOf(pendingEmail)}') limit 1`)
  const victim = sql(`select profile_id from public.project_members where project_id = '${project}' limit 1`)
  const outsider = sql(`select id from public.profiles p where p.status = 'active' and p.role = 'member'
    and not exists (select 1 from public.project_members m where m.project_id = '${project}' and m.profile_id = p.id) limit 1`)
  const before = sql(`select count(*) from public.project_members where project_id = '${project}'`)

  for (const [label, mail] of [['pending', pendingEmail], ['inactive', inactiveEmail]]) {
    const c = await signIn(mail)
    const add = await c.rpc('add_project_member', { p_project: project, p_profile: outsider })
    const remove = await c.rpc('remove_project_member', { p_project: project, p_profile: victim })
    const now = sql(`select count(*) from public.project_members where project_id = '${project}'`)
    check(`${label} account cannot add a member to a project`, Boolean(add.error), 'call succeeded')
    check(`${label} account cannot remove a member from a project`, Boolean(remove.error), 'call succeeded')
    check(`${label} account changed nothing in the project`, now === before, `members ${before} → ${now}`)
    sql(`insert into public.project_members (project_id, profile_id) values ('${project}', '${victim}') on conflict do nothing`)
    sql(`delete from public.project_members where project_id = '${project}' and profile_id = '${outsider}'`)
  }
}

// ── 2. Curator → director takeover through a reset code ─────────────────────
console.log('\n2. Taking over an account above your own')
{
  const curator = await signIn(curatorEmail)
  await enrollTotp(curator)
  const directorProfile = profileIdOf(directorEmail)
  const code = await curator.rpc('create_reset_code', { p_profile: directorProfile })
  check('curator cannot issue a reset code for the director', Boolean(code.error), `got a code`)
  const lead = await curator.rpc('create_reset_code', { p_profile: profileIdOf(otherMemberEmail) })
  check('curator can still issue a code for a member', !lead.error, lead.error?.message)
  sql(`delete from public.password_reset_codes`)
  const unused = await curator.rpc('admin_set_password', { p_profile: profileIdOf(memberEmail), p_password: 'Sneaky-pass-12345' })
  check('nobody can set another person\'s password directly', Boolean(unused.error), 'admin_set_password worked')
  sql(`delete from auth.mfa_factors where user_id = (select id from auth.users where email = '${curatorEmail}')`)
}

// ── 3. A stolen password when the account has a second factor ───────────────
console.log('\n3. Stolen password, second factor on')
{
  const owner = await signIn(leadEmail)
  const factor = await enrollTotp(owner)
  const thief = await signIn(leadEmail) // aal1: password only
  const contacts = await thief.from('member_private').select('email')
  check('no contacts without the code', (contacts.data ?? []).length === 0, `${contacts.data?.length} rows`)
  const works = await thief.from('submissions').select('id')
  check('no works without the code', (works.data ?? []).length === 0, `${works.data?.length} rows`)
  const messages = await thief.from('messages').select('id')
  check('no chats without the code', (messages.data ?? []).length === 0, `${messages.data?.length} rows`)
  const members = await thief.from('profiles').select('id')
  check('only their own profile row without the code', (members.data ?? []).length === 1, `${members.data?.length} rows`)
  const award = await thief.rpc('award_points', { p_profile: profileIdOf(memberEmail), p_amount: 5, p_category: 'event', p_note: 'x' })
  check('no staff actions without the code', Boolean(award.error), 'points awarded')

  await raiseToAal2(thief, factor)
  const after = await thief.from('member_private').select('email')
  check('with the code a lead sees the contacts of their track', (after.data ?? []).length > 1, `${after.data?.length} rows`)
  sql(`delete from auth.mfa_factors where user_id = (select id from auth.users where email = '${leadEmail}')`)
}

// ── 4. Staff without a second factor ────────────────────────────────────────
console.log('\n4. Staff without a second factor')
{
  const director = await signIn(directorEmail)
  const contacts = await director.from('member_private').select('profile_id')
  check('director sees only their own contacts', (contacts.data ?? []).length === 1, `${contacts.data?.length} rows`)
  const audit = await director.from('audit_log').select('id').limit(5)
  check('director does not see the audit log', (audit.data ?? []).length === 0, `${audit.data?.length} rows`)
  const reports = await director.from('message_reports').select('id').limit(5)
  check('director does not see reports', (reports.data ?? []).length === 0, `${reports.data?.length} rows`)
  const codes = await director.from('join_codes').select('code')
  check('director does not see join codes', (codes.data ?? []).length === 0, `${codes.data?.length} rows`)
  const shift = await director.rpc('shift_schedule', { p_from_week: 30, p_days: 7 })
  check('director cannot move the schedule', /mfa_required/.test(shift.error?.message ?? ''), shift.error?.message ?? 'schedule moved')
  const track = await director.rpc('set_member_track', { p_profile: profileIdOf(memberEmail), p_track: 'algo' })
  check('director cannot move a member', /mfa_required/.test(track.error?.message ?? ''), track.error?.message ?? 'member moved')
  sql(`update public.profiles set track_id = 'ai' where id = '${profileIdOf(memberEmail)}'`)

  const lead = await signIn(leadEmail)
  const leadContacts = await lead.from('member_private').select('profile_id')
  check('a lead sees only their own contacts', (leadContacts.data ?? []).length === 1, `${leadContacts.data?.length} rows`)
  const refusals = await lead.rpc('photo_refusals')
  check('a lead still gets the names of those who refused photos', !refusals.error && (refusals.data ?? []).length > 0, refusals.error?.message)
  const leadWorks = await lead.from('submissions').select('id').limit(3)
  check('a lead still reviews works', (leadWorks.data ?? []).length > 0, leadWorks.error?.message)

  await enrollTotp(director)
  const full = await director.from('member_private').select('profile_id')
  check('director with the code sees everyone', (full.data ?? []).length > 20, `${full.data?.length} rows`)
  const auditFull = await director.from('audit_log').select('id').limit(5)
  check('director with the code sees the audit log', (auditFull.data ?? []).length > 0, `${auditFull.data?.length} rows`)
  sql(`delete from auth.mfa_factors where user_id = (select id from auth.users where email = '${directorEmail}')`)
}

// ── 5. A login left without a profile ───────────────────────────────────────
console.log('\n5. A session without a profile')
{
  const mail = 'orphan@demo.aitclub.org'
  sql(`insert into public.staff_invites (email, role, full_name, temp_password) values ('${mail}', 'curator', 'Сирота', 'Temp-pass-12345') on conflict (email) do nothing`)
  const c = client()
  const up = await c.auth.signUp({ email: mail, password: 'Temp-pass-12345' })
  if (up.error) throw new Error(`orphan sign-up: ${up.error.message}`)
  await signIn(mail, 'Temp-pass-12345').then((s) => s.auth.signOut({ scope: 'local' }))
  const orphan = await signIn(mail, 'Temp-pass-12345')
  sql(`delete from public.profiles where id = (select profile_id from public.member_private where email = '${mail}')`)
  await enrollTotp(orphan)
  const target = profileIdOf(memberEmail)
  const data = await orphan.rpc('export_member_data', { p_profile: target })
  check('no export of someone else\'s data', Boolean(data.error), 'export returned data')
  const team = sql(`select team_id from public.team_members limit 1`)
  const teamMember = sql(`select profile_id from public.team_members where team_id = '${team}' limit 1`)
  const removed = await orphan.rpc('remove_team_member', { p_team: team, p_profile: teamMember })
  check('cannot remove a team member', Boolean(removed.error), 'removed')
  sql(`insert into public.team_members (team_id, profile_id) values ('${team}', '${teamMember}') on conflict do nothing`)
  sql(`delete from auth.users where email = '${mail}'`)
}

// ── 6. Push endpoints ───────────────────────────────────────────────────────
console.log('\n6. Push')
{
  const c = await signIn(memberEmail)
  const bad = await c.rpc('register_push', { p_endpoint: 'https://attacker.example/collect', p_p256dh: 'a', p_auth: 'b' })
  check('a foreign address cannot be a push endpoint', Boolean(bad.error), 'registered')
  const ok = await c.rpc('register_push', { p_endpoint: 'https://fcm.googleapis.com/fcm/send/abc', p_p256dh: 'a', p_auth: 'b' })
  check('a real push service is accepted', !ok.error, ok.error?.message)
  sql(`delete from public.push_subscriptions`)
}

// ── 7. Storage ──────────────────────────────────────────────────────────────
console.log('\n7. Files')
{
  const profile = profileIdOf(memberEmail)
  const userId = sql(`select id from auth.users where email = '${memberEmail}'`)
  const c = await signIn(memberEmail)
  const blob = () => new Blob(['x'], { type: 'text/plain' })
  let accepted = 0
  for (let i = 0; i < 160; i++) {
    const { error } = await c.storage.from('works').upload(`${profile}/q${i}.txt`, blob(), { upsert: false })
    if (error) break
    accepted++
  }
  check('one member cannot fill the storage', accepted <= 150, `${accepted} files accepted`)
  await c.storage.from('works').remove(Array.from({ length: accepted }, (_, i) => `${profile}/q${i}.txt`))

  sql(`update public.member_private set photo_consent = false where profile_id = '${profile}'`)
  const png = new Blob([Buffer.from('iVBORw0KGgo=', 'base64')], { type: 'image/png' })
  const noConsent = await c.storage.from('avatars').upload(`${userId}/a.png`, png)
  check('no avatar without a yes to photos', Boolean(noConsent.error), 'uploaded')
  if (!noConsent.error) await c.storage.from('avatars').remove([`${userId}/a.png`])

  sql(`update public.member_private set photo_consent = true where profile_id = '${profile}'`)
  const up = await c.storage.from('avatars').upload(`${userId}/orphan.png`, png)
  check('a yes to photos allows an upload', !up.error, up.error?.message)
  const other = await signIn(otherMemberEmail)
  const peek = await other.storage.from('avatars').createSignedUrl(`${userId}/orphan.png`, 60)
  check('a photo not on a profile is not readable by others', Boolean(peek.error), 'signed url issued')
  const listing = await other.storage.from('avatars').list(userId)
  check('nobody lists someone else\'s photo folder', (listing.data ?? []).length === 0, `${listing.data?.length} files`)
  await c.storage.from('avatars').remove([`${userId}/orphan.png`])

  // The director's wipe needs the second factor too.
  const wiped = await c.storage.from('works').upload(`${profile}/keep.txt`, blob())
  if (wiped.error) throw new Error(wiped.error.message)
  const director = await signIn(directorEmail)
  await director.storage.from('works').remove([`${profile}/keep.txt`])
  const still = sql(`select count(*) from storage.objects where bucket_id = 'works' and name = '${profile}/keep.txt'`)
  check('director without the code cannot delete a member\'s work', still === '1', 'file deleted')
  await c.storage.from('works').remove([`${profile}/keep.txt`])
}

// ── 8. Email and passwords ──────────────────────────────────────────────────
console.log('\n8. Email and passwords')
{
  const c = await signIn(memberEmail)
  // Supabase Auth wants the change confirmed by mail even with email confirmation off.
  await c.auth.updateUser({ email: 'attacker@example.com' })
  await c.auth.updateUser({ email: 'attacker@example.com' })
  const nowEmail = sql(`select email from auth.users where id = (select user_id from public.profiles where id = '${profileIdOf(memberEmail)}')`)
  check('a session cannot change the account email', nowEmail === memberEmail, `email is now ${nowEmail}`)

  const anon = client()
  const lead = await signIn(leadEmail)
  await enrollTotp(lead)
  const issued = await lead.rpc('create_reset_code', { p_profile: profileIdOf(otherMemberEmail) })
  if (issued.error) throw new Error(`create_reset_code: ${issued.error.message}`)
  const victim = await signIn(otherMemberEmail)
  const newPassword = 'Новый-пароль-2026'
  const done = await anon.rpc('reset_password_with_code', { p_email: otherMemberEmail, p_code: issued.data, p_password: newPassword })
  check('a reset code sets the password', done.data === 'ok', JSON.stringify(done))
  const hash = sql(`select left(encrypted_password, 7) from auth.users where email = '${otherMemberEmail}'`)
  check('the new password is hashed at cost 10 or more', Number(hash.slice(4, 6)) >= 10, hash)
  await signIn(otherMemberEmail, newPassword)
  const stale = await victim.auth.refreshSession()
  check('old sessions are gone after a reset', Boolean(stale.error), 'old refresh token still works')
  sql(`update auth.users set encrypted_password = extensions.crypt('${PASSWORD}', extensions.gen_salt('bf', 10)) where email = '${otherMemberEmail}'`)
  sql(`delete from auth.mfa_factors where user_id = (select id from auth.users where email = '${leadEmail}')`)
}

// ── 9. Anonymous visitors ───────────────────────────────────────────────────
console.log('\n9. Anonymous visitors')
{
  const anon = client()
  const tables = sql(`select tablename from pg_tables where schemaname = 'public'`).split('\n')
  const open = []
  for (const table of tables) {
    const { data, error } = await anon.from(table).select('*').limit(1)
    if (!error && (data ?? []).length) open.push(table)
  }
  check('no table gives anything to a guest', open.length === 0, open.join(', '))
  const callable = sql(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute') order by 1`).split('\n')
  check('a guest can call exactly two functions', callable.join() === 'check_join_code,reset_password_with_code', callable.join())

  let limited = false
  for (let i = 0; i < 40 && !limited; i++) {
    const r = await anon.rpc('reset_password_with_code', { p_email: 'nobody@example.com', p_code: 'AAAAAAAA', p_password: 'Long-enough-pass-1' })
    if (r.data === 'slow_down') limited = true
  }
  check('guessing reset codes gets throttled', limited, 'never slowed down')
  sql(`delete from private.rate_limits`)
}

// ── 10. Live chat ───────────────────────────────────────────────────────────
console.log('\n10. Live chat')
{
  const subscribe = (c, topic) => new Promise((resolve) => {
    const channel = c.channel(topic, { config: { private: true } })
    const timer = setTimeout(() => resolve({ status: 'TIMED_OUT', channel }), 8000)
    channel
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {})
      .subscribe((status) => {
        if (['SUBSCRIBED', 'CHANNEL_ERROR', 'CLOSED'].includes(status)) {
          clearTimeout(timer)
          resolve({ status, channel })
        }
      })
  })
  const me = await signIn(memberEmail)
  const session = (await me.auth.getSession()).data.session
  await me.realtime.setAuth(session.access_token)
  const own = await subscribe(me, `chats-${profileIdOf(memberEmail)}`)
  check('a member joins their own private channel', own.status === 'SUBSCRIBED', own.status)
  const foreign = await subscribe(me, `chats-${profileIdOf(otherMemberEmail)}`)
  check('nobody joins someone else\'s private channel', foreign.status !== 'SUBSCRIBED', foreign.status)

  // A message reaches the member through the private channel, and nobody outside the chat.
  const conversation = sql(`select c.id from public.conversations c where c.kind = 'lead' and c.member_id = '${profileIdOf(memberEmail)}' limit 1`)
    || (await me.rpc('open_lead_chat')).data
  const outsider = await signIn('nursultan@demo.aitclub.org')
  await outsider.realtime.setAuth((await outsider.auth.getSession()).data.session.access_token)
  const seen = { member: 0, outsider: 0 }
  const listen = (c, topic, key) => new Promise((resolve) => {
    c.channel(topic, { config: { private: true } })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => { seen[key]++ })
      .subscribe((status) => { if (status === 'SUBSCRIBED') resolve() })
  })
  await me.removeAllChannels()
  await Promise.all([listen(me, `chats-${profileIdOf(memberEmail)}`, 'member'), listen(outsider, `chats-${profileIdOf('nursultan@demo.aitclub.org')}`, 'outsider')])
  await new Promise((resolve) => setTimeout(resolve, 1500))
  const sent = await me.from('messages').insert({ conversation_id: conversation, body: 'тест живых сообщений' })
  if (sent.error) throw new Error(`message: ${sent.error.message}`)
  await new Promise((resolve) => setTimeout(resolve, 3000))
  check('a live message reaches the member', seen.member === 1, `${seen.member} events`)
  check('a live message does not reach anyone outside the chat', seen.outsider === 0, `${seen.outsider} events`)
  await me.removeAllChannels()
  await outsider.removeAllChannels()
  me.realtime.disconnect()
  outsider.realtime.disconnect()
}

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) {
  console.log('\nFailed:')
  for (const f of failures) console.log(`  ✗ ${f}`)
  process.exitCode = 1
}
