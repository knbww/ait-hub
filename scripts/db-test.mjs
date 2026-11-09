// Database tests without Docker: every migration runs on PGlite (Postgres compiled to WASM)
// inside a small Supabase-like shell (supabase/tests/bootstrap.sql), then the access rules are
// checked as an anonymous visitor, members and staff.
//
//   npm run test:db
//
// Scenarios:
//   1. upgrade — the June schema + a prod-like snapshot, then the October migrations;
//   2. fresh   — all migrations on an empty database, then the content and access-rule checks;
//   3. seed    — all migrations + supabase/seed.sql (the demo club) apply cleanly;
//   4. staff   — staff accounts created in the dashboard (Authentication → Add user);
//   5. hardening — the second factor, limits, files and the rules every database object must keep;
//   6. recruitment — the «Join Our Team» applications: every option of the form, access, limits.

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import {
  AVAILABILITY_QUESTIONS, CONSENT_VERSION, DEPARTMENTS, DEPARTMENT_QUESTIONS, buildPayload, emptyForm,
} from '../src/lib/recruitment.ts'

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
// Sessions count as confirmed with a second factor (aal2) unless the id is prefixed `aal1:`.
async function become(db, who) {
  await db.exec('reset role')
  if (who === 'postgres') return
  if (who === 'service') {
    await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify({ role: 'service_role' })])
    await db.exec('set role service_role')
    return
  }
  const aal1 = typeof who === 'string' && who.startsWith('aal1:')
  const sub = aal1 ? who.slice(5) : who
  const claims = who === 'anon' ? { role: 'anon' } : { sub, role: 'authenticated', aal: aal1 ? 'aal1' : 'aal2' }
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify(claims)])
  await db.exec(who === 'anon' ? 'set role anon' : 'set role authenticated')
}
const noMfa = (uid) => `aal1:${uid}`

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

  // ── Programme content from the track calendars ───────────────────────────
  await expectEqual('content: every week has an assignment', db, pg,
    'select count(*)::int from public.program_weeks where assignment is not null', [], 108)
  await expectEqual('content: every week links to its Drive folder', db, pg,
    `select count(*)::int from public.program_weeks where materials_url like 'https://drive.google.com/drive/folders/%'`, [], 108)
  await expectEqual('content: each track links to its Drive folder', db, pg,
    `select count(*)::int from public.tracks where drive_url like 'https://drive.google.com/drive/folders/%'`, [], 3)
  await expectEqual('content: 36 weeks from Monday 5 October 2026', db, pg,
    `select min(starts_on)::text || ' / ' || max(starts_on)::text || ' / ' || count(*) from public.cohort_weeks`, [],
    '2026-10-05 / 2027-06-07 / 36')
  await expectEqual('content: competitions of the calendars wait as drafts', db, pg,
    `select count(*)::int from public.events where status = 'draft' and not is_rated`, [], 23)
  await expectEqual('content: a draft sits on its week\'s Monday', db, pg,
    `select starts_at = '2026-11-23 15:00+05' from public.events where title = 'Первый рейтинговый контест'`, [], true)
  await expectEqual('content: loading it writes nothing to the audit log', db, pg,
    'select count(*)::int from public.audit_log', [], 0)
  await expectEqual('progress: the twelve CS50 AI projects are milestones', db, pg,
    `select string_agg(milestone, ',' order by week_number) from public.program_weeks where track_id = 'ai'`, [],
    'Degrees,Tic-Tac-Toe,Knights,Minesweeper,Heredity,PageRank,Crossword,Shopping,Nim,Traffic,Parser,Attention')
  await expectEqual('content: one pinned welcome post', db, pg,
    'select count(*)::int from public.news where pinned and author_id is null', [], 1)
  await expectEqual('content: the catalog of competitions is loaded', db, pg,
    'select count(*)::int from public.opportunities where key is not null', [], 44)
  await expectEqual('content: one paused programme waits hidden', db, pg,
    'select string_agg(key, \',\') from public.opportunities where hidden', [], 'beginit')
  await expectEqual('content: every entry names its sources', db, pg,
    'select count(*)::int from public.opportunities where cardinality(sources) = 0', [], 0)
  await expectEqual('content: no leftovers of research notes', db, pg,
    `select count(*)::int from public.opportunities where notes ~ '^[0-9]' or notes ~ 'до дедлайна [0-9]+ д'`, [], 0)
  await expectEqual('content: loading it is idempotent', db, pg,
    `select count(distinct key)::int from public.opportunities`, [], 44)

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

  // Everyone who joins with a code waits for confirmation; the rest of the checks start with
  // them let in (the confirmation itself is checked at the end).
  await expectEqual('join: newcomers wait for confirmation', db, pg,
    `select count(*)::int from public.profiles where status = 'pending'`, [], 13)
  await run(db, pg, `update public.profiles set status = 'active' where status = 'pending'`)

  await run(db, pg, `update public.profiles set role = 'director', track_id = null where user_id = $1`, [U.dir])
  await run(db, pg, `update public.profiles set role = 'curator', track_id = null, grade = null where user_id = $1`, [U.cur])
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
    'submissions', 'teams', 'projects', 'rating_results', 'audit_log', 'join_codes', 'dashboard_layouts', 'news',
    'news_likes', 'news_comments', 'opportunities', 'opportunity_saves', 'conversations', 'messages',
    'conversation_reads', 'message_reports']) {
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
  // the 23 drafts from the track calendars + this one
  await expectEqual('events: staff see drafts', db, U.leadAlgo, 'select count(*)::int from public.events', [], 24)
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

  // ── Milestones ────────────────────────────────────────────────────────────
  await expectOk('progress: a lead renames a milestone of their track', db, l,
    `update public.program_weeks set milestone = 'Degrees (CS50)' where track_id = 'ai' and week_number = 5`)
  await expectNoEffect('progress: not of another track', db, l,
    `update public.program_weeks set milestone = 'x' where track_id = 'algo' and week_number = 5`)
  await expectNoEffect('progress: members cannot', db, m,
    `update public.program_weeks set milestone = 'x' where track_id = 'ai' and week_number = 5`)

  // ── News ──────────────────────────────────────────────────────────────────
  const insertNews = 'insert into public.news (title, body, track_id, pinned) values ($1, $2, $3, $4) returning id'
  await expectEqual('news: members read posts', db, m, 'select count(*)::int from public.news', [], 1)
  await expectEqual('news: deactivated members read nothing', db, U.inactive, 'select count(*)::int from public.news', [], 0)
  await expectError('news: members cannot post', db, m, insertNews, ['x', 'y', 'ai', false], RLS)
  await expectError('news: a lead cannot post for the whole club', db, l, insertNews, ['x', 'y', null, false], RLS)
  await expectError('news: a lead cannot post for another track', db, l, insertNews, ['x', 'y', 'algo', false], RLS)
  const leadPost = await value(db, l, insertNews, ['Турнир ботов', 'Правила в папке недели', 'ai', false])
  await expectEqual('news: the author is whoever posted', db, pg,
    'select author_id from public.news where id = $1', [leadPost], P.leadAi)
  await expectError('news: the author cannot be set by hand', db, l,
    'insert into public.news (title, body, track_id, author_id) values ($1, $2, $3, $4)', ['x', 'y', 'ai', P.dir], DENIED)
  await expectError('news: links must be https', db, l,
    'insert into public.news (title, body, track_id, link_url) values ($1, $2, $3, $4)', ['x', 'y', 'ai', 'http://x.kz'], /news_link_url_check/)
  const clubPost = await value(db, U.dir, insertNews, ['Хакатон', 'Записывайтесь до четверга', null, true])
  await expectNoEffect('news: a lead cannot edit a club-wide post', db, l,
    `update public.news set title = 'взлом' where id = $1`, [clubPost])
  await expectNoEffect('news: another track\'s lead cannot delete it', db, U.leadAlgo,
    'delete from public.news where id = $1', [leadPost])
  await expectNoEffect('news: members cannot delete posts', db, m, 'delete from public.news where id = $1', [leadPost])
  await expectOk('news: the lead edits own track\'s post', db, l,
    `update public.news set body = 'Правила и скрипт — в папке недели 8' where id = $1`, [leadPost])
  await expectEqual('news: editing keeps author and date', db, pg,
    'select author_id = $2 and published_at < updated_at from public.news where id = $1', [leadPost, P.leadAi], true)
  await expectOk('news: the curator removes any post', db, U.cur, 'delete from public.news where id = $1', [leadPost])
  await expectEqual('news: members see the rest', db, m, 'select count(*)::int from public.news', [], 2)

  // ── News: photos, likes, comments ─────────────────────────────────────────
  const photo = `insert into storage.objects (bucket_id, name) values ('news', $1)`
  const aiPost = await value(db, l, insertNews, ['Фото с практикума', 'Как это было', 'ai', false])
  await expectOk('news photos: the lead uploads into the post\'s folder', db, l, photo, [`${aiPost}/p1.webp`])
  await expectError('news photos: not into a post they can\'t edit', db, l, photo, [`${clubPost}/p1.webp`], RLS)
  await expectError('news photos: members cannot upload', db, m, photo, [`${aiPost}/p2.webp`], RLS)
  await expectError('news photos: not into a folder of no post', db, l, photo, ['whatever/p1.webp'], RLS)
  await expectOk('news photos: the lead attaches it to the post', db, l,
    'update public.news set photos = array[$2] where id = $1', [aiPost, `${aiPost}/p1.webp`])
  await expectError('news photos: only files of the post\'s own folder', db, l,
    'update public.news set photos = array[$2] where id = $1', [aiPost, `${clubPost}/p1.webp`], /invalid_photo_path/)
  await expectError('news photos: at most six', db, l,
    'update public.news set photos = array_fill($2::text, array[7]) where id = $1', [aiPost, `${aiPost}/p1.webp`], /news_photos_check/)
  await expectEqual('news photos: members see them', db, m,
    `select count(*)::int from storage.objects where bucket_id = 'news'`, [], 1)
  await expectEqual('news photos: deactivated members don\'t', db, U.inactive,
    `select count(*)::int from storage.objects where bucket_id = 'news'`, [], 0)
  await expectNoEffect('news photos: members cannot delete them', db, m, `delete from storage.objects where bucket_id = 'news'`)

  const like = 'insert into public.news_likes (news_id, profile_id) values ($1, $2)'
  await expectOk('likes: a member likes a post', db, m, like, [aiPost, P.ai1])
  await expectError('likes: once', db, m, like, [aiPost, P.ai1], /duplicate key/)
  await expectError('likes: not on someone else\'s behalf', db, m, like, [aiPost, P.ai2], RLS)
  await expectError('likes: deactivated members cannot', db, U.inactive, like, [aiPost, P.inactive], RLS)
  await run(db, U.algo1, like, [aiPost, P.algo1])
  await expectEqual('likes: everyone sees them', db, U.ai2,
    'select count(*)::int from public.news_likes where news_id = $1', [aiPost], 2)
  await expectNoEffect('likes: nobody takes back someone else\'s', db, U.dir,
    'delete from public.news_likes where news_id = $1 and profile_id = $2', [aiPost, P.ai1])
  await expectOk('likes: a member takes theirs back', db, m,
    'delete from public.news_likes where news_id = $1 and profile_id = $2', [aiPost, P.ai1])

  const comment = 'insert into public.news_comments (news_id, body) values ($1, $2) returning id'
  const c1 = await value(db, m, comment, [aiPost, '  Было круто!  '])
  await expectEqual('comments: the author is whoever wrote it, text trimmed', db, pg,
    'select author_id = $2 and body = $3 from public.news_comments where id = $1', [c1, P.ai1, 'Было круто!'], true)
  await expectError('comments: the author cannot be set by hand', db, m,
    'insert into public.news_comments (news_id, body, author_id) values ($1, $2, $3)', [aiPost, 'x', P.ai2], DENIED)
  await expectError('comments: not empty', db, m, comment, [aiPost, '   '], /news_comments_body_check/)
  await expectError('comments: deactivated members cannot write', db, U.inactive, comment, [aiPost, 'x'], RLS)
  const c2 = await value(db, U.algo1, comment, [aiPost, 'А где код?'])
  await expectEqual('comments: every member reads them', db, U.startup1,
    'select count(*)::int from public.news_comments where news_id = $1', [aiPost], 2)
  await expectNoEffect('comments: members cannot remove others\'', db, m, 'delete from public.news_comments where id = $1', [c2])
  await expectNoEffect('comments: nor can another track\'s lead', db, U.leadAlgo,
    'delete from public.news_comments where id = $1', [c1])
  await expectOk('comments: the post\'s lead removes one', db, l, 'delete from public.news_comments where id = $1', [c2])
  await expectEqual('comments: which is logged', db, U.cur,
    `select count(*)::int from public.audit_log where action = 'comment_removed' and target_id = $1`, [P.algo1], 1)
  await expectOk('comments: authors remove their own', db, m, 'delete from public.news_comments where id = $1', [c1])
  for (let i = 1; i <= 5; i++) await run(db, U.ai3, comment, [aiPost, `сообщение ${i}`])
  await expectError('comments: at most five a minute', db, U.ai3, comment, [aiPost, 'ещё одно'], /too_fast/)
  await expectOk('comments: the lead closes them', db, l, 'update public.news set allow_comments = false where id = $1', [aiPost])
  await expectError('comments: none under a closed post', db, U.ai2, comment, [aiPost, 'x'], /comments_closed/)
  await expectOk('news photos: the lead removes the file', db, l,
    `delete from storage.objects where bucket_id = 'news' and name = $1`, [`${aiPost}/p1.webp`])
  await expectOk('news: deleting a post', db, l, 'delete from public.news where id = $1', [aiPost])
  await expectEqual('news: takes its comments and likes along', db, pg,
    `select ((select count(*) from public.news_comments where news_id = $1)
           + (select count(*) from public.news_likes where news_id = $1))::int`, [aiPost], 0)
  await expectEqual('comments: only the moderator\'s removal was logged', db, pg,
    `select count(*)::int from public.audit_log where action = 'comment_removed'`, [], 1)

  // ── Files with a work ─────────────────────────────────────────────────────
  const workFile = `insert into storage.objects (bucket_id, name) values ('works', $1)`
  const countWorkFiles = `select count(*)::int from storage.objects where bucket_id = 'works'`
  const handIn = 'select public.submit_work($1, null, null, $2::jsonb)'
  const report = `${P.ai1}/k2f9-report.pdf`
  await expectOk('work files: a member uploads into own folder', db, m, workFile, [report])
  await expectError('work files: not into someone else\'s folder', db, m, workFile, [`${P.ai2}/x.pdf`], RLS)
  await expectError('work files: no programs', db, m, workFile, [`${P.ai1}/setup.exe`], RLS)
  await expectError('work files: no subfolders', db, m, workFile, [`${P.ai1}/a/b.pdf`], RLS)
  await expectError('work files: deactivated members cannot upload', db, U.inactive, workFile, [`${P.inactive}/x.pdf`], RLS)
  await run(db, U.ai2, workFile, [`${P.ai2}/notes.txt`])
  await expectEqual('work files: members see their own', db, m, countWorkFiles, [], 1)
  await expectEqual('work files: their lead sees the track\'s', db, l, countWorkFiles, [], 2)
  await expectEqual('work files: another track\'s lead sees none', db, U.leadAlgo, countWorkFiles, [], 0)
  await expectEqual('work files: the curator sees all', db, U.cur, countWorkFiles, [], 2)
  await expectOk('work files: handed in with a file and no link', db, m, handIn,
    [aiWeek1, JSON.stringify([{ path: report, name: ' Отчёт.pdf ', size: 120000 }])])
  await expectEqual('work files: kept on the work', db, pg,
    `select link is null and files -> 0 ->> 'name' = 'Отчёт.pdf' and status = 'submitted' from public.submissions where id = $1`,
    [sub1], true)
  await expectError('work files: only own files', db, m, handIn,
    [aiWeek1, JSON.stringify([{ path: `${P.ai2}/notes.txt`, name: 'n.txt', size: 10 }])], /invalid_file/)
  await expectError('work files: only uploaded files', db, m, handIn,
    [aiWeek1, JSON.stringify([{ path: `${P.ai1}/ghost.pdf`, name: 'g.pdf', size: 10 }])], /invalid_file/)
  await expectError('work files: at most three', db, m, handIn,
    [aiWeek1, JSON.stringify(Array(4).fill({ path: report, name: 'a.pdf', size: 1 }))], /too_many_files/)
  await expectError('work files: at most 5 MB', db, m, handIn,
    [aiWeek1, JSON.stringify([{ path: report, name: 'big.pdf', size: 6 * 1024 * 1024 }])], /invalid_file/)
  await expectError('work files: a link or a file', db, m, handIn, [aiWeek1, '[]'], /link_or_file/)
  await expectError('work files: no direct writes', db, m,
    `update public.submissions set files = '[]' where id = $1`, [sub1], DENIED)
  await expectNoEffect('work files: members cannot delete others\'', db, m,
    `delete from storage.objects where bucket_id = 'works' and name = $1`, [`${P.ai2}/notes.txt`])
  await expectNoEffect('work files: nor can their lead', db, l,
    `delete from storage.objects where bucket_id = 'works' and name = $1`, [`${P.ai2}/notes.txt`])
  await expectOk('work files: the director can (deleting a member\'s data)', db, U.dir,
    `delete from storage.objects where bucket_id = 'works' and name = $1`, [`${P.ai2}/notes.txt`])
  await expectEqual('work files: listed in the member\'s data download', db, m,
    `select public.export_member_data($1) -> 'works' -> 0 -> 'files' ->> 0`, [P.ai1], 'Отчёт.pdf')
  await run(db, U.ai1, `select public.submit_work($1, 'https://colab.research.google.com/y')`, [aiWeek1])
  await expectEqual('work files: a link-only resubmission clears them', db, pg,
    `select jsonb_array_length(files) from public.submissions where id = $1`, [sub1], 0)

  // ── Competitions and opportunities ────────────────────────────────────────
  const insertOpp = `insert into public.opportunities (title, kind, region, summary, url, tracks, deadline, sources)
                     values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`
  const oppArgs = (over = {}) => {
    const o = { title: 'Innopolis Open', kind: 'olympiad', region: 'online', summary: 'Олимпиада по информатике',
      url: 'https://dovuz.innopolis.university', tracks: '{algo}', deadline: '2026-10-19',
      sources: '{https://dovuz.innopolis.university}', ...over }
    return [o.title, o.kind, o.region, o.summary, o.url, o.tracks, o.deadline, o.sources]
  }
  await expectError('opportunities: members cannot add', db, m, insertOpp, oppArgs(), RLS)
  const opp = await value(db, l, insertOpp, oppArgs())
  await expectEqual('opportunities: the author is recorded', db, pg,
    'select created_by from public.opportunities where id = $1', [opp], P.leadAi)
  await expectError('opportunities: links must be https', db, l, insertOpp, oppArgs({ url: 'http://x.kz' }), /opportunities_url_check/)
  await expectError('opportunities: so must sources', db, l, insertOpp, oppArgs({ sources: '{http://x.kz}' }), /invalid_link/)
  await expectError('opportunities: only the club\'s tracks', db, l, insertOpp, oppArgs({ tracks: '{math}' }), /opportunities_tracks_check/)
  await expectError('opportunities: only known kinds', db, l, insertOpp, oppArgs({ kind: 'party' }), /opportunities_kind_check/)
  await expectEqual('opportunities: every member reads them', db, U.startup1,
    'select count(*)::int from public.opportunities where id = $1', [opp], 1)
  await expectEqual('opportunities: deactivated members don\'t', db, U.inactive,
    'select count(*)::int from public.opportunities', [], 0)
  await expectOk('opportunities: any lead updates them', db, U.leadAlgo,
    `update public.opportunities set deadline = '2026-10-20' where id = $1`, [opp])
  await expectNoEffect('opportunities: members cannot edit', db, m,
    `update public.opportunities set title = 'x' where id = $1`, [opp])
  await expectError('opportunities: the author cannot be changed', db, U.leadAlgo,
    'update public.opportunities set created_by = $2 where id = $1', [opp, P.leadAlgo], DENIED)
  await expectOk('opportunities: an entry can be hidden', db, l, 'update public.opportunities set hidden = true where id = $1', [opp])
  await expectEqual('opportunities: members no longer see it', db, m,
    'select count(*)::int from public.opportunities where id = $1', [opp], 0)
  await expectEqual('opportunities: staff still do', db, U.leadAlgo,
    'select count(*)::int from public.opportunities where id = $1', [opp], 1)
  await run(db, l, 'update public.opportunities set hidden = false where id = $1', [opp])

  const saveOpp = 'insert into public.opportunity_saves (opportunity_id, profile_id) values ($1, $2)'
  await expectOk('saves: a member marks one', db, m, saveOpp, [opp, P.ai1])
  await expectError('saves: not for someone else', db, m, saveOpp, [opp, P.ai2], RLS)
  await run(db, U.algo1, saveOpp, [opp, P.algo1])
  await expectEqual('saves: members see their own', db, m, 'select count(*)::int from public.opportunity_saves', [], 1)
  await expectEqual('saves: a lead sees their track\'s', db, l, 'select count(*)::int from public.opportunity_saves', [], 1)
  await expectEqual('saves: the curator sees everyone\'s', db, U.cur, 'select count(*)::int from public.opportunity_saves', [], 2)
  await expectEqual('saves: in the member\'s data download', db, m,
    `select public.export_member_data($1) -> 'saved_opportunities' -> 0 ->> 'title'`, [P.ai1], 'Innopolis Open')
  await expectNoEffect('saves: nobody removes another member\'s mark', db, U.dir,
    'delete from public.opportunity_saves where profile_id = $1', [P.ai1])
  await expectNoEffect('opportunities: a lead cannot delete another\'s entry', db, U.leadAlgo,
    'delete from public.opportunities where id = $1', [opp])
  await expectOk('opportunities: the author deletes it', db, l, 'delete from public.opportunities where id = $1', [opp])
  await expectEqual('saves: go with it', db, pg, 'select count(*)::int from public.opportunity_saves', [], 0)

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

  // ── Chats ─────────────────────────────────────────────────────────────────
  // The team «Нейроны» now has ai2–ai5 (ai1 left); the project «Бот расписания»: algo1 (owner), ai1.
  const write = 'insert into public.messages (conversation_id, body) values ($1, $2) returning id'
  const countIn = 'select count(*)::int from public.messages where conversation_id = $1'
  const teamChat = await value(db, U.ai2, 'select public.open_team_chat($1)', [team])
  await expectEqual('chats: opening again gives the same chat', db, U.ai3, 'select public.open_team_chat($1)', [team], teamChat)
  await expectError('chats: not for someone outside the team', db, U.ai6, 'select public.open_team_chat($1)', [team], /forbidden/)
  await expectEqual('chats: the track\'s lead takes part', db, l, 'select public.open_team_chat($1)', [team], teamChat)
  await expectError('chats: another track\'s lead does not', db, U.leadAlgo, 'select public.open_team_chat($1)', [team], /forbidden/)
  await expectError('chats: nor does the director', db, U.dir, 'select public.open_team_chat($1)', [team], /forbidden/)
  const msg1 = await value(db, U.ai2, write, [teamChat, '  Созвон в 18:00?  '])
  await expectEqual('chats: the author is whoever wrote, text trimmed', db, pg,
    'select author_id = $2 and body = $3 from public.messages where id = $1', [msg1, P.ai2, 'Созвон в 18:00?'], true)
  await expectError('chats: outsiders cannot write', db, U.ai6, write, [teamChat, 'привет'], RLS)
  await expectEqual('chats: outsiders read nothing', db, U.ai6, countIn, [teamChat], 0)
  await expectEqual('chats: the director reads nothing either', db, U.dir, countIn, [teamChat], 0)
  await expectEqual('chats: deactivated members neither', db, U.inactive, 'select count(*)::int from public.messages', [], 0)
  await expectError('chats: the author cannot be set by hand', db, U.ai3,
    'insert into public.messages (conversation_id, body, author_id) values ($1, $2, $3)', [teamChat, 'x', P.ai2], DENIED)
  await expectError('chats: no empty messages', db, U.ai3, write, [teamChat, '   '], /messages_body_check/)
  const msg2 = await value(db, U.ai3, write, [teamChat, 'Да, давай'])
  await expectEqual('chats: the inbox counts unread', db, U.ai2, 'select unread from public.my_conversations() where id = $1', [teamChat], 1)
  await expectOk('chats: opening marks it read', db, U.ai2, 'select public.mark_chat_read($1)', [teamChat])
  await expectEqual('chats: nothing unread then', db, U.ai2, 'select unread from public.my_conversations() where id = $1', [teamChat], 0)
  await expectEqual('chats: the inbox shows the last message and the team', db, U.ai4,
    `select last_body || ' / ' || name from public.my_conversations() where id = $1`, [teamChat], 'Да, давай / Нейроны')
  await expectError('chats: no read marks in others\' chats', db, U.ai6, 'select public.mark_chat_read($1)', [teamChat], /forbidden/)
  for (let i = 1; i <= 10; i++) await run(db, U.ai4, write, [teamChat, `сообщение ${i}`])
  await expectError('chats: at most ten messages a minute', db, U.ai4, write, [teamChat, 'ещё'], /too_fast/)

  const leadChat = await value(db, U.ai5, 'select public.open_lead_chat()')
  await run(db, U.ai5, write, [leadChat, 'Можно сдать неделю позже?'])
  await expectEqual('lead chat: the member\'s lead reads it', db, l, countIn, [leadChat], 1)
  await expectEqual('lead chat: so does the curator', db, U.cur, countIn, [leadChat], 1)
  await expectEqual('lead chat: other members do not', db, U.ai2, countIn, [leadChat], 0)
  await expectEqual('lead chat: nor does another track\'s lead', db, U.leadAlgo, countIn, [leadChat], 0)
  await expectEqual('lead chat: staff open it from their side', db, l, 'select public.open_lead_chat($1)', [P.ai5], leadChat)
  await expectError('lead chat: members cannot open someone else\'s', db, U.ai2, 'select public.open_lead_chat($1)', [P.ai5], /forbidden/)
  await expectError('lead chat: only members have one', db, U.dir, 'select public.open_lead_chat($1)', [P.leadAi], /not_found/)

  const projectChat = await value(db, U.algo1, 'select public.open_project_chat($1)', [project])
  await expectEqual('project chat: its members take part', db, U.ai1, 'select public.open_project_chat($1)', [project], projectChat)
  await expectEqual('project chat: so do the leads of their tracks', db, U.leadAlgo,
    'select public.open_project_chat($1)', [project], projectChat)
  await expectError('project chat: not other members', db, U.ai3, 'select public.open_project_chat($1)', [project], /forbidden/)

  const chatReport = await value(db, U.ai3, 'select public.report_message($1, $2)', [msg1, 'грубо'])
  await expectError('reports: not one\'s own message', db, U.ai2, 'select public.report_message($1)', [msg1], /forbidden/)
  await expectError('reports: only participants', db, U.ai6, 'select public.report_message($1)', [msg1], /forbidden/)
  await expectEqual('reports: the director sees the copy without reading the chat', db, U.dir,
    'select excerpt from public.message_reports where id = $1', [chatReport], 'Созвон в 18:00?')
  await expectEqual('reports: the reporter sees theirs', db, U.ai3, 'select status from public.message_reports where id = $1', [chatReport], 'open')
  await expectEqual('reports: nobody else does', db, U.ai2, 'select count(*)::int from public.message_reports', [], 0)
  await expectError('reports: only director / curator resolve them', db, l, 'select public.resolve_report($1, true)', [chatReport], /forbidden/)
  await expectOk('reports: the curator removes the message', db, U.cur, 'select public.resolve_report($1, true)', [chatReport])
  await expectEqual('reports: it is gone', db, pg, 'select count(*)::int from public.messages where id = $1', [msg1], 0)
  await expectEqual('reports: the report keeps the copy', db, pg,
    `select status || ':' || excerpt from public.message_reports where id = $1`, [chatReport], 'removed:Созвон в 18:00?')
  await expectNoEffect('chats: members cannot remove others\' messages', db, U.ai4,
    'delete from public.messages where conversation_id = $1 and author_id <> $2', [teamChat, P.ai4])
  await expectOk('chats: a lead removes one in their track\'s chat', db, l, 'delete from public.messages where id = $1', [msg2])
  await expectOk('chats: authors remove their own', db, U.ai4,
    'delete from public.messages where conversation_id = $1 and author_id = $2', [teamChat, P.ai4])
  await expectEqual('chats: only others\' removals are logged', db, pg,
    `select count(*)::int from public.audit_log where action = 'message_removed'`, [], 2)

  // ── Storage ───────────────────────────────────────────────────────────────
  await expectOk('avatars: upload into own folder', db, U.ai1,
    `insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [`${U.ai1}/a.png`])
  await expectError('avatars: not into someone else\'s folder', db, U.ai1,
    `insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [`${U.ai2}/a.png`], RLS)
  await expectEqual('avatars: anonymous visitors see nothing', db, anon,
    `select count(*)::int from storage.objects where bucket_id = 'avatars'`, [], 0)

  // ── Push notifications ────────────────────────────────────────────────────
  const endpoint = 'https://fcm.googleapis.com/fcm/send/device-1'
  await expectOk('push: a member registers a device', db, m, 'select public.register_push($1, $2, $3, $4)',
    [endpoint, 'p256dh-key', 'auth-key', 'test browser'])
  await expectEqual('push: they see their device', db, m, 'select count(*)::int from public.push_subscriptions', [], 1)
  await expectEqual('push: nobody else does', db, U.ai2, 'select count(*)::int from public.push_subscriptions', [], 0)
  await expectEqual('push: not even staff', db, U.dir, 'select count(*)::int from public.push_subscriptions', [], 0)
  await expectOk('push: a shared computer changes hands', db, U.ai2, 'select public.register_push($1, $2, $3)',
    [endpoint, 'p256dh-key-2', 'auth-key-2'])
  await expectEqual('push: the device now belongs to the new user', db, pg,
    'select profile_id from public.push_subscriptions where endpoint = $1', [endpoint], P.ai2)
  await expectError('push: no direct writes', db, m, 'delete from public.push_subscriptions', [], DENIED)
  await expectOk('push: removing a device', db, U.ai2, 'select public.unregister_push($1)', [endpoint])
  await expectEqual('push: gone', db, pg, 'select count(*)::int from public.push_subscriptions', [], 0)
  await expectError('push: guests cannot register', db, anon, 'select public.register_push($1, $2, $3)', [endpoint, 'a', 'b'], DENIED)
  await expectError('push: endpoints must be https', db, m, 'select public.register_push($1, $2, $3)', ['http://x.kz', 'a', 'b'], /invalid_push_endpoint/)
  await expectError('push: only the browsers\' own push services', db, m, 'select public.register_push($1, $2, $3)',
    ['https://evil.example/collect', 'a', 'b'], /invalid_push_endpoint/)
  await expectError('push: a look-alike host is refused', db, m, 'select public.register_push($1, $2, $3)',
    ['https://fcm.googleapis.com.evil.example/x', 'a', 'b'], /invalid_push_endpoint/)
  for (const url of ['https://updates.push.services.mozilla.com/wpush/v2/x', 'https://web.push.apple.com/x',
    'https://wns2-par02p.notify.windows.com/w/?token=x']) {
    await expectEqual(`push: ${new URL(url).host} is accepted`, db, m, 'select public.is_push_endpoint($1)', [url], true)
  }

  // ── Second factor and API surface ─────────────────────────────────────────
  await expectError('mfa: exports need a second factor', db, noMfa(U.dir), 'select * from public.export_members()', [], /mfa_required/)
  await expectError('mfa: so do points exports', db, noMfa(U.cur), 'select * from public.export_points()', [], /mfa_required/)
  await expectError('mfa: role changes need it', db, noMfa(U.dir),
    `select public.set_member_role($1, 'track_lead')`, [P.ai4], /mfa_required/)
  await expectError('mfa: deletion needs it', db, noMfa(U.dir), 'select public.delete_member($1)', [P.ai6], /mfa_required/)
  await expectError('mfa: a lead downloading a member\'s data needs it', db, noMfa(l),
    'select public.export_member_data($1)', [P.ai2], /mfa_required/)
  await expectOk('mfa: members download their own data without it', db, noMfa(m), 'select public.export_member_data($1)', [P.ai1])
  await expectError('mfa: forbidden comes before the second factor', db, noMfa(m),
    'select * from public.export_members()', [], /forbidden/)
  await expectError('api: trigger functions can\'t be called', db, m, 'select public.handle_new_user()', [], DENIED)
  await expectError('api: the second-factor check isn\'t callable either', db, m, 'select public.require_mfa()', [], DENIED)
  await expectEqual('api: the old access-token hook is gone', db, pg,
    `select to_regprocedure('public.custom_access_token_hook(jsonb)') is null`, [], true)
  await expectOk('layout: a member saves their dashboard', db, m,
    `insert into public.dashboard_layouts (profile_id, layout) values ($1, '[]'::jsonb)
     on conflict (profile_id) do update set layout = excluded.layout`, [P.ai1])
  await expectError('layout: not someone else\'s', db, m,
    `insert into public.dashboard_layouts (profile_id, layout) values ($1, '[]'::jsonb)`, [P.ai2], RLS)

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
     where action in ('role_changed', 'member_deleted', 'join_code_rotated', 'schedule_set',
                      'status_changed', 'event_completed', 'export_members')`, [], 9)

  // ── Joining: codes end, newcomers wait ────────────────────────────────────
  const signUpSql = 'insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)'
  const aiCode = await value(db, pg, `select code from public.join_codes where track_id = 'ai' and active`)
  const late = '30000000-0000-0000-0000-0000000000a1'
  await signUp(late, 'late@example.com', meta(aiCode, { full_name: 'Новичок' }))
  const lateP = await pid(late)
  await expectEqual('join: a newcomer is pending', db, pg, 'select status from public.profiles where id = $1', [lateP], 'pending')
  await expectEqual('join: and sees only themselves', db, late, 'select count(*)::int from public.profiles', [], 1)
  await expectEqual('join: no news, no calendar', db, late,
    'select ((select count(*) from public.news) + (select count(*) from public.events))::int', [], 0)
  await run(db, pg, `update public.profiles set role = 'track_lead' where id = $1`, [lateP])
  await expectError('codes: an unconfirmed lead cannot replace them', db, late, `select public.rotate_join_code('ai')`, [], /forbidden/)
  await run(db, pg, `update public.profiles set role = 'member' where id = $1`, [lateP])
  await expectEqual('join: members don\'t see them yet', db, U.ai2, 'select count(*)::int from public.profiles where id = $1', [lateP], 0)
  await expectEqual('join: their lead does', db, l, 'select count(*)::int from public.profiles where id = $1', [lateP], 1)
  await expectError('join: another track\'s lead cannot let them in', db, U.leadAlgo, 'select public.decide_join($1, true)', [lateP], /forbidden/)
  await expectError('join: nor can members', db, U.ai2, 'select public.decide_join($1, true)', [lateP], /forbidden/)
  await expectOk('join: their lead lets them in', db, l, 'select public.decide_join($1, true)', [lateP])
  await expectEqual('join: now everyone sees them', db, U.ai2, 'select count(*)::int from public.profiles where id = $1', [lateP], 1)
  await expectError('join: only pending ones', db, l, 'select public.decide_join($1, false)', [lateP], /not_pending/)
  await expectEqual('join: the decision is logged', db, U.cur,
    `select count(*)::int from public.audit_log where action = 'join_approved' and target_id = $1`, [lateP], 1)
  await expectEqual('codes: sign-ups are counted', db, pg, 'select uses from public.join_codes where code = $1', [aiCode], 1)
  await run(db, pg, `update public.join_codes set expires_at = now() - interval '1 minute' where code = $1`, [aiCode])
  await expectEqual('codes: an expired code resolves to nothing', db, 'anon', 'select count(*)::int from public.check_join_code($1)', [aiCode], 0)
  await expectError('codes: and lets nobody in', db, pg, signUpSql,
    ['30000000-0000-0000-0000-0000000000a2', 'x6@example.com', meta(aiCode)], /invalid_join_code/)
  const limited = await value(db, l, `select public.rotate_join_code('ai', 7, 1)`)
  await expectEqual('codes: a new code ends when told', db, pg,
    `select expires_at::date - now()::date from public.join_codes where code = $1`, [limited], 7)
  await expectOk('codes: a limited code lets one in', db, pg, signUpSql,
    ['30000000-0000-0000-0000-0000000000a3', 'x7@example.com', meta(limited)])
  await expectError('codes: and then runs out', db, pg, signUpSql,
    ['30000000-0000-0000-0000-0000000000a4', 'x8@example.com', meta(limited)], /invalid_join_code/)
  await expectError('codes: terms are checked', db, l, `select public.rotate_join_code('ai', 120)`, [], /invalid_code_terms/)

  // ── A forgotten password: a one-time code ─────────────────────────────────
  const resetSql = 'select public.reset_password_with_code($1, $2, $3)'
  await expectError('reset: members cannot issue codes', db, U.ai3, 'select public.create_reset_code($1)', [P.ai2], /forbidden/)
  await expectError('reset: nor another track\'s lead', db, U.leadAlgo, 'select public.create_reset_code($1)', [P.ai2], /forbidden/)
  await expectError('reset: a code needs the second factor', db, noMfa(l), 'select public.create_reset_code($1)', [P.ai2], /mfa_required/)
  const resetCode = await value(db, l, 'select public.create_reset_code($1)', [P.ai2])
  await expectEqual('reset: only a hash is kept', db, pg,
    'select code_hash <> $2 and code_hash like $3 from public.password_reset_codes where profile_id = $1', [P.ai2, resetCode, '$2%'], true)
  await expectError('reset: nobody reads the codes', db, l, 'select * from public.password_reset_codes', [], DENIED)
  await expectEqual('reset: a wrong code is refused', db, 'anon', resetSql, ['ai2@example.com', 'WRONG234', 'новый-пароль-1'], 'invalid')
  await expectEqual('reset: an unknown email looks the same', db, 'anon', resetSql, ['nobody@example.com', resetCode, 'новый-пароль-1'], 'invalid')
  await expectError('reset: the new password needs 10+ characters', db, 'anon', resetSql, ['ai2@example.com', resetCode, 'short'], /weak_password/)
  await expectEqual('reset: the right code works (any case)', db, 'anon', resetSql,
    [' AI2@example.com ', resetCode.toLowerCase(), 'новый-пароль-1'], 'ok')
  await expectEqual('reset: the password is the member\'s own', db, pg,
    `select encrypted_password = extensions.crypt('новый-пароль-1', encrypted_password) from auth.users where id = $1`, [U.ai2], true)
  await expectEqual('reset: the code is used up', db, 'anon', resetSql, ['ai2@example.com', resetCode, 'другой-пароль-2'], 'invalid')
  const resetCode2 = await value(db, l, 'select public.create_reset_code($1)', [P.ai2])
  for (let i = 1; i <= 5; i++) await value(db, 'anon', resetSql, ['ai2@example.com', `WRONG00${i}`, 'новый-пароль-3'])
  await expectEqual('reset: five wrong tries cancel the code', db, 'anon', resetSql, ['ai2@example.com', resetCode2, 'новый-пароль-3'], 'invalid')
  await expectEqual('reset: issuing a code is logged', db, U.cur,
    `select count(*)::int from public.audit_log where action = 'reset_code_issued' and target_id = $1`, [P.ai2], 2)

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
  const pg = 'postgres'
  await expectEqual('seed: 31 demo accounts with profiles', db, pg,
    `select count(*)::int from public.profiles p join auth.users u on u.id = p.user_id where u.email like '%@demo.aitclub.org'`, [], 31)
  await expectEqual('seed: one newcomer waits for the lead', db, pg,
    `select string_agg(full_name, ',') from public.profiles where status = 'pending'`, [], 'Ерасыл Нуриев')
  await expectEqual('seed: staff roles', db, pg,
    `select string_agg(role, ',' order by role) from public.profiles where role <> 'member'`, [], 'curator,director,track_lead,track_lead,track_lead')
  await expectEqual('seed: every account can sign in by email', db, pg,
    `select count(*)::int from auth.identities where provider = 'email'`, [], 31)
  await expectEqual('seed: the demo year is at week 17', db, pg,
    `select week_number from public.cohort_weeks where starts_on = date_trunc('week', current_date)::date`, [], 17)
  await expectEqual('seed: works in every past week', db, pg,
    `select count(distinct w.week_number)::int from public.submissions s join public.program_weeks w on w.id = s.week_id`, [], 17)
  await expectEqual('seed: rated results published', db, pg,
    `select count(distinct r.event_id)::int from public.rating_results r join public.events e on e.id = r.event_id
     where e.status = 'completed'`, [], 5)
  await expectEqual('seed: the rules came before every rated event', db, pg,
    `select bool_and(rules_published_at < starts_at) from public.events where is_rated and status <> 'draft'`, [], true)
  await expectEqual('seed: teams within the limit', db, pg,
    'select max(n)::int from (select count(*) as n from public.team_members group by team_id) t', [], 3)
  await expectEqual('seed: AIT Points journal', db, pg,
    `select count(*) > 200 from public.points_entries`, [], true)
  await expectEqual('seed: news from staff', db, pg, 'select count(*)::int from public.news', [], 8)
  await expectEqual('seed: members like the news', db, pg, 'select count(*) > 40 from public.news_likes', [], true)
  await expectEqual('seed: and talk under it', db, pg, 'select count(*) >= 7 from public.news_comments', [], true)
  await expectEqual('seed: members mark competitions', db, pg, 'select count(*)::int from public.opportunity_saves', [], 12)
  await expectEqual('seed: three chats with messages', db, pg,
    'select count(*)::int from public.conversations where last_message_at is not null', [], 3)
  await expectEqual('seed: the calendar drafts were replaced', db, pg,
    `select count(*)::int from public.events where title = 'Демо' or description like 'Черновик из календаря курса%'`, [], 0)
  await expectEqual('seed: team applications at every stage but one', db, pg,
    `select count(*)::int * 10 + count(distinct status)::int from public.team_applications`, [], 117)
  await expectEqual('seed: the demo round is open now', db, pg, `select private.recruitment_open()`, [], true)
  await expectEqual('seed: nothing logged by the seed itself', db, pg,
    `select count(*)::int from public.audit_log where actor_id is null`, [], 0)
  try {
    await db.exec(read('supabase/seed.sql'))
    record('seed: refuses a database that has members', false, 'it ran a second time')
  } catch (e) {
    record('seed: refuses a database that has members', /only fills an empty database/.test(e.message), e.message)
  }
  await db.close()
}

// ── 4. Staff accounts from the dashboard ────────────────────────────────────
// Authentication → Add user sends no metadata and a password, hashed (bcrypt) before the insert.
// Only an invited email, with that same temporary password, gets through.
async function staffScenario() {
  const db = await freshDb()
  const pg = 'postgres'
  // A database may already hold an older shape of the invites table.
  await migrate(db, MIGRATIONS.filter((f) => f < '20261012150000'))
  await run(db, pg, `create table public.staff_invites (email text primary key, role text, full_name text)`)
  await run(db, pg, `insert into public.staff_invites values ('old@example.com', 'curator', 'Старое')`)
  await migrate(db, MIGRATIONS.filter((f) => f >= '20261012150000'))
  await expectEqual('staff: the invites table is created anew', db, pg, 'select count(*)::int from public.staff_invites', [], 0)
  const addUser = (id, email, password, meta = {}) =>
    run(db, pg, `insert into auth.users (id, email, encrypted_password, raw_user_meta_data)
      values ($1, $2, case when $3::text is null then '' else extensions.crypt($3, extensions.gen_salt('bf', 10)) end, $4)`,
    [id, email, password, meta])
  const invite = (email, role, name, password) =>
    run(db, pg, 'insert into public.staff_invites (email, role, full_name, temp_password) values ($1, $2, $3, $4)',
      [email, role, name, password])
  const expectAdd = (name, id, email, password, meta, pattern) =>
    addUser(id, email, password, meta).then(
      () => record(name, !pattern, 'expected an error, got success'),
      (e) => record(name, !!pattern && pattern.test(e.message), `unexpected error: ${e.message}`))
  const code = await value(db, pg, `select code from public.join_codes where active and track_id = 'ai' limit 1`)
  const S = (n) => `40000000-0000-0000-0000-00000000000${n}`

  await expectAdd('staff: no join code and no invite is rejected', S(1), 'nobody@example.com', 'Temp-Pass-1', {}, /invalid_join_code/)

  await invite('staff@example.com', 'curator', ' Куратор Клуба ', 'Temp-Pass-2')
  await expectAdd('staff: a different password does not take the invite', S(1), 'staff@example.com', 'Attacker-Pass', {}, /invalid_join_code/)
  await expectAdd('staff: an account without a password (GitHub) does not take it', S(1), 'staff@example.com', null, {}, /invalid_join_code/)
  await expectEqual('staff: the invite is still there', db, pg, 'select count(*)::int from public.staff_invites', [], 1)
  await expectAdd('staff: Add user with the invited email and password', S(2), 'Staff@Example.com', 'Temp-Pass-2', null)
  await expectEqual('staff: role, name, no track, no grade', db, pg,
    `select concat_ws(',', role, full_name, coalesce(track_id, '-'), coalesce(grade::text, '-'), cohort_id = public.default_cohort_id())
     from public.profiles where user_id = $1`, [S(2)], 'curator,Куратор Клуба,-,-,t')
  await expectEqual('staff: the email goes to member_private', db, pg,
    'select mp.email from public.member_private mp join public.profiles p on p.id = mp.profile_id where p.user_id = $1',
    [S(2)], 'Staff@Example.com')
  await expectEqual('staff: the invite is used up', db, pg, 'select count(*)::int from public.staff_invites', [], 0)

  await invite('pupil@example.com', 'director', 'Не директор', 'Temp-Pass-4')
  await addUser(S(4), 'pupil@example.com', 'Temp-Pass-4', { join_code: code, full_name: 'Ученик', grade: 9, photo_consent: true })
  await run(db, pg, `update public.profiles set status = 'active' where user_id = $1`, [S(4)])
  await expectEqual('staff: signing up with a join code ignores the invite', db, pg,
    'select role from public.profiles where user_id = $1', [S(4)], 'member')

  await expectError('staff: members cannot read the invites', db, S(4), 'select * from public.staff_invites', [], DENIED)
  await expectError('staff: members cannot add an invite', db, S(4),
    `insert into public.staff_invites (email, role, full_name, temp_password) values ('me@example.com', 'director', 'Я', 'Temp-Pass-5')`,
    [], DENIED)
  await expectError('staff: invites are for director / curator only', db, pg,
    `insert into public.staff_invites (email, role, full_name, temp_password) values ('l@example.com', 'track_lead', 'Л', 'Temp-Pass-6')`,
    [], /check/)
  await expectError('staff: invite emails are stored in lower case', db, pg,
    `insert into public.staff_invites (email, role, full_name, temp_password) values ('Big@example.com', 'curator', 'Б', 'Temp-Pass-7')`,
    [], /check/)

  // A track lead left without a track can't replace the codes.
  await run(db, pg, `update public.profiles set role = 'track_lead', track_id = null where user_id = $1`, [S(4)])
  await expectError('join codes: a lead without a track cannot rotate any', db, S(4), `select public.rotate_join_code('ai')`, [], /forbidden/)
  await run(db, pg, `update public.profiles set track_id = 'ai' where user_id = $1`, [S(4)])
  await expectOk('join codes: a lead rotates their own track', db, S(4), `select public.rotate_join_code('ai')`)

  // The curator is an adult: no grade, no track, whichever way she became curator.
  await run(db, pg, `update public.profiles set role = 'director', track_id = null where user_id = $1`, [S(4)])
  const fresh = await value(db, pg, `select code from public.join_codes where active and track_id = 'ai'`)
  await addUser(S(5), 'teacher@example.com', 'Temp-Pass-8', { join_code: fresh, full_name: 'Учитель', grade: 11, photo_consent: true })
  await run(db, pg, `update public.profiles set status = 'active' where user_id = $1`, [S(5)])
  const teacher = await value(db, pg, 'select id from public.profiles where user_id = $1', [S(5)])
  await expectOk('curator: the director promotes a pupil account', db, S(4), `select public.set_member_role($1, 'curator')`, [teacher])
  await expectEqual('curator: promotion clears the grade and the track', db, pg,
    `select concat_ws(',', role, coalesce(grade::text, '-'), coalesce(track_id, '-')) from public.profiles where id = $1`, [teacher], 'curator,-,-')
  await expectError('curator: cannot give herself a grade', db, S(5),
    'update public.profiles set grade = 10 where user_id = $1', [S(5)], /profiles_curator_no_grade_track/)
  await expectError('curator: cannot join a track with a code', db, S(5), 'select public.claim_track($1)', [fresh], /profiles_curator_no_grade_track/)
  await expectError('curator: the director cannot put her into a track', db, S(4),
    `select public.set_member_track($1, 'ai')`, [teacher], /profiles_curator_no_grade_track/)
  await expectOk('curator: edits her name', db, S(5), `update public.profiles set full_name = 'Учитель Учителева' where user_id = $1`, [S(5)])
  await db.close()
}

// ── 5. Hardening ────────────────────────────────────────────────────────────
async function hardeningScenario() {
  const db = await freshDb()
  await migrate(db, MIGRATIONS)
  const pg = 'postgres'
  const anon = 'anon'

  // Rules every database object keeps, whatever the next migration adds.
  await expectEqual('catalog: every table has row-level security', db, pg,
    `select coalesce(string_agg(c.relname, ','), '') from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`, [], '')
  await expectEqual('catalog: guests have no table privileges', db, pg,
    `select coalesce(string_agg(distinct table_name, ','), '') from information_schema.role_table_grants
     where grantee in ('anon', 'PUBLIC') and table_schema = 'public'`, [], '')
  await expectEqual('catalog: guests can call exactly two functions', db, pg,
    `select string_agg(p.proname, ',' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')`, [], 'check_join_code,reset_password_with_code')
  await expectEqual('catalog: every definer function fixes its search_path', db, pg,
    `select coalesce(string_agg(p.proname, ','), '') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('public', 'private') and p.prosecdef
       and not exists (select 1 from unnest(p.proconfig) c where c like 'search\_path=%')`, [], '')
  await expectEqual('catalog: the internal schema is closed', db, pg,
    `select has_schema_privilege('anon', 'private', 'usage') or has_schema_privilege('authenticated', 'private', 'usage')`, [], false)
  await run(db, pg, `create function public.later_on() returns int language sql as 'select 1'`)
  await expectEqual('catalog: a function added later is closed to guests without anyone revoking it', db, pg,
    `select has_function_privilege('anon', 'public.later_on()', 'execute')`, [], false)
  await run(db, pg, 'drop function public.later_on()')
  await expectEqual('catalog: policies with no condition are only on the two reference tables', db, pg,
    `select string_agg(tablename, ',' order by tablename) from pg_policies
     where schemaname = 'public' and cmd = 'SELECT' and qual = 'true'`, [], 'cohorts,tracks')
  await expectEqual('catalog: the access-token hook left nothing behind', db, pg,
    `select count(*)::int from pg_policies where 'supabase_auth_admin' = any(roles)`, [], 0)

  const code = await value(db, pg, `select code from public.join_codes where active and track_id = 'ai'`)
  const uid = (n) => `50000000-0000-0000-0000-${String(n).padStart(12, '0')}`
  const U = { dir: uid(1), cur: uid(2), lead: uid(3), m1: uid(4), m2: uid(5), newbie: uid(6), off: uid(7), ghost: uid(8) }
  for (const [key, id] of Object.entries(U)) {
    await run(db, pg, 'insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)',
      [id, `${key}@example.com`, { full_name: `Тест ${key}`, grade: 9, join_code: code, photo_consent: key !== 'm2' }])
  }
  await run(db, pg, `update public.profiles set status = 'active' where user_id <> $1`, [U.newbie])
  await run(db, pg, `update public.profiles set role = 'director', track_id = null where user_id = $1`, [U.dir])
  await run(db, pg, `update public.profiles set role = 'curator', track_id = null, grade = null where user_id = $1`, [U.cur])
  await run(db, pg, `update public.profiles set role = 'track_lead' where user_id = $1`, [U.lead])
  await run(db, pg, `update public.profiles set status = 'inactive' where user_id = $1`, [U.off])
  const P = {}
  for (const [key, id] of Object.entries(U)) P[key] = await value(db, pg, 'select id from public.profiles where user_id = $1', [id])
  await run(db, pg, 'delete from public.profiles where id = $1', [P.ghost]) // a login left without a profile

  const project = await value(db, U.m1, `select public.create_project('Проект', 'Проблема', 'Школьники')`)
  const team = await value(db, U.m1, `select public.create_team('Команда')`)

  // ── Answers are true or false, never null ─────────────────────────────────
  for (const who of ['newbie', 'off', 'ghost']) {
    await expectEqual(`null logic: can_edit_project answers for ${who}`, db, U[who], 'select public.can_edit_project($1)', [project], false)
    await expectEqual(`null logic: can_edit_track answers for ${who}`, db, U[who], `select public.can_edit_track('ai')`, [], false)
    await expectEqual(`null logic: can_manage answers for ${who}`, db, U[who], 'select public.can_manage($1)', [P.m1], false)
    await expectEqual(`null logic: can_manage_team answers for ${who}`, db, U[who], 'select public.can_manage_team($1)', [team], false)
    await expectError(`${who}: cannot add a project member`, db, U[who], 'select public.add_project_member($1, $2)', [project, P.m2], /forbidden/)
    await expectError(`${who}: cannot remove a project member`, db, U[who], 'select public.remove_project_member($1, $2)', [project, P.m1], /forbidden/)
    await expectError(`${who}: cannot remove a team member`, db, U[who], 'select public.remove_team_member($1, $2)', [team, P.m1], /forbidden/)
    await expectError(`${who}: cannot export someone's data`, db, U[who], 'select public.export_member_data($1)', [P.m1], /forbidden/)
    await expectError(`${who}: cannot rotate a code`, db, U[who], `select public.rotate_join_code('ai')`, [], /forbidden/)
  }
  await expectEqual('team: a switched-off captain no longer runs it', db, pg, 'select count(*)::int from public.team_members', [], 1)
  await run(db, pg, `update public.profiles set status = 'inactive' where id = $1`, [P.m1])
  await expectError('team: a switched-off captain cannot archive it', db, U.m1, 'select public.archive_team($1)', [team], /forbidden/)
  await expectError('project: a switched-off owner cannot add people', db, U.m1, 'select public.add_project_member($1, $2)', [project, P.m2], /forbidden/)
  await run(db, pg, `update public.profiles set status = 'active' where id = $1`, [P.m1])

  // ── A verified factor makes a session without the code nobody ─────────────
  await run(db, pg, `insert into auth.mfa_factors (user_id, status) values ($1, 'verified')`, [U.lead])
  await run(db, pg, `insert into auth.mfa_factors (user_id, status) values ($1, 'unverified')`, [U.m2])
  const stolen = noMfa(U.lead)
  await expectEqual('factor on, no code: mfa_ok says so', db, stolen, 'select public.mfa_ok()', [], false)
  await expectEqual('factor on, no code: no profile id', db, stolen, 'select public.current_profile_id()', [], null)
  await expectEqual('factor on, no code: no role', db, stolen, 'select public.my_role()', [], null)
  await expectEqual('factor on, no code: not an active member', db, stolen, 'select public.is_active_member()', [], false)
  await expectEqual('factor on, no code: only their own profile', db, stolen, 'select count(*)::int from public.profiles', [], 1)
  await expectEqual('factor on, no code: not even their own contacts', db, stolen, 'select count(*)::int from public.member_private', [], 0)
  await expectError('factor on, no code: no staff actions', db, stolen, `select public.award_points($1, 5, 'event', 'x')`, [P.m1], /forbidden/)
  await expectNoEffect('factor on, no code: cannot rename themselves', db, stolen, `update public.profiles set full_name = 'Вор'`)
  await expectEqual('factor on, with the code: everything is back', db, U.lead, 'select public.my_role()', [], 'track_lead')
  await expectEqual('factor on, with the code: contacts of the track', db, U.lead,
    `select count(*)::int from public.member_private`, [], 5)
  await expectEqual('an unfinished factor changes nothing', db, noMfa(U.m2), 'select public.mfa_ok()', [], true)
  await run(db, pg, 'delete from auth.mfa_factors')

  // ── Director and curator powers need the code ─────────────────────────────
  for (const who of ['dir', 'cur']) {
    const aal1 = noMfa(U[who])
    await expectEqual(`${who} without the code: can_manage is off`, db, aal1, 'select public.can_manage($1)', [P.m1], false)
    await expectEqual(`${who} without the code: can_edit_track is off`, db, aal1, `select public.can_edit_track('ai')`, [], false)
    await expectEqual(`${who} without the code: only their own contacts`, db, aal1, 'select count(*)::int from public.member_private', [], 1)
    await expectEqual(`${who} without the code: no audit log`, db, aal1, 'select count(*)::int from public.audit_log', [], 0)
    await expectEqual(`${who} without the code: no join codes`, db, aal1, 'select count(*)::int from public.join_codes', [], 0)
    await expectError(`${who} without the code: no schedule`, db, aal1, `select public.set_schedule('2026-10-05', 30)`, [], /mfa_required/)
    await expectError(`${who} without the code: no shift`, db, aal1, 'select public.shift_schedule(13, 7)', [], /mfa_required/)
    await expectError(`${who} without the code: no new codes`, db, aal1, `select public.rotate_join_code('ai')`, [], /mfa_required/)
    await expectError(`${who} without the code: no data downloads`, db, aal1, 'select public.export_member_data($1)', [P.m1], /mfa_required/)
    await expectError(`${who} without the code: no reset codes`, db, aal1, 'select public.create_reset_code($1)', [P.m1], /mfa_required/)
    await expectEqual(`${who} without the code: their own data is still theirs`, db, aal1,
      `select public.export_member_data($1) ? 'profile'`, [P[who]], true)
    await expectEqual(`${who} with the code: full contacts`, db, U[who], 'select count(*)::int > 3 from public.member_private', [], true)
  }
  await expectError('director without the code: cannot move a member', db, noMfa(U.dir), `select public.set_member_track($1, 'algo')`, [P.m1], /mfa_required/)
  await expectError('director without the code: cannot switch one off', db, noMfa(U.dir), `select public.set_member_status($1, 'inactive')`, [P.m1], /mfa_required/)
  await expectOk('a lead keeps working without a factor', db, noMfa(U.lead), 'select public.decide_join($1, true)', [P.newbie])
  await run(db, pg, `update public.profiles set status = 'pending' where id = $1`, [P.newbie])
  await expectEqual('a lead without the code: only their own contacts', db, noMfa(U.lead), 'select count(*)::int from public.member_private', [], 1)
  await expectEqual('a lead with the code: the track', db, U.lead, 'select count(*)::int from public.member_private', [], 5)
  await expectEqual('photo refusals: names for a lead without the code', db, noMfa(U.lead), 'select count(*)::int from public.photo_refusals()', [], 1)
  await expectEqual('photo refusals: not for a member', db, U.m1, 'select count(*)::int from public.photo_refusals()', [], 0)

  // ── Reset codes ───────────────────────────────────────────────────────────
  await expectError('reset: the curator cannot reach the director', db, U.cur, 'select public.create_reset_code($1)', [P.dir], /forbidden/)
  await expectOk('reset: the director resets the curator', db, U.dir, 'select public.create_reset_code($1)', [P.cur])
  await expectOk('reset: the curator resets a member', db, U.cur, 'select public.create_reset_code($1)', [P.m1])
  await run(db, pg, 'delete from public.password_reset_codes')
  await expectEqual('passwords: weak ones are refused', db, pg,
    `select public.strong_password('short1') or public.strong_password('onlyletterslong') or public.strong_password('12345678901')`, [], false)
  await expectEqual('passwords: Cyrillic counts as letters', db, pg, `select public.strong_password('пароль-школьника-1')`, [], true)
  await expectEqual('passwords: more than bcrypt reads is refused', db, pg, `select public.strong_password(repeat('я', 40) || '1')`, [], false)
  await expectError('api: the password rule is internal', db, U.m1, `select public.strong_password('x')`, [], DENIED)
  const resetCode = await value(db, U.lead, 'select public.create_reset_code($1)', [P.m1])
  await expectEqual('reset: stored at the cost of Supabase Auth', db, anon,
    'select public.reset_password_with_code($1, $2, $3)', ['m1@example.com', resetCode, 'новый-пароль-2026'], 'ok')
  await expectEqual('reset: bcrypt cost 10', db, pg, `select left(encrypted_password, 7) from auth.users where id = $1`, [U.m1], '$2a$10$')
  await expectEqual('reset: other sessions are gone', db, pg, `select count(*)::int from auth.sessions where user_id = $1`, [U.m1], 0)

  // ── Limits ────────────────────────────────────────────────────────────────
  await run(db, pg, 'delete from private.rate_limits')
  const resetSql = 'select public.reset_password_with_code($1, $2, $3)'
  const tries = []
  for (let i = 0; i < 17; i++) tries.push(await value(db, anon, resetSql, ['nobody@example.com', 'AAAAAAAA', 'новый-пароль-2026']))
  await expectEqual('limits: reset attempts slow down', db, pg, 'select $1::text', [tries[16]], 'slow_down')
  await expectEqual('limits: the first attempts are not refused', db, pg, 'select $1::text', [tries[0]], 'invalid')
  await run(db, pg, 'delete from private.rate_limits')
  for (let i = 0; i < 40; i++) await value(db, anon, 'select count(*)::int from public.check_join_code($1)', ['ZZZZZZZZ'])
  await expectEqual('limits: a class scanning the QR from one network gets through', db, anon,
    'select count(*)::int from public.check_join_code($1)', [code], 1)
  for (let i = 0; i < 160; i++) await value(db, anon, 'select count(*)::int from public.check_join_code($1)', ['ZZZZZZZZ'])
  await expectEqual('limits: guessing join codes stops working, a real code looks wrong too', db, anon,
    'select count(*)::int from public.check_join_code($1)', [code], 0)
  await run(db, pg, 'delete from private.rate_limits')
  await expectEqual('limits: each address counts on its own', db, pg,
    `select private.hit_limit('reset:1.1.1.1', 1, interval '1 minute') and private.hit_limit('reset:2.2.2.2', 1, interval '1 minute')`, [], true)
  await expectEqual('limits: the client address comes from the gateway header', db, pg,
    `select set_config('request.headers', '{"cf-connecting-ip":"9.9.9.9","x-forwarded-for":"6.6.6.6, 9.9.9.9"}', false) is not null and private.client_ip() = '9.9.9.9'`, [], true)
  await run(db, pg, `select set_config('request.headers', '', false)`)
  await expectError('limits: nobody reads the counters', db, U.m1, 'select * from private.rate_limits', [], DENIED)
  for (let i = 0; i < 10; i++) {
    await expectOk(`limits: team ${i} is fine`, db, U.m2, `select public.create_team($1)`, [`Команда ${i}`])
    await run(db, pg, 'delete from public.team_members where profile_id = $1', [P.m2])
  }
  await expectError('limits: nobody creates teams without end', db, U.m2, `select public.create_team('Ещё одна')`, [], /too_fast/)

  // ── Push ──────────────────────────────────────────────────────────────────
  await run(db, pg, 'delete from private.rate_limits')
  for (let i = 0; i < 12; i++) {
    await run(db, U.m1, 'select public.register_push($1, $2, $3)', [`https://fcm.googleapis.com/fcm/send/d${i}`, 'k', 'a'])
  }
  await expectEqual('push: ten devices at most', db, pg, 'select count(*)::int from public.push_subscriptions', [], 10)

  // ── Files ─────────────────────────────────────────────────────────────────
  const work = `insert into storage.objects (bucket_id, name, metadata) values ('works', $1, $2)`
  await run(db, pg, `insert into storage.objects (bucket_id, name, metadata)
    select 'works', $1 || '/f' || n || '.txt', '{"size": 10}'::jsonb from generate_series(1, 150) n`, [P.m1])
  await expectError('files: 150 is the most a member keeps', db, U.m1, work, [`${P.m1}/more.txt`, { size: 1 }], RLS)
  await run(db, pg, `delete from storage.objects where bucket_id = 'works'`)
  await run(db, pg, `insert into storage.objects (bucket_id, name, metadata) values ('works', $1, $2)`, [`${P.m1}/big.zip`, { size: 100 * 1024 * 1024 }])
  await expectError('files: 100 MB is the most a member keeps', db, U.m1, work, [`${P.m1}/more.txt`, { size: 1 }], RLS)
  await expectOk('files: a neighbour is not affected', db, U.lead, work, [`${P.lead}/mine.txt`, { size: 1 }])
  await run(db, pg, `update storage.objects set metadata = '{"size": 943718400}' where name = $1`, [`${P.m1}/big.zip`])
  await expectError('files: the project stops short of the free plan\'s limit', db, U.lead, work, [`${P.lead}/mine2.txt`, { size: 1 }], RLS)
  await run(db, pg, `delete from storage.objects where bucket_id = 'works'`)

  const avatar = (id, name) => run(db, id, `insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [name])
  await expectError('photos: no upload without a yes', db, U.m2,
    `insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [`${U.m2}/a.png`], RLS)
  await avatar(U.m1, `${U.m1}/a.png`)
  await avatar(U.m1, `${U.m1}/b.png`)
  await avatar(U.m1, `${U.m1}/c.png`)
  await expectError('photos: three files is enough to replace one', db, U.m1,
    `insert into storage.objects (bucket_id, name) values ('avatars', $1)`, [`${U.m1}/d.png`], RLS)
  const seen = `select count(*)::int from storage.objects where bucket_id = 'avatars'`
  await expectEqual('photos: the owner sees their files', db, U.m1, seen, [], 3)
  await expectEqual('photos: nothing on a profile, nothing for the others', db, U.lead, seen, [], 0)
  await run(db, U.m1, 'update public.profiles set avatar_path = $1 where user_id = $2', [`${U.m1}/a.png`, U.m1])
  await expectEqual('photos: others see the one on the profile', db, U.lead, seen, [], 1)
  await expectEqual('photos: the director sees all of them, to delete them', db, U.dir, seen, [], 3)
  await expectEqual('photos: not without the code', db, noMfa(U.dir), seen, [], 1)
  await expectNoEffect('photos: the director cannot delete without the code', db, noMfa(U.dir), `delete from storage.objects where bucket_id = 'avatars'`)
  await expectNoEffect('photos: nobody overwrites one', db, U.m1, `update storage.objects set owner = null where bucket_id = 'avatars'`)
  await run(db, pg, `insert into storage.objects (bucket_id, name) values ('works', $1)`, [`${P.m1}/w.txt`])
  await expectNoEffect('works: the director cannot delete without the code', db, noMfa(U.dir), `delete from storage.objects where bucket_id = 'works'`)
  await expectOk('works: with the code they can', db, U.dir, `delete from storage.objects where bucket_id = 'works'`)

  // ── Names ─────────────────────────────────────────────────────────────────
  await run(db, U.m1, `update public.profiles set full_name = E'Али‮са​' where user_id = $1`, [U.m1])
  await expectEqual('names: invisible and direction characters are removed', db, pg, 'select full_name from public.profiles where id = $1', [P.m1], 'Алиса')

  // ── Staff invites ─────────────────────────────────────────────────────────
  await run(db, pg, `insert into public.staff_invites (email, role, full_name, temp_password, created_at)
    values ('late@example.com', 'curator', 'Опоздавший', 'Temp-Pass-8', now() - interval '4 days')`)
  await expectError('invites: an old one no longer works', db, pg,
    `insert into auth.users (id, email, encrypted_password) values ($1, 'late@example.com', extensions.crypt('Temp-Pass-8', extensions.gen_salt('bf')))`, [uid(20)], /invalid_join_code/)

  // ── Tidy-up ───────────────────────────────────────────────────────────────
  await run(db, pg, `insert into private.rate_limits values ('old', now() - interval '3 days', 1)`)
  await run(db, pg, `insert into public.push_once (key, created_at) values ('old', now() - interval '8 days'), ('new', now())`)
  await run(db, pg, `insert into public.password_reset_codes (profile_id, code_hash, expires_at) values ($1, 'x', now() - interval '1 hour')`, [P.m2])
  await run(db, pg, `update public.push_subscriptions set created_at = now() - interval '200 days'`)
  await run(db, pg, 'select public.security_housekeeping()')
  await expectEqual('tidy-up: old counters go', db, pg, `select count(*)::int from private.rate_limits where bucket = 'old'`, [], 0)
  await expectEqual('tidy-up: old push marks go, new ones stay', db, pg, 'select string_agg(key, \',\') from public.push_once', [], 'new')
  await expectEqual('tidy-up: expired reset codes go', db, pg, 'select count(*)::int from public.password_reset_codes', [], 0)
  await expectEqual('tidy-up: invites past their date go', db, pg, 'select count(*)::int from public.staff_invites', [], 0)
  await expectEqual('tidy-up: devices silent for half a year go', db, pg, 'select count(*)::int from public.push_subscriptions', [], 0)
  await expectError('tidy-up: members cannot run it', db, U.m1, 'select public.security_housekeeping()', [], DENIED)

  // ── The demo copy ─────────────────────────────────────────────────────────
  await run(db, pg, `insert into private.settings values ('mfa_optional', 'demo')`)
  await expectEqual('demo: staff work without the code', db, noMfa(U.dir), 'select count(*)::int > 3 from public.member_private', [], true)
  await run(db, pg, `insert into auth.mfa_factors (user_id, status) values ($1, 'verified')`, [U.lead])
  await expectEqual('demo: a factor someone turned on still counts', db, noMfa(U.lead), 'select public.my_role()', [], null)
  await db.close()
}

// ── 6. Team recruitment ─────────────────────────────────────────────────────
// The form's questions come from src/lib/recruitment.ts, so the database is checked against
// exactly what the site sends.
async function recruitmentScenario() {
  const db = await freshDb()
  await migrate(db, MIGRATIONS)
  const pg = 'postgres'
  const anon = 'anon'
  const service = 'service'

  let n = 0
  const key = () => `60000000-0000-4000-8000-${String(++n).padStart(12, '0')}`
  const sample = (q) => q.kind === 'choice' ? q.options[0].id : q.kind === 'choices' ? [q.options[0].id]
    : q.kind === 'links' ? ['https://github.com/ait-club'] : 'Ответ на вопрос'
  const form = (dept, over = {}) => {
    const d = DEPARTMENTS.find((x) => x.id === dept)
    return {
      full_name: 'Алия Серикова', applicant_status: 'nis_student', school: 'НИШ, Петропавловск', grade: '10 класс',
      email: `applicant${n}@example.com`, telegram: '@aliya_s', experience: null, department: dept, role: d.roles[0].id,
      extra_role: null, answers: Object.fromEntries(DEPARTMENT_QUESTIONS[dept].map((q) => [q.id, sample(q)])),
      ...Object.fromEntries(AVAILABILITY_QUESTIONS.map((q) => [q.id, sample(q)])),
      volunteer_ack: true, consent: true, consent_version: CONSENT_VERSION, is_adult: false, guardian_consent: true, ...over,
    }
  }
  const submitSql = 'select public.submit_application($1, $2, $3) as r'
  const submit = async (f, k = key(), ip = null) => (await rows(db, service, submitSql, [k, f, ip]))[0].r
  const expectSubmit = async (name, f, expected, ip = null) => {
    try {
      const r = await submit(f, key(), ip)
      const ok = Object.entries(expected).every(([k, v]) => r[k] === v)
      record(name, ok, JSON.stringify(r))
      return r
    } catch (e) {
      record(name, false, e.message)
    }
  }
  const resetLimits = () => run(db, pg, 'delete from private.rate_limits')

  // ── Only the edge function submits ────────────────────────────────────────
  await expectError('apply: guests cannot submit', db, anon, submitSql, [key(), form('pr'), null], DENIED)
  await expectError('apply: guests cannot ask whether it is open', db, anon, 'select public.recruitment_status()', [], DENIED)
  for (const table of ['team_applications', 'team_application_notes', 'recruitment_access']) {
    await expectError(`apply: guests cannot read ${table}`, db, anon, `select * from public.${table}`, [], DENIED)
  }
  await expectEqual('apply: the form is open on 9 November', db, service,
    `select public.recruitment_status() ->> 'open'`, [], 'true')

  // ── Every department, every option ────────────────────────────────────────
  const first = {}
  for (const d of DEPARTMENTS) {
    first[d.id] = await expectSubmit(`apply: a ${d.id} application is taken`, form(d.id), { ok: true, department: d.id })
  }
  await expectEqual('apply: numbers look like AIT-XXXXXX', db, pg,
    `select bool_and(public_id ~ '^AIT-[A-Z2-9]{6}$') and count(*) = 4 from public.team_applications`, [], true)
  for (const d of DEPARTMENTS) {
    for (const r of d.roles) {
      await expectSubmit(`apply: role ${r.id} belongs to ${d.id}`, form(d.id, { role: r.id }), { ok: true, role: r.id })
    }
  }
  await resetLimits()
  for (const q of [...Object.values(DEPARTMENT_QUESTIONS).flat(), ...AVAILABILITY_QUESTIONS]) {
    if (q.kind !== 'choice' && q.kind !== 'choices') continue
    const dept = Object.entries(DEPARTMENT_QUESTIONS).find(([, qs]) => qs.includes(q))?.[0] ?? 'operations'
    for (const opt of q.options) {
      const value = q.kind === 'choices' ? [opt.id] : opt.id
      const f = form(dept)
      if (dept === 'operations' && AVAILABILITY_QUESTIONS.includes(q)) f[q.id] = value
      else f.answers[q.id] = value
      const r = await submit(f)
      if (!r.ok) record(`apply: option ${q.id}=${opt.id} is accepted`, false, JSON.stringify(r))
    }
    await resetLimits()
  }
  record('apply: every option the form offers is accepted', true)
  await expectEqual('apply: a choice the form never offers is refused', db, service, submitSql,
    [key(), form('pr', { answers: { ...form('pr').answers, style: 'alone' } }), null], { error: 'invalid_form', field: 'style' })
  await expectEqual('apply: so is an unknown option in a list', db, service, submitSql,
    [key(), form('data', { work_times: ['saturday', 'night'] }), null], { error: 'invalid_form', field: 'work_times' })

  // ── A repeated request ────────────────────────────────────────────────────
  const k1 = key()
  const once = await submit(form('education'), k1)
  const again = await submit(form('education', { full_name: 'Другое Имя' }), k1)
  record('apply: a repeated request gets the same number', once.ok && again.id === once.id, `${once.id} / ${again.id}`)
  await expectEqual('apply: and makes nothing new', db, pg,
    'select count(*)::int from public.team_applications where request_key = $1', [k1], 1)

  // ── What is kept ──────────────────────────────────────────────────────────
  const mixed = form('education', { full_name: '  Али‮я​   Серикова ', email: ' Aliya@Example.KZ ', telegram: 'https://t.me/aliya_s',
    answers: { ...form('education').answers, idea: 'чужой вопрос', tools: ['figma'] } })
  const kept = await submit(mixed)
  await expectEqual('apply: other departments\' answers are not kept', db, pg,
    `select answers ? 'idea' or answers ? 'tools' from public.team_applications where public_id = $1`, [kept.id], false)
  await expectEqual('apply: names lose invisible and direction characters', db, pg,
    'select full_name from public.team_applications where public_id = $1', [kept.id], 'Алия Серикова')
  await expectEqual('apply: email is trimmed and lower-cased, Telegram becomes a handle', db, pg,
    `select email || ' ' || telegram from public.team_applications where public_id = $1`, [kept.id], 'aliya@example.kz aliya_s')
  const ui = { ...emptyForm(), full_name: 'Даурен Ахметов', applicant_status: 'nis_graduate', nis_city: 'Астана', grade: 'Выпуск 2025',
    email: 'dauren@example.com', telegram: '@dauren_a', department: 'pr', role: 'designer', extra_role: 'video',
    answers: { tools: ['figma', 'other'], tools_other: 'Blender', tasks: ['posters'], links: ['behance.net/dauren', ''], idea: 'Ночь проектов',
      style: 'team', after_week: 'yes', hours: '4_6', work_times: ['evening'], interview: 'coordinate', term: 'long', other_role: 'yes',
      motivation: 'Хочу делать визуальный стиль клуба' },
    volunteer_ack: true, consent: true, is_adult: true }
  const fromUi = await submit(buildPayload(ui))
  record('apply: what the site\'s form builds is accepted', fromUi?.ok === true, JSON.stringify(fromUi))
  await expectEqual('apply: the school, the extra role and the links come through', db, pg,
    `select concat_ws(' | ', school, extra_role, answers -> 'links' ->> 0, answers ->> 'tools_other') from public.team_applications where public_id = $1`,
    [fromUi?.id], 'НИШ, Астана | video | https://behance.net/dauren | Blender')

  // ── What is refused ───────────────────────────────────────────────────────
  const refuse = (name, f, field) => expectEqual(`apply: ${name}`, db, service, submitSql, [key(), f, null], { error: 'invalid_form', field })
  await refuse('a role of another department', form('pr', { role: 'lead_mentor' }), 'role')
  await refuse('a role that does not exist', form('pr', { role: 'developer' }), 'role')
  await refuse('the same role twice', form('pr', { extra_role: 'smm' }), 'extra_role')
  await expectSubmit('apply: an extra role from another department is fine', form('pr', { extra_role: 'event_manager' }), { ok: true })
  await refuse('an email that is not one', form('pr', { email: 'aliya@' }), 'email')
  await refuse('a Telegram handle that is not one', form('pr', { telegram: '@ab' }), 'telegram')
  await refuse('a link that is not http(s)', form('pr', { answers: { ...form('pr').answers, links: ['javascript:alert(1)'] } }), 'links')
  await refuse('four links', form('pr', { answers: { ...form('pr').answers, links: Array(4).fill('https://a.kz') } }), 'links')
  await refuse('no name', form('pr', { full_name: '   ' }), 'full_name')
  await refuse('a name of one letter', form('pr', { full_name: 'А' }), 'full_name')
  await refuse('a required answer left empty', form('operations', { answers: { ...form('operations').answers, case: ' ' } }), 'case')
  await refuse('an answer too long', form('data', { answers: { ...form('data').answers, metrics: 'я'.repeat(1001) } }), 'metrics')
  await refuse('«no experience yet» together with a tool', form('data', { answers: { ...form('data').answers, tools: ['none', 'sql'] } }), 'tools')
  await refuse('no list of times', form('data', { work_times: [] }), 'work_times')
  await refuse('without «voluntary and unpaid»', form('pr', { volunteer_ack: false }), 'volunteer_ack')
  await refuse('without consent', form('pr', { consent: 'yes' }), 'consent')
  await refuse('a minor without a guardian\'s consent', form('pr', { is_adult: false, guardian_consent: false }), 'guardian_consent')
  await expectSubmit('apply: an adult needs no guardian', form('pr', { is_adult: true, guardian_consent: false }), { ok: true })
  await refuse('a form of 40 KB', form('pr', { extra_info: 'я'.repeat(20000) }), 'form')
  await refuse('no version of the terms', form('pr', { consent_version: 'latest' }), 'consent_version')
  await expectEqual('apply: the guardian\'s consent is recorded only for a minor', db, pg,
    `select count(*)::int from public.team_applications where is_adult and guardian_consent`, [], 0)

  // ── Dates and limits ──────────────────────────────────────────────────────
  await run(db, pg, `update private.settings set value = '2026-01-01 00:00+05' where key = 'recruitment_closes_at'`)
  await run(db, pg, `update private.settings set value = '2025-12-01 00:00+05' where key = 'recruitment_opens_at'`)
  await expectEqual('limits: after the dates the form is closed', db, service, submitSql, [key(), form('pr'), null], { error: 'closed' })
  await run(db, pg, `update private.settings set value = '2026-11-09 00:00+05' where key = 'recruitment_opens_at'`)
  await run(db, pg, `update private.settings set value = '2099-01-01 00:00+05' where key = 'recruitment_closes_at'`)
  await resetLimits()
  const same = form('pr', { email: 'repeat@example.com' })
  for (let i = 0; i < 5; i++) await submit(same)
  await expectEqual('limits: five applications a day from one email', db, service, submitSql, [key(), same, null], { error: 'slow_down' })
  await expectEqual('limits: a refused form does not use a try up', db, pg,
    `select hits from private.rate_limits where bucket = 'apply:email:repeat@example.com'`, [], 6)
  await resetLimits()
  for (let i = 0; i < 60; i++) await submit(form('pr', { email: `school${i}@example.com` }), key(), '10.0.0.1')
  await expectEqual('limits: sixty an hour from one address', db, service, submitSql, [key(), form('pr'), '10.0.0.1'], { error: 'slow_down' })
  await expectSubmit('limits: another address is not affected', form('pr', { email: 'other-net@example.com' }), { ok: true }, '10.0.0.2')
  await resetLimits()
  await submit(form('pr', { email: 'x' }), key(), '10.0.0.3')
  await expectEqual('limits: refused forms count for the address too', db, pg,
    `select hits from private.rate_limits where bucket = 'apply:10.0.0.3'`, [], 1)
  await run(db, pg, `insert into private.rate_limits values ('apply:all', date_bin('1 hour', now(), timestamptz '2000-01-01'), 300)
                     on conflict (bucket, window_start) do update set hits = 300`)
  await expectEqual('limits: three hundred an hour in all', db, service, submitSql, [key(), form('pr'), null], { error: 'slow_down' })
  await resetLimits()

  // ── Who sees them ─────────────────────────────────────────────────────────
  const code = await value(db, pg, `select code from public.join_codes where active and track_id = 'ai'`)
  const uid = (i) => `70000000-0000-0000-0000-${String(i).padStart(12, '0')}`
  const U = { dir: uid(1), cur: uid(2), lead: uid(3), helper: uid(4), member: uid(5), off: uid(6) }
  for (const [k, id] of Object.entries(U)) {
    await run(db, pg, 'insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)',
      [id, `${k}@example.com`, { full_name: `Тест ${k}`, grade: 10, join_code: code, photo_consent: true }])
  }
  await run(db, pg, `update public.profiles set status = 'active'`)
  await run(db, pg, `update public.profiles set role = 'director', track_id = null where user_id = $1`, [U.dir])
  await run(db, pg, `update public.profiles set role = 'curator', track_id = null, grade = null where user_id = $1`, [U.cur])
  await run(db, pg, `update public.profiles set role = 'track_lead' where user_id = $1`, [U.lead])
  const P = {}
  for (const [k, id] of Object.entries(U)) P[k] = await value(db, pg, 'select id from public.profiles where user_id = $1', [id])
  const total = await value(db, pg, 'select count(*)::int from public.team_applications')
  const count = 'select count(*)::int from public.team_applications'
  const app = first.pr.id
  const appId = await value(db, pg, 'select id from public.team_applications where public_id = $1', [app])
  const access = 'select public.my_recruitment_access()'

  await expectEqual('access: the director sees every application', db, U.dir, count, [], total)
  await expectEqual('access: so does the curator', db, U.cur, count, [], total)
  await expectEqual('access: a track lead does not', db, U.lead, count, [], 0)
  await expectEqual('access: nor does a member', db, U.member, count, [], 0)
  await expectEqual('access: the director without the code sees none', db, noMfa(U.dir), count, [], 0)
  for (const [who, want] of [['dir', 'manage'], ['cur', 'export'], ['lead', 'none'], ['member', 'none']]) {
    await expectEqual(`access: ${who} is told «${want}»`, db, U[who], access, [], want)
  }
  await expectEqual('access: without the code the director is told to enter it', db, noMfa(U.dir), access, [], 'needs_code')
  await expectError('access: members cannot submit either', db, U.member, submitSql, [key(), form('pr'), null], DENIED)

  await expectError('access: only the director lets someone in', db, U.cur, 'select public.grant_recruitment_access($1, false)', [P.helper], /forbidden/)
  await expectError('access: and only with the code', db, noMfa(U.dir), 'select public.grant_recruitment_access($1, false)', [P.helper], /mfa_required/)
  await expectError('access: the curator has it already', db, U.dir, 'select public.grant_recruitment_access($1, false)', [P.cur], /already_has_access/)
  await expectOk('access: the director lets a member in', db, U.dir, 'select public.grant_recruitment_access($1, false)', [P.helper])
  await expectEqual('access: who now sees every application', db, U.helper, count, [], total)
  await expectEqual('access: and is told «view»', db, U.helper, access, [], 'view')
  await expectEqual('access: not without the code', db, noMfa(U.helper), count, [], 0)
  await expectEqual('access: the team lists director, curator and them', db, U.helper,
    `select string_agg(role, ',' order by role) from public.recruitment_team()`, [], 'curator,director,member')
  await expectEqual('access: nobody else sees the team', db, U.member, 'select count(*)::int from public.recruitment_team()', [], 0)
  await expectError('export: not without the right to it', db, U.helper, 'select * from public.export_applications()', [], /forbidden/)
  await expectError('export: nor for a member', db, U.member, 'select * from public.export_applications()', [], /forbidden/)
  await expectOk('export: the director gives the right', db, U.dir, 'select public.grant_recruitment_access($1, true)', [P.helper])
  await expectEqual('export: then it works', db, U.helper, 'select count(*)::int from public.export_applications()', [], total)
  await expectEqual('export: and is logged', db, pg, `select count(*)::int from public.audit_log where action = 'applications_exported'`, [], 1)
  await run(db, pg, `update public.profiles set status = 'inactive' where id = $1`, [P.helper])
  await expectEqual('access: a switched-off account loses it', db, U.helper, count, [], 0)
  await run(db, pg, `update public.profiles set status = 'active' where id = $1`, [P.helper])

  // ── Working with an application ───────────────────────────────────────────
  await expectError('status: members cannot change it', db, U.member, `select public.set_application_status($1, 'accepted')`, [appId], /forbidden/)
  await expectError('status: not without the code', db, noMfa(U.dir), `select public.set_application_status($1, 'accepted')`, [appId], /mfa_required/)
  await expectError('status: only the known ones', db, U.dir, `select public.set_application_status($1, 'hired')`, [appId], /invalid_status/)
  await expectOk('status: a helper moves it on', db, U.helper, `select public.set_application_status($1, 'interview')`, [appId])
  await expectEqual('status: changed, with the time', db, pg,
    'select status || \':\' || (status_changed_at > created_at) from public.team_applications where id = $1', [appId], 'interview:true')
  await expectEqual('status: logged with the number, from and to', db, pg,
    `select details ->> 'public_id' || ' ' || (details ->> 'from') || '→' || (details ->> 'to') from public.audit_log where action = 'application_status'`,
    [], `${app} applied→interview`)
  await expectError('applications: nobody edits them directly', db, U.dir, `update public.team_applications set status = 'accepted'`, [], DENIED)
  await expectError('applications: or adds them', db, U.dir, `insert into public.team_applications (public_id) values ('AIT-ZZZZZZ')`, [], DENIED)
  await expectOk('assignee: someone on the team', db, U.dir, 'select public.assign_application($1, $2)', [appId, P.helper])
  await expectError('assignee: not someone without access', db, U.dir, 'select public.assign_application($1, $2)', [appId, P.member], /invalid_assignee/)
  await expectOk('score: from 1 to 5', db, U.cur, 'select public.set_application_score($1, 4)', [appId])
  await expectError('score: not 6', db, U.cur, 'select public.set_application_score($1, 6)', [appId], /invalid_score/)
  const note = await value(db, U.helper, 'select public.add_application_note($1, $2)', [appId, '  Сильное портфолио  '])
  await expectEqual('notes: the director reads them', db, U.dir, 'select body from public.team_application_notes where id = $1', [note], 'Сильное портфолио')
  await expectEqual('notes: members do not', db, U.member, 'select count(*)::int from public.team_application_notes', [], 0)
  await expectError('notes: not empty', db, U.dir, 'select public.add_application_note($1, $2)', [appId, '   '], /invalid_note/)
  await expectNoEffect('notes: nobody removes another\'s', db, U.dir, 'delete from public.team_application_notes where id = $1', [note])
  await expectOk('notes: the author removes their own', db, U.helper, 'delete from public.team_application_notes where id = $1', [note])
  await run(db, U.helper, 'select public.add_application_note($1, $2)', [appId, 'Позвать на собеседование'])
  await expectOk('access: the director takes it back', db, U.dir, 'select public.revoke_recruitment_access($1)', [P.helper])
  await expectEqual('access: then they see nothing', db, U.helper, count, [], 0)
  await expectEqual('access: and their applications have no assignee', db, pg,
    'select count(*)::int from public.team_applications where assignee_id = $1', [P.helper], 0)

  // ── The dates of the round ────────────────────────────────────────────────
  await expectError('dates: only the director changes them', db, U.cur,
    `select public.set_recruitment_window('2026-11-09 00:00+05', '2026-11-20 00:00+05')`, [], /forbidden/)
  await expectError('dates: the end comes after the start', db, U.dir,
    `select public.set_recruitment_window('2026-11-20 00:00+05', '2026-11-09 00:00+05')`, [], /invalid_window/)
  await expectOk('dates: the director extends the round', db, U.dir,
    `select public.set_recruitment_window('2026-11-09 00:00+05', '2026-11-20 00:00+05')`)
  await expectEqual('dates: read back as the same moment', db, U.cur,
    `select closes_at = '2026-11-20 00:00+05' from public.recruitment_window()`, [], true)
  await expectEqual('dates: hidden from those without access', db, U.member, 'select count(*)::int from public.recruitment_window()', [], 0)
  await run(db, pg, `update private.settings set value = '2099-01-01 00:00+05' where key = 'recruitment_closes_at'`)

  // ── Deleting ──────────────────────────────────────────────────────────────
  await expectError('delete: not the curator', db, U.cur, 'select public.delete_application($1)', [appId], /forbidden/)
  await expectOk('delete: the director, on request', db, U.dir, 'select public.delete_application($1)', [appId])
  await expectEqual('delete: the application and its notes are gone', db, pg,
    `select ((select count(*) from public.team_applications where id = $1) + (select count(*) from public.team_application_notes where application_id = $1))::int`,
    [appId], 0)
  await expectEqual('delete: the log keeps the number, not the name', db, pg,
    `select details ->> 'public_id' = $1 and not details::text like '%Алия%' from public.audit_log where action = 'application_deleted'`, [app], true)

  // ── Kept no longer than needed ────────────────────────────────────────────
  const ids = (await rows(db, pg, 'select id from public.team_applications order by created_at limit 4')).map((r) => r.id)
  await run(db, pg, `update public.team_applications set status = 'rejected', status_changed_at = now() - interval '91 days' where id = $1`, [ids[0]])
  await run(db, pg, `update public.team_applications set status = 'withdrawn', status_changed_at = now() - interval '10 days' where id = $1`, [ids[1]])
  await run(db, pg, `update public.team_applications set status = 'accepted', created_at = now() - interval '13 months' where id = $1`, [ids[2]])
  await run(db, pg, `update public.team_applications set status = 'accepted' where id = $1`, [ids[3]])
  await run(db, pg, 'select public.security_housekeeping()')
  await expectEqual('retention: 90 days after a refusal, a year at most', db, pg,
    'select string_agg((id = any($1::uuid[]))::text, \',\' order by created_at) from public.team_applications where id = any($2::uuid[])',
    [[ids[1], ids[3]], ids], 'true,true')
  await db.close()
}

const started = Date.now()
try {
  await upgradeScenario()
  await freshScenario()
  await seedScenario()
  await staffScenario()
  await hardeningScenario()
  await recruitmentScenario()
} catch (e) {
  failures.push(`setup failed: ${e.message}`)
}

for (const f of failures) console.error(`  ✗ ${f}`)
console.log(`\n${passed} passed, ${failures.length} failed (${((Date.now() - started) / 1000).toFixed(1)}s)`)
process.exit(failures.length ? 1 : 0)
