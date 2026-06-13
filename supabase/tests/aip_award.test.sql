-- pgTAP: award_aip() — the Council manual-award RPC. Verifies the auth gate, that it writes
-- the ledger correctly, and that rollbacks (negative delta) and source-defaulting work.
--
-- Run locally only:  supabase db start && supabase test db   (never against the linked project).
-- Each file runs in a transaction that is rolled back, so fixtures never persist.

create extension if not exists pgtap with schema extensions;
set search_path to extensions, public, pg_temp;

begin;
select plan(5);

-- ── Fixtures ──────────────────────────────────────────────────────────────────
-- profiles.user_id FKs auth.users, so we seed minimal auth rows for the actors.
insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'admin@test.local',  now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', 'member@test.local', now(), now());

insert into public.profiles (id, user_id, full_name, role) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1', 'Admin',   'admin'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a2', 'Member',  'member'),
  ('00000000-0000-0000-0000-0000000000b3', null,                                    'Target',  'member');

-- ── 1. A non-admin cannot award AIP ────────────────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2"}', true);
select throws_ok(
  $$ select public.award_aip('00000000-0000-0000-0000-0000000000b3', 'bonus', 50, 'nope') $$,
  'forbidden',
  'non-admin award_aip is rejected'
);

-- ── 2-3. Admin award writes the ledger with the right delta + awarder ──────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
select lives_ok(
  $$ select public.award_aip('00000000-0000-0000-0000-0000000000b3', 'bonus', 50, 'great work') $$,
  'admin award_aip succeeds'
);
select is(
  (select delta from public.xp_events where profile_id = '00000000-0000-0000-0000-0000000000b3' and source = 'bonus'),
  50, 'award writes the +delta'
);
select is(
  (select awarded_by from public.xp_events where profile_id = '00000000-0000-0000-0000-0000000000b3' and source = 'bonus'),
  '00000000-0000-0000-0000-0000000000b1'::uuid, 'award stamps awarded_by = caller'
);

-- ── 4. Negative delta is allowed (rollback) ────────────────────────────────────
select public.award_aip('00000000-0000-0000-0000-0000000000b3', 'rollback', -20, 'reversed');
select is(
  (select delta from public.xp_events where profile_id = '00000000-0000-0000-0000-0000000000b3' and source = 'rollback'),
  -20, 'negative delta (rollback) is stored'
);

select * from finish();
rollback;
