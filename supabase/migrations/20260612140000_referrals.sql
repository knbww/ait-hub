-- Module 8: Referrals & growth.
--
-- Every profile gets a shareable referral_code. A newcomer who follows the link
-- and signs up calls claim_referral() (once, post-login) to attribute themselves
-- to the referrer. When that newcomer reaches week >= 3 of the active season
-- (a submission or attendance), the referrer is automatically awarded +40 AIP
-- (spec §8) — keyed by the referred member so it pays exactly once.

-- ── Referral columns on profiles ─────────────────────────────────────────────
-- The volatile md5 default backfills a distinct code for every existing row.
alter table public.profiles
  add column referral_code     text not null default upper(substr(md5(random()::text), 1, 8)),
  add column referred_by       uuid references public.profiles (id) on delete set null,
  add column referral_rewarded boolean not null default false;

create unique index profiles_referral_code_key on public.profiles (referral_code);

-- ── Attribute the caller to a referrer (called once after login) ─────────────
create or replace function public.claim_referral(p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me       uuid := public.current_profile_id();
  v_existing uuid;
  v_ref      uuid;
begin
  if v_me is null then
    return 'unauthenticated';
  end if;

  select referred_by into v_existing from public.profiles where id = v_me;
  if v_existing is not null then
    return 'already';
  end if;

  select id into v_ref from public.profiles where referral_code = upper(trim(p_code));
  if v_ref is null then
    return 'not_found';
  end if;
  if v_ref = v_me then
    return 'self';
  end if;

  update public.profiles set referred_by = v_ref where id = v_me and referred_by is null;
  return 'ok';
end;
$$;

-- ── Reward the referrer +40 once the referred member reaches week >= 3 ───────
create or replace function public.maybe_reward_referral(p_profile uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_referrer uuid;
  v_rewarded boolean;
  v_reached  boolean;
begin
  select referred_by, referral_rewarded into v_referrer, v_rewarded
  from public.profiles where id = p_profile;
  if v_referrer is null or v_rewarded then
    return;
  end if;

  select exists (
    select 1 from public.submissions s join public.season_weeks w on w.id = s.week_id
      where s.profile_id = p_profile and w.week_number >= 3
    union all
    select 1 from public.attendance a join public.season_weeks w on w.id = a.week_id
      where a.profile_id = p_profile and w.week_number >= 3
  ) into v_reached;
  if not v_reached then
    return;
  end if;

  insert into public.xp_events (profile_id, source, delta, ref, season_id)
  values (v_referrer, 'referral', 40, 'referral:' || p_profile, public.active_season_id())
  on conflict (profile_id, source, ref) where ref is not null do nothing;

  update public.profiles set referral_rewarded = true where id = p_profile;
end;
$$;

-- ── Re-issue the two award functions to trigger the referral reward ──────────
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

  perform public.maybe_reward_referral(v_profile);
  return 'ok';
end;
$$;

create or replace function public.submit_assignment(
  p_week_id uuid, p_link text, p_comment text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile uuid := public.current_profile_id();
begin
  if v_profile is null then
    raise exception 'not authenticated';
  end if;
  if coalesce(trim(p_link), '') = '' then
    raise exception 'link required';
  end if;

  insert into public.submissions (week_id, profile_id, link, comment, status)
  values (p_week_id, v_profile, p_link, p_comment, 'submitted')
  on conflict (week_id, profile_id) do update
    set link        = excluded.link,
        comment     = excluded.comment,
        status      = 'submitted',
        passed      = null,
        reviewer_id = null,
        feedback    = null,
        reviewed_at = null;

  perform public.maybe_reward_referral(v_profile);
end;
$$;

-- ── Council funnel view ──────────────────────────────────────────────────────
create view public.referral_funnel
with (security_invoker = true) as
  select
    r.id          as referrer_id,
    r.full_name   as referrer_name,
    p.id          as member_id,
    p.full_name   as member_name,
    p.created_at  as joined_at,
    p.referral_rewarded as rewarded,
    exists (
      select 1 from public.submissions s join public.season_weeks w on w.id = s.week_id
        where s.profile_id = p.id and w.week_number >= 3
      union all
      select 1 from public.attendance a join public.season_weeks w on w.id = a.week_id
        where a.profile_id = p.id and w.week_number >= 3
    ) as reached_week3
  from public.profiles p
  join public.profiles r on r.id = p.referred_by;

-- ── Grants ───────────────────────────────────────────────────────────────────
revoke execute on function public.maybe_reward_referral(uuid) from public, anon, authenticated;
revoke execute on function public.claim_referral(text)        from public, anon;
grant  execute on function public.claim_referral(text)        to authenticated;
