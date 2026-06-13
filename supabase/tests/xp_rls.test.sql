-- pgTAP: members can never write the points ledger directly — only the SECURITY DEFINER award
-- functions can. Enforced by RLS: the only write policy on xp_events is admin-only
-- (current_role_claim() = 'admin'); the service role (automation) bypasses RLS entirely.
--
-- Run locally only:  supabase db start && supabase test db

create extension if not exists pgtap with schema extensions;
set search_path to extensions, public, pg_temp;

begin;
select plan(2);

insert into public.profiles (id, full_name, role)
values ('00000000-0000-0000-0000-0000000000d1', 'Victim', 'member');

-- Act as an authenticated member (RLS applies; the postgres role would bypass it).
set local role authenticated;

-- ── 1. A member cannot insert into the ledger ───────────────────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d9","app_metadata":{"role":"member"}}', true);
select throws_ok(
  $$ insert into public.xp_events (profile_id, source, delta) values ('00000000-0000-0000-0000-0000000000d1', 'cheat', 9999) $$,
  '42501',
  'a member is blocked by RLS from writing xp_events directly'
);

-- ── 2. An admin claim satisfies the admin-only write policy ─────────────────────
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d8","app_metadata":{"role":"admin"}}', true);
select lives_ok(
  $$ insert into public.xp_events (profile_id, source, delta) values ('00000000-0000-0000-0000-0000000000d1', 'admin-grant', 10) $$,
  'an admin role-claim can write xp_events'
);

reset role;
select * from finish();
rollback;
