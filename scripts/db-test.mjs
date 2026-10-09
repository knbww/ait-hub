// Database tests without Docker: every migration runs on PGlite (Postgres compiled to WASM)
// inside a small Supabase-like shell (supabase/tests/bootstrap.sql), then the access rules are
// checked as an anonymous visitor, members and staff.
//
//   npm run test:db
//
// Two scenarios:
//   1. upgrade — the June schema + a prod-like snapshot, then the October migrations;
//   2. fresh   — all migrations on an empty database, then the access-rule checks;
//   3. seed    — all migrations + supabase/seed.sql (local development data) apply cleanly.

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = (path) => readFileSync(ROOT + path, 'utf8')
const MIGRATIONS = readdirSync(ROOT + 'supabase/migrations')
  .filter((f) => f.endsWith('.sql'))
  .sort()
const OCTOBER = '20261008'

let passed = 0
const failures = []

// pg_net isn't available in PGlite; the bootstrap provides a stand-in `net` schema.
const adapt = (sql) => sql.replace(/create extension if not exists pg_net;/gi, '-- pg_net: stubbed')

async function freshDb() {
  const db = new PGlite({ extensions: { pgcrypto } })
  await db.exec(read('supabase/tests/bootstrap.sql'))
  return db
}

// Each file in its own transaction, like `supabase db push`.
async function migrate(db, files) {
  for (const file of files) {
    try {
      await db.exec(`begin;\n${adapt(read(`supabase/migrations/${file}`))}\ncommit;`)
    } catch (e) {
      await db.exec('rollback').catch(() => {})
      throw new Error(`${file}: ${e.message}`)
    }
  }
}

// ── Running SQL as someone ──────────────────────────────────────────────────
async function become(db, who) {
  await db.exec('reset role')
  if (who === 'postgres') return
  const claims = who === 'anon' ? { role: 'anon' } : { sub: who, role: 'authenticated' }
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify(claims)])
  await db.exec(who === 'anon' ? 'set role anon' : 'set role authenticated')
}

async function run(db, who, sql, params = []) {
  await become(db, who)
  try {
    return await db.query(sql, params)
  } finally {
    await db.exec('reset role')
  }
}

const rows = async (db, who, sql, params) => (await run(db, who, sql, params)).rows
const value = async (db, who, sql, params) => {
  const r = await rows(db, who, sql, params)
  return r.length ? Object.values(r[0])[0] : undefined
}

function record(name, ok, detail) {
  if (ok) passed++
  else failures.push(`${name}${detail ? ` — ${detail}` : ''}`)
}

async function expectOk(name, db, who, sql, params) {
  try {
    await run(db, who, sql, params)
    record(name, true)
  } catch (e) {
    record(name, false, e.message)
  }
}

async function expectError(name, db, who, sql, params, pattern) {
  try {
    await run(db, who, sql, params)
    record(name, false, 'expected an error, got success')
  } catch (e) {
    record(name, pattern.test(e.message), `unexpected error: ${e.message}`)
  }
}

