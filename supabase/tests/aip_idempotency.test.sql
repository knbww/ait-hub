-- pgTAP: the AIP anti-cheat invariant — ref-keyed awards are idempotent so a retried
-- automation (or a double-click) can never double-award. Backed by the partial unique index
-- `xp_events_dedup (profile_id, source, ref) where ref is not null`.
--
-- Run locally only:  supabase db start && supabase test db

create extension if not exists pgtap with schema extensions;
set search_path to extensions, public, pg_temp;

begin;
select plan(3);

insert into public.profiles (id, full_name, role)
values ('00000000-0000-0000-0000-0000000000c1', 'Member', 'member');

-- ── 1. Two ref-keyed rows with the same (profile, source, ref) collide ─────────
-- (the index is what makes ON CONFLICT DO NOTHING in the award functions a no-op).
select lives_ok(
  $$ insert into public.xp_events (profile_id, source, delta, ref)
     values ('00000000-0000-0000-0000-0000000000c1', 'attendance', 10, 'attendance:w1') $$,
  'first ref-keyed award inserts'
);
select throws_ok(
  $$ insert into public.xp_events (profile_id, source, delta, ref)
     values ('00000000-0000-0000-0000-0000000000c1', 'attendance', 10, 'attendance:w1') $$,
  '23505',
  'duplicate (profile, source, ref) is rejected by xp_events_dedup'
);

-- ── 2. NULL ref is intentionally NOT deduped (manual awards may repeat) ─────────
insert into public.xp_events (profile_id, source, delta, ref)
values ('00000000-0000-0000-0000-0000000000c1', 'manual', 5, null),
       ('00000000-0000-0000-0000-0000000000c1', 'manual', 5, null);
select is(
  (select count(*)::int from public.xp_events
     where profile_id = '00000000-0000-0000-0000-0000000000c1' and source = 'manual'),
  2, 'null-ref (manual) awards are not deduplicated'
);

select * from finish();
rollback;
