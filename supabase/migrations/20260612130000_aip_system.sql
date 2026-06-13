-- Module 2: AIP & gamification — make the points ledger transparent.
--
-- Enriches xp_events with WHO confirmed an award, a human note, and the season it
-- belongs to; adds a Council manual-award function, a filterable leaderboard
-- function, and a public `aip_journal` view (кто / за что / +N / когда / кто
-- подтвердил). The points table keeps its name `xp_events`; the UI calls it AIP.

-- ── Enrich the ledger ────────────────────────────────────────────────────────
alter table public.xp_events
  add column awarded_by uuid references public.profiles (id) on delete set null,
  add column note       text,
  add column season_id  uuid references public.seasons (id) on delete set null;

create index on public.xp_events (created_at desc);
create index on public.xp_events (season_id);

-- Active season helper (used to stamp awards so per-season totals + archive work).
create or replace function public.active_season_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.seasons where status = 'active' order by created_at desc limit 1;
$$;

-- ── Re-issue the two Academy award functions to stamp season_id / awarded_by ──
create or replace function public.check_in(p_week_id uuid, p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile uuid := public.current_profile_id();
  v_meeting public.week_meetings%rowtype;
begin
  if v_profile is null then
    return 'unauthenticated';
  end if;

  select * into v_meeting from public.week_meetings where week_id = p_week_id;
  if not found or v_meeting.code is null then
    return 'closed';
  end if;
  if now() < v_meeting.opens_at or now() > v_meeting.closes_at then
    return 'closed';
  end if;
  if upper(trim(p_code)) <> upper(trim(v_meeting.code)) then
    return 'invalid_code';
  end if;

  if exists (select 1 from public.attendance
             where week_id = p_week_id and profile_id = v_profile) then
    return 'already';
  end if;

  insert into public.attendance (week_id, profile_id) values (p_week_id, v_profile);

  insert into public.xp_events (profile_id, source, delta, ref, season_id)
  values (v_profile, 'attendance', 10, 'attendance:' || p_week_id, public.active_season_id())
  on conflict (profile_id, source, ref) where ref is not null do nothing;

  return 'ok';
end;
$$;

create or replace function public.review_submission(
  p_submission_id uuid, p_feedback text, p_pass boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile uuid;
begin
  if not public.is_mentor_or_admin() then
    raise exception 'forbidden';
  end if;

  update public.submissions
    set status      = 'reviewed',
        passed      = p_pass,
        feedback    = p_feedback,
        reviewer_id = public.current_profile_id(),
        reviewed_at = now()
    where id = p_submission_id
    returning profile_id into v_profile;

  if v_profile is null then
    raise exception 'submission not found';
  end if;

  if p_pass then
    insert into public.xp_events (profile_id, source, delta, ref, awarded_by, season_id)
    values (v_profile, 'assignment', 20, 'assignment:' || p_submission_id,
            public.current_profile_id(), public.active_season_id())
    on conflict (profile_id, source, ref) where ref is not null do nothing;
  end if;
end;
$$;

-- ── Council: award (or roll back, via negative delta) AIP by hand ────────────
create or replace function public.award_aip(
  p_profile_id uuid, p_source text, p_delta int, p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden';
  end if;

  insert into public.xp_events (profile_id, source, delta, note, awarded_by, season_id)
  values (
    p_profile_id,
    coalesce(nullif(trim(p_source), ''), 'manual'),
    p_delta,
    p_note,
    public.current_profile_id(),
    public.active_season_id()
  );
end;
$$;

-- ── Filterable leaderboard (all-time / season / since-a-date) ─────────────────
create or replace function public.aip_leaderboard(
  p_season uuid default null, p_since timestamptz default null
)
returns table (profile_id uuid, full_name text, avatar_url text, aip int)
language sql
stable
as $$
  select
    p.id,
    p.full_name,
    coalesce(p.avatar_url, ''),
    coalesce(sum(x.delta) filter (
      where (p_season is null or x.season_id = p_season)
        and (p_since  is null or x.created_at >= p_since)
    ), 0)::int as aip
  from public.profiles p
  left join public.xp_events x on x.profile_id = p.id
  group by p.id, p.full_name, p.avatar_url
  order by aip desc, p.full_name asc;
$$;

-- ── Public audit journal: every AIP event, explained ─────────────────────────
create view public.aip_journal
with (security_invoker = true) as
  select
    x.id,
    x.profile_id,
    p.full_name                as member_name,
    coalesce(p.avatar_url, '')  as member_avatar,
    x.source,
    x.delta,
    x.note,
    x.awarded_by,
    a.full_name                as awarder_name,
    x.season_id,
    x.created_at
  from public.xp_events x
  join public.profiles p on p.id = x.profile_id
  left join public.profiles a on a.id = x.awarded_by;

-- ── Grants ───────────────────────────────────────────────────────────────────
grant execute on function public.aip_leaderboard(uuid, timestamptz) to anon, authenticated;
revoke execute on function public.award_aip(uuid, text, int, text) from public, anon;
grant  execute on function public.award_aip(uuid, text, int, text) to authenticated;