async function expectEqual(name, db, who, sql, params, expected) {
  try {
    const got = await value(db, who, sql, params)
    const same = JSON.stringify(got) === JSON.stringify(expected)
    record(name, same, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`)
  } catch (e) {
    record(name, false, e.message)
  }
}

// An UPDATE/DELETE that RLS silently filters out.
async function expectNoEffect(name, db, who, sql, params) {
  try {
    const r = await run(db, who, sql, params)
    record(name, (r.affectedRows ?? 0) === 0, `affected ${r.affectedRows} row(s)`)
  } catch (e) {
    record(name, false, e.message)
  }
}

const DENIED = /permission denied/
const RLS = /row-level security/
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── 1. Upgrade from the June production schema ──────────────────────────────
async function upgradeScenario() {
  const db = await freshDb()
  await migrate(db, MIGRATIONS.filter((f) => f < OCTOBER))
  await db.exec(read('supabase/tests/legacy_snapshot.sql'))
  await migrate(db, MIGRATIONS.filter((f) => f >= OCTOBER))

  const pg = 'postgres'
  await expectEqual('upgrade: only the three real accounts keep profiles', db, pg,
    'select count(*)::int from public.profiles', [], 3)
  await expectEqual('upgrade: admin becomes director', db, pg,
    `select role from public.profiles where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'`, [], 'director')
  await expectEqual('upgrade: members stay members', db, pg,
    `select count(*)::int from public.profiles where role = 'member'`, [], 2)
  await expectEqual('upgrade: photos cleared until consent is given', db, pg,
    'select count(*)::int from public.profiles where avatar_path is not null', [], 0)
  await expectEqual('upgrade: emails move to member_private', db, pg,
    'select count(*)::int from public.member_private where email is not null', [], 3)
  await expectEqual('upgrade: everyone is in the default cohort', db, pg,
    'select count(*)::int from public.profiles where cohort_id = public.default_cohort_id()', [], 3)
  await expectEqual('upgrade: dashboard layout kept', db, pg,
    'select count(*)::int from public.dashboard_layouts', [], 1)
  await expectEqual('upgrade: relay secrets removed from vault', db, pg,
    'select count(*)::int from vault.secrets', [], 0)
  await expectEqual('upgrade: avatars bucket is private', db, pg,
    `select public from storage.buckets where id = 'avatars'`, [], false)
  await expectEqual('upgrade: user_role enum dropped', db, pg,
    `select to_regtype('public.user_role') is null`, [], true)
  for (const table of [
    'applications', 'automation_errors', 'mentorship_bookings', 'xp_events', 'seasons', 'season_weeks',
    'challenges', 'challenge_entries', 'help_requests', 'courses', 'enrollments', 'research_papers',
    'resources', 'deadlines', 'skills', 'proof_of_work', 'github_stats', 'activity', 'week_meetings',
  ]) {
    await expectEqual(`upgrade: ${table} dropped`, db, pg, `select to_regclass('public.${table}') is null`, [], true)
  }
  for (const column of ['bio', 'referral_code', 'ai_profile_score', 'linkedin_url', 'university']) {
    await expectEqual(`upgrade: profiles.${column} dropped`, db, pg,
      `select count(*)::int from information_schema.columns
       where table_schema = 'public' and table_name = 'profiles' and column_name = $1`, [column], 0)
  }
  await expectEqual('upgrade: program has 3 × 36 weeks', db, pg,
    'select count(*)::int from public.program_weeks', [], 108)
  await expectEqual('upgrade: one active join code per track', db, pg,
    'select count(*)::int from public.join_codes where active', [], 3)
  await db.close()
}

// ── 2. Fresh database: sign-up and access rules ─────────────────────────────
const U = {
  dir: '10000000-0000-0000-0000-000000000001',
  cur: '10000000-0000-0000-0000-000000000002',
  leadAi: '10000000-0000-0000-0000-000000000003',
  leadAlgo: '10000000-0000-0000-0000-000000000004',
  ai1: '20000000-0000-0000-0000-000000000001',
  ai2: '20000000-0000-0000-0000-000000000002',
  ai3: '20000000-0000-0000-0000-000000000003',
  ai4: '20000000-0000-0000-0000-000000000004',
  ai5: '20000000-0000-0000-0000-000000000005',
  ai6: '20000000-0000-0000-0000-000000000006',
  algo1: '20000000-0000-0000-0000-000000000011',
  startup1: '20000000-0000-0000-0000-000000000021',
  inactive: '20000000-0000-0000-0000-000000000031',
}

async function freshScenario() {
  const db = await freshDb()
  await migrate(db, MIGRATIONS)
  const pg = 'postgres'

  const codes = Object.fromEntries(
    (await rows(db, pg, 'select track_id, code from public.join_codes where active')).map((r) => [r.track_id, r.code]),
  )
  const signUp = (id, email, meta) =>
    run(db, pg, 'insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)', [id, email, meta])
  const meta = (code, extra = {}) => ({ full_name: 'Тест', grade: 9, join_code: code, photo_consent: true, ...extra })
  const pid = async (uid) => value(db, pg, 'select id from public.profiles where user_id = $1', [uid])

  // Sign-up gate
  await expectError('signup: wrong code is rejected', db, pg,
    'insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)',
    ['30000000-0000-0000-0000-000000000001', 'x1@example.com', meta('NOPE1234')], /invalid_join_code/)
  await expectError('signup: no code is rejected', db, pg,
    'insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)',
    ['30000000-0000-0000-0000-000000000002', 'x2@example.com', { full_name: 'Тест', grade: 9 }], /invalid_join_code/)
  await expectError('signup: grade 6 is rejected', db, pg,
    'insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)',
    ['30000000-0000-0000-0000-000000000003', 'x3@example.com', meta(codes.ai, { grade: 6 })], /invalid_grade/)
  await expectError('signup: grade 13 is rejected', db, pg,
    'insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)',
    ['30000000-0000-0000-0000-000000000004', 'x4@example.com', meta(codes.ai, { grade: 13 })], /invalid_grade/)
  await expectError('signup: empty name is rejected', db, pg,
    'insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)',
    ['30000000-0000-0000-0000-000000000005', 'x5@example.com', meta(codes.ai, { full_name: '  ' })], /invalid_full_name/)

  await signUp(U.dir, 'dir@example.com', meta(codes.ai, { full_name: 'Директор' }))
  await signUp(U.cur, 'cur@example.com', meta(codes.algo, { full_name: 'Куратор', grade: 12 }))
  await signUp(U.leadAi, 'lead.ai@example.com', meta(codes.ai, { full_name: 'Лид ИИ', grade: 11 }))
  await signUp(U.leadAlgo, 'lead.algo@example.com', meta(codes.algo, { full_name: 'Лид Алго', grade: 11 }))
  for (const n of [1, 2, 3, 4, 5, 6]) {
    await signUp(U[`ai${n}`], `ai${n}@example.com`, meta(codes.ai.toLowerCase(), { full_name: `ИИ ${n}`, telegram: ' @ai_member ' }))
  }
  await signUp(U.algo1, 'algo1@example.com', meta(codes.algo, { full_name: 'Алго 1', photo_consent: false }))
  await signUp(U.startup1, 'startup1@example.com', meta(codes.startup, { full_name: 'Стартап 1' }))
  await signUp(U.inactive, 'inactive@example.com', meta(codes.ai, { full_name: 'Неактивный' }))

  await run(db, pg, `update public.profiles set role = 'director', track_id = null where user_id = $1`, [U.dir])
  await run(db, pg, `update public.profiles set role = 'curator', track_id = null where user_id = $1`, [U.cur])
  await run(db, pg, `update public.profiles set role = 'track_lead' where user_id in ($1, $2)`, [U.leadAi, U.leadAlgo])
  await run(db, pg, `update public.profiles set status = 'inactive' where user_id = $1`, [U.inactive])

  const P = {}
  for (const [k, uid] of Object.entries(U)) P[k] = await pid(uid)

  await expectEqual('signup: code puts the member into its track', db, pg,
    'select track_id from public.profiles where id = $1', [P.ai1], 'ai')
  await expectEqual('signup: lowercase code works', db, pg,
    'select grade from public.profiles where id = $1', [P.ai2], 9)
  await expectEqual('signup: telegram is normalised', db, pg,
    'select telegram from public.member_private where profile_id = $1', [P.ai1], 'ai_member')
  await expectEqual('signup: email kept privately', db, pg,
    'select email from public.member_private where profile_id = $1', [P.algo1], 'algo1@example.com')
  await expectEqual('signup: photo consent stored', db, pg,
    'select photo_consent from public.member_private where profile_id = $1', [P.algo1], false)

  // ── Anonymous visitor ─────────────────────────────────────────────────────
  const anon = 'anon'
  for (const table of ['profiles', 'member_private', 'points_entries', 'events', 'tracks', 'program_weeks',
    'submissions', 'teams', 'projects', 'rating_results', 'audit_log', 'join_codes', 'dashboard_layouts']) {
    await expectError(`anon: cannot read ${table}`, db, anon, `select * from public.${table}`, [], DENIED)
  }
  await expectError('anon: cannot call the leaderboard', db, anon, 'select * from public.points_leaderboard()', [], DENIED)
  await expectError('anon: cannot call track ratings', db, anon, `select * from public.track_rating('ai')`, [], DENIED)
  await expectEqual('anon: valid join code resolves to its track', db, anon,
    'select track_id from public.check_join_code($1)', [codes.startup], 'startup')
  await expectEqual('anon: unknown join code resolves to nothing', db, anon,
    'select count(*)::int from public.check_join_code($1)', ['ZZZZZZZZ'], 0)

  // ── Member ────────────────────────────────────────────────────────────────
  const m = U.ai1
  await expectEqual('member: sees active members only', db, m,
    'select count(*)::int from public.profiles', [], 12)
  await expectError('member: cannot change own role', db, m,
    `update public.profiles set role = 'director' where user_id = $1`, [m], DENIED)
  await expectError('member: cannot change own track', db, m,
    `update public.profiles set track_id = 'algo' where user_id = $1`, [m], DENIED)
  await expectError('member: cannot change own status', db, m,
    `update public.profiles set status = 'active' where user_id = $1`, [m], DENIED)
  await expectOk('member: edits own name and grade', db, m,
    `update public.profiles set full_name = ' ИИ Один ', grade = 10 where user_id = $1`, [m])
  await expectEqual('member: name is trimmed', db, pg,
    'select full_name from public.profiles where id = $1', [P.ai1], 'ИИ Один')
  await expectNoEffect('member: cannot edit someone else', db, m,
    `update public.profiles set full_name = 'x' where id = $1`, [P.ai2])
  await expectError('member: avatar must be own upload', db, m,
    `update public.profiles set avatar_path = $2 where user_id = $1`, [m, `${U.ai2}/avatar.png`], /avatar_path_foreign/)
  await expectOk('member: sets own avatar', db, m,
    `update public.profiles set avatar_path = $2 where user_id = $1`, [m, `${m}/avatar.png`])
  await expectOk('member: withdraws photo consent', db, m,
    'update public.member_private set photo_consent = false where profile_id = $1', [P.ai1])
  await expectEqual('member: no consent clears the photo', db, pg,
    'select avatar_path from public.profiles where id = $1', [P.ai1], null)
  await expectEqual('member: others cannot see the photo answer', db, U.ai2,
    'select count(*)::int from public.member_private where profile_id = $1', [P.ai1], 0)
  await expectError('member: profiles have no photo answer column', db, U.ai2,
    'select photo_consent from public.profiles limit 1', [], /does not exist/)
  await run(db, pg, 'update public.member_private set photo_consent = true where profile_id = $1', [P.ai1])
  await run(db, pg, 'update public.profiles set avatar_path = $2 where id = $1', [P.algo1, `${U.algo1}/a.png`])
  await expectEqual('member: avatar dropped when the answer is no', db, pg,
    'select avatar_path from public.profiles where id = $1', [P.algo1], null)
  await expectEqual('member: sees only own contacts', db, m,
    'select count(*)::int from public.member_private', [], 1)
  await expectOk('member: edits own telegram', db, m,
    `update public.member_private set telegram = '@new_name' where profile_id = $1`, [P.ai1])
  await expectError('member: cannot edit own email', db, m,
    `update public.member_private set email = 'x@example.com' where profile_id = $1`, [P.ai1], DENIED)
  await expectError('member: cannot award points', db, m,
    `select public.award_points($1, 10, 'extra_work', 'x')`, [P.ai2], /forbidden/)
  await expectError('member: cannot write the journal directly', db, m,
    `insert into public.points_entries (profile_id, amount, category, note) values ($1, 9999, 'extra_work', 'x')`,
    [P.ai1], DENIED)
  await expectEqual('member: no join codes visible', db, m, 'select count(*)::int from public.join_codes', [], 0)
  await expectEqual('member: no audit log visible', db, m, 'select count(*)::int from public.audit_log', [], 0)
  await expectError('member: cannot export members', db, m, 'select * from public.export_members()', [], /forbidden/)
  await expectOk('member: downloads own data', db, m, 'select public.export_member_data($1)', [P.ai1])
  await expectError('member: cannot download others\' data', db, m,
    'select public.export_member_data($1)', [P.ai2], /forbidden/)
  await expectError('member: cannot change roles', db, m,
    `select public.set_member_role($1, 'director')`, [P.ai1], /forbidden/)
  await expectError('member: cannot rotate join codes', db, m, `select public.rotate_join_code('ai')`, [], /forbidden/)
  await expectError('member: cannot mark attendance', db, m,
    `select public.set_attendance($1, (select id from public.program_weeks where track_id = 'ai' and week_number = 1), 'lesson', true)`,
    [P.ai2], /forbidden/)
  await expectError('member: cannot set the schedule', db, m, `select public.set_schedule('2026-10-05')`, [], /forbidden/)
  await expectEqual('inactive: sees only own profile', db, U.inactive,
    'select count(*)::int from public.profiles', [], 1)
  await expectEqual('inactive: sees no programme', db, U.inactive,
    'select count(*)::int from public.program_weeks', [], 0)

  // Works
  const aiWeek1 = await value(db, pg, `select id from public.program_weeks where track_id = 'ai' and week_number = 1`)
  const algoWeek1 = await value(db, pg, `select id from public.program_weeks where track_id = 'algo' and week_number = 1`)
  await expectOk('works: member submits a link', db, m,
    `select public.submit_work($1, 'https://colab.research.google.com/x', 'готово')`, [aiWeek1])
  await expectError('works: only own track weeks', db, m,
    `select public.submit_work($1, 'https://example.com')`, [algoWeek1], /wrong_track/)
  await expectError('works: link must be a URL', db, m,
    `select public.submit_work($1, 'javascript:alert(1)')`, [aiWeek1], /invalid_link/)
  await expectOk('works: algo member submits', db, U.algo1,
    `select public.submit_work($1, 'https://codeforces.com/x')`, [algoWeek1])
  await expectEqual('works: member sees only own work', db, U.ai2,
    'select count(*)::int from public.submissions', [], 0)
  const sub1 = await value(db, pg, 'select id from public.submissions where profile_id = $1', [P.ai1])
  const subAlgo = await value(db, pg, 'select id from public.submissions where profile_id = $1', [P.algo1])
  await expectError('works: member cannot review', db, U.ai2,
    `select public.review_work($1, 'accepted')`, [sub1], /forbidden/)

  // ── Track lead ────────────────────────────────────────────────────────────
  const l = U.leadAi
  // six active members + one deactivated, all in the AI track
  await expectEqual('lead: sees contacts of own track only', db, l,
    'select count(*)::int from public.member_private where profile_id <> $1', [P.leadAi], 7)
  await expectEqual('lead: no contacts of other tracks', db, l,
    'select count(*)::int from public.member_private where profile_id = $1', [P.algo1], 0)
  await expectOk('lead: reviews own-track work', db, l,
    `select public.review_work($1, 'needs_work', 'добавь README')`, [sub1])
  await expectError('lead: cannot review other tracks', db, l,
    `select public.review_work($1, 'accepted')`, [subAlgo], /forbidden/)
  await expectOk('lead: marks attendance', db, l,
    `select public.set_attendance($1, $2, 'lesson', true)`, [P.ai1, aiWeek1])
  await expectError('lead: attendance only for the member\'s track week', db, l,
    `select public.set_attendance($1, $2, 'lesson', true)`, [P.ai1, algoWeek1], /wrong_track/)
  await expectEqual('works: resubmission resets the review', db, pg,
    'select status from public.submissions where id = $1', [sub1], 'needs_work')
  await run(db, U.ai1, `select public.submit_work($1, 'https://colab.research.google.com/y')`, [aiWeek1])
  await expectEqual('works: resubmission resets the review (status)', db, pg,
    'select status || coalesce(feedback, \'-\') from public.submissions where id = $1', [sub1], 'submitted-')

  await expectOk('lead: awards points to own track', db, l,
    `select public.award_points($1, 15, 'required_work', 'Неделя 1')`, [P.ai1])
  await expectError('lead: cannot award other tracks', db, l,
    `select public.award_points($1, 15, 'required_work', 'x')`, [P.algo1], /forbidden/)
  await expectError('lead: cannot award self', db, l,
    `select public.award_points($1, 15, 'org_contribution', 'x')`, [P.leadAi], /forbidden|self_award/)
  await expectError('points: zero is rejected', db, l,
    `select public.award_points($1, 0, 'extra_work', 'x')`, [P.ai1], /check constraint/)
  await expectError('points: negative only as a correction', db, l,
    `select public.award_points($1, -5, 'extra_work', 'x')`, [P.ai1], /check constraint/)
  await expectOk('points: correction may be negative', db, l,
    `select public.award_points($1, -5, 'correction', 'ошибка')`, [P.ai1])
  await expectError('points: note is required', db, l,
    `select public.award_points($1, 5, 'extra_work', '  ')`, [P.ai1], /check constraint/)
  await expectError('points: journal entries cannot be edited', db, l,
    'update public.points_entries set amount = 100', [], DENIED)
  await expectError('points: journal entries cannot be deleted', db, l,
    'delete from public.points_entries', [], DENIED)
  await expectEqual('points: member sees own entries', db, m,
    'select count(*)::int from public.points_entries', [], 2)
  await expectEqual('points: other members don\'t see them', db, U.ai2,
    'select count(*)::int from public.points_entries', [], 0)
  await expectEqual('points: totals are visible to members', db, U.ai2,
    'select public.points_total($1)', [P.ai1], 10)
  await expectEqual('points: leaderboard ranks members, not staff', db, U.ai2,
    `select count(*)::int from public.points_leaderboard() where profile_id in ($1, $2, $3)`,
    [P.leadAi, P.dir, P.cur], 0)
  await expectEqual('points: leaderboard top is the awarded member', db, U.algo1,
    'select full_name from public.points_leaderboard() limit 1', [], 'ИИ Один')
  await expectEqual('points: leaderboard by track', db, U.algo1,
    `select count(*)::int from public.points_leaderboard('algo')`, [], 1)

  await expectEqual('lead: sees own track join code only', db, l,
    'select string_agg(track_id, \',\') from public.join_codes', [], 'ai')
  await expectOk('lead: rotates own track code', db, l, `select public.rotate_join_code('ai')`)
  await expectEqual('codes: old AI code no longer works', db, anon,
    'select count(*)::int from public.check_join_code($1)', [codes.ai], 0)
  await expectError('lead: cannot rotate other tracks', db, l, `select public.rotate_join_code('algo')`, [], /forbidden/)
  await expectOk('lead: edits own track materials', db, l,
    `update public.program_weeks set materials_url = 'https://drive.google.com/x' where id = $1`, [aiWeek1])
  await expectNoEffect('lead: cannot edit other track weeks', db, l,
    `update public.program_weeks set materials_url = 'https://drive.google.com/x' where id = $1`, [algoWeek1])
  await expectError('lead: cannot change roles', db, l,
    `select public.set_member_role($1, 'track_lead')`, [P.ai2], /forbidden/)
  await expectOk('lead: deactivates own-track member', db, l,
    `select public.set_member_status($1, 'inactive')`, [P.ai6])
  await expectError('lead: cannot deactivate other tracks', db, l,
    `select public.set_member_status($1, 'inactive')`, [P.algo1], /forbidden/)
  await run(db, pg, `update public.profiles set status = 'active' where id = $1`, [P.ai6])
  await expectEqual('lead: exports own track only', db, l,
    'select count(*)::int from public.export_members()', [], 7)
  await expectEqual('lead: no audit log', db, l, 'select count(*)::int from public.audit_log', [], 0)

  // ── Curator & director ────────────────────────────────────────────────────
  await expectOk('curator: awards any member', db, U.cur,
    `select public.award_points($1, 20, 'event', 'Воркшоп')`, [P.algo1])
  await expectEqual('curator: sees all contacts', db, U.cur,
    'select count(*)::int from public.member_private', [], 13)
  await expectError('curator: cannot change roles', db, U.cur,
    `select public.set_member_role($1, 'track_lead')`, [P.ai2], /forbidden/)
  await expectOk('director: promotes to lead', db, U.dir, `select public.set_member_role($1, 'track_lead')`, [P.ai5])
  await expectOk('director: demotes back', db, U.dir, `select public.set_member_role($1, 'member')`, [P.ai5])
  await expectError('director: keeps at least one director', db, U.dir,
    `select public.set_member_role($1, 'member')`, [P.dir], /last_director/)
  await expectError('director: password needs 8+ characters', db, U.dir,
    `select public.admin_set_password($1, 'short')`, [P.ai2], /weak_password/)
  await expectOk('director: sets a new password', db, U.dir,
    `select public.admin_set_password($1, 'новый-пароль-1')`, [P.ai2])
  await expectEqual('director: password is stored as bcrypt', db, pg,
    `select encrypted_password like '$2%' from auth.users where id = $1`, [U.ai2], true)
  await expectOk('director: builds the schedule', db, U.dir, `select public.set_schedule('2026-10-05', 30)`)
  await expectEqual('schedule: 30 weeks', db, U.ai1, 'select count(*)::int from public.cohort_weeks', [], 30)
  await expectOk('director: shifts the schedule for a holiday', db, U.dir, 'select public.shift_schedule(13, 7)')
  await expectEqual('schedule: week 13 moved a week', db, pg,
    'select starts_on::text from public.cohort_weeks where week_number = 13', [], '2027-01-04')
  await expectEqual('schedule: week 12 unchanged', db, pg,
    'select starts_on::text from public.cohort_weeks where week_number = 12', [], '2026-12-21')

  // ── Calendar & rating ─────────────────────────────────────────────────────
  const insertEvent = `insert into public.events (type, title, track_id, starts_at, is_rated, rules, status)
                       values ($1, $2, $3, now() + $4::interval, $5, $6, $7) returning id`
  await expectError('events: members cannot create events', db, m, insertEvent,
    ['workshop', 'x', 'ai', '1 day', false, null, 'draft'], RLS)
  await expectError('events: lead cannot create club-wide events', db, l, insertEvent,
    ['workshop', 'x', null, '1 day', false, null, 'draft'], RLS)
  await expectError('events: lead cannot create other tracks\' events', db, l, insertEvent,
    ['contest', 'x', 'algo', '1 day', true, 'правила', 'draft'], RLS)
  await expectError('events: a contest belongs to algorithms', db, U.dir, insertEvent,
    ['contest', 'x', 'ai', '1 day', true, 'правила', 'draft'], /events_type_track/)
  await expectError('events: only contests/tournaments/pitch reviews are rated', db, U.dir, insertEvent,
    ['workshop', 'x', null, '1 day', true, 'правила', 'draft'], /events_rated_type/)
  await expectError('events: rated events need rules', db, U.dir, insertEvent,
    ['tournament', 'x', 'ai', '1 day', true, null, 'draft'], /events_rated_rules/)
  await expectOk('events: lead drafts a tournament', db, l, insertEvent,
    ['tournament', 'Турнир', 'ai', '30 days', true, 'правила', 'draft'])
  await expectEqual('events: members don\'t see drafts', db, m, 'select count(*)::int from public.events', [], 0)
  await expectEqual('events: staff see drafts', db, U.leadAlgo, 'select count(*)::int from public.events', [], 1)
  await expectOk('events: director adds a club-wide workshop', db, U.dir, insertEvent,
    ['workshop', 'Воркшоп', null, '10 days', false, null, 'confirmed'])
  await expectEqual('events: members see confirmed events', db, m, 'select count(*)::int from public.events', [], 1)
  await expectError('events: past rated events can\'t be added as completed', db, U.dir, insertEvent,
    ['contest', 'Контест', 'algo', '-1 day', true, 'правила', 'completed'], /rules_not_announced_in_advance/)

  const contest = await value(db, U.leadAlgo, insertEvent,
    ['contest', 'Контест клуба', 'algo', '2 seconds', true, 'Codeforces, 5 задач', 'confirmed'])
  await expectEqual('rating: confirming stamps the rules', db, pg,
    'select rules_published_at < starts_at from public.events where id = $1', [contest], true)
  const result = `insert into public.rating_results (event_id, profile_id, place, score, rating_delta)
                  values ($1, $2, $3, $4, $5)`
  await expectError('rating: no results before the start', db, U.leadAlgo, result, [contest, P.algo1, 1, 5, 30], RLS)
  await sleep(2500)
  await expectError('rating: rules are frozen after the start', db, U.leadAlgo,
    `update public.events set rules = 'другие' where id = $1`, [contest], /rules_locked/)
  await expectError('rating: other tracks cannot enter results', db, l, result, [contest, P.algo1, 1, 5, 30], RLS)
  await expectOk('rating: lead enters results after the start', db, U.leadAlgo, result, [contest, P.algo1, 1, 5, 30])
  await expectEqual('rating: members don\'t see unpublished results', db, U.algo1,
    'select count(*)::int from public.rating_results', [], 0)
  await expectEqual('rating: no rating before publishing', db, U.algo1,
    `select count(*)::int from public.track_rating('algo')`, [], 0)
  await expectOk('rating: completing publishes', db, U.leadAlgo,
    `update public.events set status = 'completed' where id = $1`, [contest])
  await expectEqual('rating: published result counts', db, U.ai1,
    `select rating from public.track_rating('algo') where profile_id = $1`, [P.algo1], 30)
  await expectEqual('rating: tracks stay separate', db, U.ai1,
    `select count(*)::int from public.track_rating('ai')`, [], 0)
  await expectEqual('rating: AIT Points untouched', db, U.ai1,
    'select public.points_total($1)', [P.algo1], 20)
  await expectNoEffect('rating: published results are locked (no rows)', db, U.leadAlgo,
    'update public.rating_results set rating_delta = 300 where event_id = $1', [contest])
  await expectError('rating: only oversight reopens an event', db, U.leadAlgo,
    `update public.events set status = 'confirmed' where id = $1`, [contest], /forbidden/)

  // ── Teams ─────────────────────────────────────────────────────────────────
  const team = await value(db, U.ai1, `select public.create_team('Нейроны', 'турнир')`)
  await expectError('teams: one team per member', db, U.ai1, `select public.create_team('Вторая')`, [], /already_in_team/)
  for (const k of ['ai2', 'ai3', 'ai4', 'ai5']) {
    await run(db, U[k], 'select public.request_join_team($1)', [team])
    const req = await value(db, pg, 'select id from public.team_requests where team_id = $1 and profile_id = $2', [team, P[k]])
    await run(db, U.ai1, 'select public.respond_join_request($1, true)', [req])
  }
  await expectEqual('teams: five members', db, m, 'select count(*)::int from public.team_members where team_id = $1', [team], 5)
  await expectError('teams: a sixth member is refused', db, U.ai6, 'select public.request_join_team($1)', [team], /team_full/)
  await expectError('teams: limit holds even for staff', db, pg,
    'insert into public.team_members (team_id, profile_id) values ($1, $2)', [team, P.ai6], /team_full/)
  await expectError('teams: only own track', db, U.algo1, 'select public.request_join_team($1)', [team], /wrong_track/)
  await expectOk('teams: captain leaves', db, U.ai1, 'select public.remove_team_member($1, $2)', [team, P.ai1])
  await expectEqual('teams: captaincy passes on', db, pg, 'select captain_id from public.teams where id = $1', [team], P.ai2)

  // ── Projects ──────────────────────────────────────────────────────────────
  const project = await value(db, U.algo1,
    `select public.create_project('Бот расписания', 'Ученики не знают замены', 'Ученики 7–12 классов')`)
  await expectOk('projects: owner adds a member from another track', db, U.algo1,
    'select public.add_project_member($1, $2)', [project, P.ai1])
  await expectOk('projects: member writes own contribution', db, U.ai1,
    `update public.project_members set contribution = 'парсер' where project_id = $1 and profile_id = $2`, [project, P.ai1])
  await expectOk('projects: their lead confirms it', db, l, 'select public.confirm_contribution($1, $2)', [project, P.ai1])
  await expectError('projects: other leads cannot confirm', db, U.leadAlgo,
    'select public.confirm_contribution($1, $2)', [project, P.ai1], /forbidden/)
  await run(db, U.ai1, `update public.project_members set contribution = 'парсер и тесты' where project_id = $1 and profile_id = $2`, [project, P.ai1])
  await expectEqual('projects: editing withdraws the confirmation', db, pg,
    'select confirmed_at from public.project_members where project_id = $1 and profile_id = $2', [project, P.ai1], null)
  await expectNoEffect('projects: outsiders cannot edit', db, U.ai3,
    `update public.projects set title = 'x' where id = $1`, [project])
  await expectOk('projects: a member\'s lead can edit', db, U.leadAlgo,
    `update public.projects set status = 'done' where id = $1`, [project])

  // ── Storage ───────────────────────────────────────────────────────────────
  await expectOk('avatars: upload into own folder', db, U.ai1,
    `insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [`${U.ai1}/a.png`])
  await expectError('avatars: not into someone else\'s folder', db, U.ai1,
    `insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [`${U.ai2}/a.png`], RLS)
  await expectEqual('avatars: anonymous visitors see nothing', db, anon,
    `select count(*)::int from storage.objects where bucket_id = 'avatars'`, [], 0)

  // ── Exports, deletion, audit ──────────────────────────────────────────────
  await expectEqual('export: director sees everyone', db, U.dir, 'select count(*)::int from public.export_members()', [], 13)
  await expectOk('export: points', db, U.dir, 'select * from public.export_points()')
  await expectEqual('export: results include works and ratings', db, U.dir,
    `select count(*)::int from public.export_results() where kind in ('work', 'rating')`, [], 3)
  await expectEqual('export: member data has the journal', db, U.leadAi,
    `select jsonb_array_length(public.export_member_data($1) -> 'ait_points')`, [P.ai1], 2)
  await expectError('delete: only the director', db, l, 'select public.delete_member($1)', [P.ai3], /forbidden/)
  await expectEqual('delete: director removes a member and the login', db, U.dir,
    `select public.delete_member($1) ->> 'auth_deleted'`, [P.startup1], 'true')
  await expectEqual('delete: profile gone', db, pg, 'select count(*)::int from public.profiles where id = $1', [P.startup1], 0)
  await expectEqual('delete: contacts gone', db, pg, 'select count(*)::int from public.member_private where profile_id = $1', [P.startup1], 0)
  await expectEqual('delete: login gone', db, pg, 'select count(*)::int from auth.users where id = $1', [U.startup1], 0)
  await expectEqual('audit: staff actions are logged', db, U.cur,
    `select count(*)::int from public.audit_log
     where action in ('role_changed', 'password_reset', 'member_deleted', 'join_code_rotated', 'schedule_set',
                      'status_changed', 'event_completed', 'export_members')`, [], 10)

  await db.close()
}

// ── 3. Local seed ───────────────────────────────────────────────────────────
async function seedScenario() {
  const db = await freshDb()
  await migrate(db, MIGRATIONS)
  try {
    await db.exec(read('supabase/seed.sql'))
    record('seed: applies cleanly', true)
  } catch (e) {
    record('seed: applies cleanly', false, e.message)
  }
  await expectEqual('seed: a 36-week schedule', db, 'postgres', 'select count(*)::int from public.cohort_weeks', [], 36)
  await expectEqual('seed: one example event', db, 'postgres', 'select count(*)::int from public.events', [], 1)
  await db.close()
}

const started = Date.now()
try {
  await upgradeScenario()
  await freshScenario()
  await seedScenario()
} catch (e) {
  failures.push(`setup failed: ${e.message}`)
}

for (const f of failures) console.error(`  ✗ ${f}`)
console.log(`\n${passed} passed, ${failures.length} failed (${((Date.now() - started) / 1000).toFixed(1)}s)`)
process.exit(failures.length ? 1 : 0)
