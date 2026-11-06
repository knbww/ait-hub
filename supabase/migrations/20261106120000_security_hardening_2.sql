-- Security hardening, part two (November 2026). What holds from here on, checked by
-- scripts/db-test.mjs and by scripts/security/stack-test.mjs on a real local stack:
--
--  * A verified second factor protects the data itself. A session without the code is nobody: it
--    sees only the caller's own profile row, which the sign-in screen needs.
--  * Director and curator powers need a session confirmed with a code, and so do other people's
--    contacts, for the leads too. Without one the account stays an ordinary member, who can sign in
--    and turn the factor on.
--  * Access helpers always answer true or false: `if not x` lets a null through.
--  * The accounts of the club's management are reset by the director only.
--  * Passwords set here use bcrypt cost 10, like Supabase Auth.
--  * Push endpoints are the browsers' own services: the function sends to whatever is stored.
--  * Files have limits per member and per project. A photo needs a yes and is readable only while
--    it is on a profile. Deleting someone else's files needs the code.
--  * The two functions open to guests limit attempts.
--  * New functions start closed: schema-level default privileges can't take away PostgreSQL's
--    global grant to PUBLIC, so it is taken away globally here.

-- ── Internal schema: not exposed through the API ────────────────────────────
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.settings (
  key   text primary key,
  value text not null
);

create table private.rate_limits (
  bucket       text not null,
  window_start timestamptz not null,
  hits         int not null default 0,
  primary key (bucket, window_start)
);

-- ── New functions are private by default ────────────────────────────────────
alter default privileges revoke execute on functions from public;

-- ── Attempts ────────────────────────────────────────────────────────────────
-- True while the bucket is under its limit. Called by functions that return a refusal instead of
-- raising: an error would roll the count back along with everything else.
create or replace function private.hit_limit(p_bucket text, p_max int, p_window interval)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_hits int;
begin
  insert into private.rate_limits as r (bucket, window_start, hits)
  values (left(p_bucket, 200), date_bin(p_window, now(), timestamptz '2000-01-01'), 1)
  on conflict (bucket, window_start) do update set hits = r.hits + 1
  returning hits into v_hits;
  return v_hits <= p_max;
end;
$$;

-- The visitor's address as the API gateway saw it. Cloudflare in front of Supabase sets
-- cf-connecting-ip itself, so it can't be forged; the first entry of x-forwarded-for can.
create or replace function private.client_ip()
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_headers jsonb;
begin
  v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  return left(coalesce(
    nullif(v_headers ->> 'cf-connecting-ip', ''),
    nullif(btrim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), ''),
    nullif(v_headers ->> 'x-real-ip', ''),
    'unknown'
  ), 64);
exception
  when others then
    return 'unknown';
end;
$$;

-- Limits what one signed-in person can create. Maintenance runs without a user aren't counted.
create or replace function private.throttle_inserts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and not private.hit_limit(tg_table_name || ':' || auth.uid()::text, tg_argv[0]::int, tg_argv[1]::interval) then
    raise exception 'too_fast';
  end if;
  return new;
end;
$$;

create trigger trg_throttle_inserts before insert on public.projects
  for each row execute function private.throttle_inserts('20', '1 day');
create trigger trg_throttle_inserts before insert on public.teams
  for each row execute function private.throttle_inserts('10', '1 day');
create trigger trg_throttle_inserts before insert on public.message_reports
  for each row execute function private.throttle_inserts('30', '1 hour');
create trigger trg_throttle_inserts before insert on public.push_subscriptions
  for each row execute function private.throttle_inserts('30', '1 day');

-- ── Second factor ───────────────────────────────────────────────────────────
-- The session is confirmed with a code. The demo copy (supabase/seed.sql) switches the staff
-- requirement off, so every role can be shown without an authenticator app.
create or replace function public.is_aal2()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    or exists (select 1 from private.settings where key = 'mfa_optional' and value = 'demo')
$$;

-- False for an account with a verified factor whose session hasn't passed it. Definer: the
-- signed-in role can't read auth.mfa_factors.
create or replace function public.mfa_ok()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
    or not exists (select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified')
$$;

create or replace function public.require_mfa()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if not public.is_aal2() then
    raise exception 'mfa_required';
  end if;
end;
$$;

-- ── Who the caller is ───────────────────────────────────────────────────────
create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.profiles where user_id = auth.uid() and public.mfa_ok()
$$;

create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where user_id = auth.uid() and status = 'active' and public.mfa_ok()
$$;

create or replace function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.mfa_ok()
    and exists (select 1 from public.profiles where user_id = auth.uid() and status = 'active')
$$;

-- ── What the caller may do: always true or false, never null ────────────────
create or replace function public.can_manage(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_oversight() then public.is_aal2()
    when public.my_role() = 'track_lead' then exists (
      select 1 from public.profiles t
      where t.id = p_profile
        and t.role = 'member'
        and t.track_id is not null
        and t.track_id = public.my_track_id()
    )
    else false
  end
$$;

create or replace function public.can_edit_track(p_track text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (public.is_oversight() and public.is_aal2())
    or (public.my_role() = 'track_lead' and p_track is not null and p_track = public.my_track_id()),
    false
  )
$$;

create or replace function public.can_edit_project(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.is_active_member() and (
      exists (select 1 from public.projects where id = p_project and owner_id = public.current_profile_id())
      or (public.is_oversight() and public.is_aal2())
      or (public.my_role() = 'track_lead' and exists (
        select 1 from public.project_members pm join public.profiles p on p.id = pm.profile_id
        where pm.project_id = p_project and p.track_id = public.my_track_id()
      ))
    ),
    false
  )
$$;

-- A switched-off captain no longer runs the team.
create or replace function public.can_manage_team(p_team uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_active_member() and exists (
    select 1 from public.teams t
    where t.id = p_team
      and (t.captain_id = public.current_profile_id() or public.can_edit_track(t.track_id))
  )
$$;

-- ── Policies that named director / curator directly ─────────────────────────
drop policy if exists tracks_update on public.tracks;
create policy tracks_update on public.tracks for update to authenticated
  using (public.can_edit_track(id))
  with check (public.can_edit_track(id));

drop policy if exists program_weeks_update on public.program_weeks;
create policy program_weeks_update on public.program_weeks for update to authenticated
  using (public.can_edit_track(track_id))
  with check (public.can_edit_track(track_id));

drop policy if exists join_codes_select on public.join_codes;
create policy join_codes_select on public.join_codes for select to authenticated
  using (public.can_edit_track(track_id));

drop policy if exists audit_log_select on public.audit_log;
create policy audit_log_select on public.audit_log for select to authenticated
  using (public.is_oversight() and public.is_aal2());

drop policy if exists message_reports_select on public.message_reports;
create policy message_reports_select on public.message_reports for select to authenticated
  using ((public.is_oversight() and public.is_aal2()) or reporter_id = (select public.current_profile_id()));

drop policy if exists opportunities_delete on public.opportunities;
create policy opportunities_delete on public.opportunities for delete to authenticated
  using (
    (public.is_oversight() and public.is_aal2())
    or (public.is_staff() and created_by = (select public.current_profile_id()))
  );

-- Other people's contacts need the code, for the leads too.
drop policy if exists member_private_select on public.member_private;
create policy member_private_select on public.member_private for select to authenticated
  using (profile_id = public.current_profile_id() or (public.can_manage(profile_id) and public.is_aal2()));

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (user_id = (select auth.uid()) and public.mfa_ok())
  with check (user_id = (select auth.uid()) and public.mfa_ok());

-- Left from the access-token hook, removed in October.
drop policy if exists profiles_auth_hook_read on public.profiles;
revoke select on public.profiles from supabase_auth_admin;

-- Who didn't agree to photos, for the reminder in the post form: names only, so writing a post
-- doesn't take reading contacts. A lead sees their track; director / curator see everyone.
create or replace function public.photo_refusals()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select p.full_name
  from public.profiles p
  left join public.member_private mp on mp.profile_id = p.id
  where public.is_staff()
    and p.status = 'active'
    and mp.photo_consent is not true
    and (public.is_oversight() or p.id = public.current_profile_id()
         or (p.role = 'member' and p.track_id = public.my_track_id()))
  order by p.full_name
$$;

-- ── Staff actions that skipped the second factor ────────────────────────────
create or replace function public.set_schedule(p_start date, p_last_week int default 36)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_oversight() then
    raise exception 'forbidden';
  end if;
  perform public.require_mfa();
  if p_start is null or p_last_week not between 1 and 36 then
    raise exception 'invalid_schedule';
  end if;

  delete from public.cohort_weeks where cohort_id = public.default_cohort_id();
  insert into public.cohort_weeks (cohort_id, week_number, starts_on)
  select public.default_cohort_id(), n, p_start + (n - 1) * 7
  from generate_series(1, p_last_week) as n;

  perform public.log_action('schedule_set', null,
    jsonb_build_object('start', p_start, 'last_week', p_last_week));
end;
$$;

create or replace function public.shift_schedule(p_from_week int, p_days int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_oversight() then
    raise exception 'forbidden';
  end if;
  perform public.require_mfa();
  if p_days is null or p_days = 0 or abs(p_days) > 120 then
    raise exception 'invalid_shift';
  end if;

  update public.cohort_weeks
    set starts_on = starts_on + p_days
    where cohort_id = public.default_cohort_id() and week_number >= p_from_week;

  perform public.log_action('schedule_shifted', null,
    jsonb_build_object('from_week', p_from_week, 'days', p_days));
end;
$$;

create or replace function public.set_member_track(p_profile uuid, p_track text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text;
begin
  if not public.is_director() then
    raise exception 'forbidden';
  end if;
  perform public.require_mfa();
  if p_track is not null and not exists (select 1 from public.tracks where id = p_track) then
    raise exception 'invalid_track';
  end if;
  select track_id into v_old from public.profiles where id = p_profile;
  if not found then
    raise exception 'not_found';
  end if;

  update public.profiles set track_id = p_track where id = p_profile;
  perform public.log_action('track_changed', p_profile, jsonb_build_object('from', v_old, 'to', p_track));
end;
$$;

create or replace function public.set_member_status(p_profile uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.profiles%rowtype;
begin
  if p_status not in ('active', 'inactive') then
    raise exception 'invalid_status';
  end if;
  select * into v_target from public.profiles where id = p_profile;
  if not found then
    raise exception 'not_found';
  end if;
  if public.is_director() then
    perform public.require_mfa();
  elsif not coalesce(public.my_role() = 'track_lead' and public.can_manage(p_profile), false) then
    raise exception 'forbidden';
  end if;
  if p_profile = public.current_profile_id() then
    raise exception 'cannot_change_self';
  end if;
  if v_target.role = 'director' and p_status = 'inactive'
     and (select count(*) from public.profiles where role = 'director' and status = 'active') <= 1 then
    raise exception 'last_director';
  end if;

  update public.profiles set status = p_status where id = p_profile;
  perform public.log_action('status_changed', p_profile,
    jsonb_build_object('from', v_target.status, 'to', p_status));
end;
$$;

create or replace function public.resolve_report(p_report uuid, p_remove boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.message_reports%rowtype;
begin
  if not public.is_oversight() then
    raise exception 'forbidden';
  end if;
  perform public.require_mfa();
  select * into v_report from public.message_reports where id = p_report;
  if not found then
    raise exception 'not_found';
  end if;
  update public.message_reports
    set status = case when p_remove then 'removed' else 'dismissed' end,
        resolved_at = now(),
        resolved_by = public.current_profile_id()
    where status = 'open' and (id = p_report or (v_report.message_id is not null and message_id = v_report.message_id));
  if p_remove and v_report.message_id is not null then
    delete from public.messages where id = v_report.message_id;
  end if;
end;
$$;

create or replace function public.rotate_join_code(p_track text, p_days int default 14, p_max_uses int default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  -- my_role() is null for a switched-off or unconfirmed account: coalesce, or `not null` lets it by.
  if not (public.is_oversight()
          or coalesce(public.my_role() = 'track_lead' and public.my_track_id() = p_track, false)) then
    raise exception 'forbidden';
  end if;
  if public.is_oversight() then
    perform public.require_mfa();
  end if;
  if not exists (select 1 from public.tracks where id = p_track) then
    raise exception 'invalid_track';
  end if;
  if p_days is null or p_days not between 1 and 90 or (p_max_uses is not null and p_max_uses not between 1 and 500) then
    raise exception 'invalid_code_terms';
  end if;

  update public.join_codes
    set active = false
    where track_id = p_track and cohort_id = public.default_cohort_id() and active;

  loop
    v_code := public.generate_join_code();
    exit when not exists (select 1 from public.join_codes where code = v_code);
  end loop;

  insert into public.join_codes (code, track_id, cohort_id, created_by, expires_at, max_uses)
  values (v_code, p_track, public.default_cohort_id(), public.current_profile_id(),
          now() + make_interval(days => p_days), p_max_uses);
  perform public.log_action('join_code_rotated', null,
    jsonb_build_object('track', p_track, 'days', p_days, 'max_uses', p_max_uses));
  return v_code;
end;
$$;

-- ── Null-safe self checks ───────────────────────────────────────────────────
create or replace function public.remove_team_member(p_team uuid, p_profile uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team public.teams%rowtype;
begin
  select * into v_team from public.teams where id = p_team;
  if not found then
    raise exception 'not_found';
  end if;
  if p_profile is distinct from public.current_profile_id() and not public.can_manage_team(p_team) then
    raise exception 'forbidden';
  end if;

  delete from public.team_members where team_id = p_team and profile_id = p_profile;
  delete from public.team_requests where team_id = p_team and profile_id = p_profile;

  if v_team.captain_id = p_profile then
    update public.teams
      set captain_id = (
        select profile_id from public.team_members where team_id = p_team order by joined_at limit 1
      )
      where id = p_team;
  end if;
  if not exists (select 1 from public.team_members where team_id = p_team) then
    update public.teams set status = 'archived' where id = p_team;
  end if;
end;
$$;

create or replace function public.remove_project_member(p_project uuid, p_profile uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_profile is distinct from public.current_profile_id() and not public.can_edit_project(p_project) then
    raise exception 'forbidden';
  end if;
  delete from public.project_members where project_id = p_project and profile_id = p_profile;
end;
$$;

create or replace function public.export_member_data(p_profile uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  -- A session with no profile compares to null; `not null` would let it through.
  if p_profile is distinct from public.current_profile_id() then
    if public.is_oversight() then
      perform public.require_mfa();
    end if;
    if not public.can_manage(p_profile) then
      raise exception 'forbidden';
    end if;
    perform public.require_mfa();
  end if;

  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) - 'user_id' from public.profiles p where p.id = p_profile),
    'contacts', (select to_jsonb(mp) - 'profile_id' from public.member_private mp where mp.profile_id = p_profile),
    'works', coalesce((
      select jsonb_agg(jsonb_build_object(
        'week', w.week_number, 'title', w.title, 'link', s.link, 'comment', s.comment,
        'files', (select coalesce(jsonb_agg(f ->> 'name'), '[]'::jsonb) from jsonb_array_elements(s.files) f),
        'status', s.status, 'feedback', s.feedback,
        'submitted_at', s.submitted_at, 'reviewed_at', s.reviewed_at
      ) order by w.week_number)
      from public.submissions s join public.program_weeks w on w.id = s.week_id
      where s.profile_id = p_profile
    ), '[]'::jsonb),
    'attendance', coalesce((
      select jsonb_agg(jsonb_build_object('week', w.week_number, 'meeting', a.kind, 'marked_at', a.marked_at)
                       order by w.week_number, a.kind)
      from public.attendance a join public.program_weeks w on w.id = a.week_id
      where a.profile_id = p_profile
    ), '[]'::jsonb),
    'ait_points', coalesce((
      select jsonb_agg(jsonb_build_object(
        'amount', e.amount, 'category', e.category, 'note', e.note,
        'confirmed_by', a.full_name, 'created_at', e.created_at
      ) order by e.created_at)
      from public.points_entries e left join public.profiles a on a.id = e.awarded_by
      where e.profile_id = p_profile
    ), '[]'::jsonb),
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object('team', t.name, 'track', t.track_id, 'joined_at', m.joined_at))
      from public.team_members m join public.teams t on t.id = m.team_id
      where m.profile_id = p_profile
    ), '[]'::jsonb),
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object(
        'project', pr.title, 'role', pm.role, 'contribution', pm.contribution,
        'confirmed', pm.confirmed_at is not null
      ))
      from public.project_members pm join public.projects pr on pr.id = pm.project_id
      where pm.profile_id = p_profile
    ), '[]'::jsonb),
    'rating_results', coalesce((
      select jsonb_agg(jsonb_build_object(
        'event', e.title, 'track', e.track_id, 'date', e.starts_at,
        'place', r.place, 'score', r.score, 'rating_delta', r.rating_delta
      ) order by e.starts_at)
      from public.rating_results r join public.events e on e.id = r.event_id
      where r.profile_id = p_profile and e.status = 'completed'
    ), '[]'::jsonb),
    'news_comments', coalesce((
      select jsonb_agg(jsonb_build_object('news', n.title, 'comment', c.body, 'created_at', c.created_at)
                       order by c.created_at)
      from public.news_comments c join public.news n on n.id = c.news_id
      where c.author_id = p_profile
    ), '[]'::jsonb),
    'saved_opportunities', coalesce((
      select jsonb_agg(jsonb_build_object('title', o.title, 'saved_at', s.created_at) order by s.created_at)
      from public.opportunity_saves s join public.opportunities o on o.id = s.opportunity_id
      where s.profile_id = p_profile
    ), '[]'::jsonb)
  ) into v_result;

  if p_profile is distinct from public.current_profile_id() then
    perform public.log_action('member_data_exported', p_profile, '{}'::jsonb);
  end if;
  return v_result;
end;
$$;

-- ── Passwords and reset codes ───────────────────────────────────────────────
-- Unused since reset codes arrived, and the opposite of their promise: nobody else knows a
-- member's password.
drop function if exists public.admin_set_password(uuid, text);

-- bcrypt reads 72 bytes at most: longer passwords would be cut without a word. Letters are
-- Latin or Cyrillic.
create or replace function public.strong_password(p_password text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select char_length(coalesce(p_password, '')) >= 10
    and octet_length(coalesce(p_password, '')) <= 72
    and coalesce(p_password, '') ~ '[A-Za-zА-Яа-яЁё]'
    and coalesce(p_password, '') ~ '[0-9]'
$$;

-- Staff who manage the member issue a code. An account of the club's management is the director's
-- to reset: a curator manages everyone, but must not get into the director's account this way.
create or replace function public.create_reset_code(p_profile uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_role text;
begin
  if public.is_oversight() then
    perform public.require_mfa();
  end if;
  if not public.can_manage(p_profile) or p_profile = public.current_profile_id() then
    raise exception 'forbidden';
  end if;
  perform public.require_mfa();
  select role into v_role from public.profiles where id = p_profile and user_id is not null;
  if not found then
    raise exception 'not_found';
  end if;
  if v_role in ('director', 'curator') and not public.is_director() then
    raise exception 'forbidden';
  end if;

  v_code := public.generate_join_code();
  insert into public.password_reset_codes (profile_id, code_hash, attempts, expires_at, created_by, created_at)
  values (p_profile, extensions.crypt(v_code, extensions.gen_salt('bf')), 0, now() + interval '15 minutes',
          public.current_profile_id(), now())
  on conflict (profile_id) do update
    set code_hash = excluded.code_hash, attempts = 0, expires_at = excluded.expires_at,
        created_by = excluded.created_by, created_at = excluded.created_at;
  perform public.log_action('reset_code_issued', p_profile, '{}'::jsonb);
  return v_code;
end;
$$;

-- The member, signed out: email + code + new password. Returns 'ok', 'invalid' (the same for a
-- wrong email, a wrong or expired code — nothing tells which, the time it takes included) or
-- 'slow_down' after too many attempts from one address. Wrong tries are counted without an error,
-- so the count survives; the fifth one cancels the code.
create or replace function public.reset_password_with_code(p_email text, p_code text, p_password text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile  uuid;
  v_user     uuid;
  v_reset    public.password_reset_codes%rowtype;
  v_sessions boolean := true;
begin
  if not public.strong_password(p_password) then
    raise exception 'weak_password';
  end if;
  if not private.hit_limit('reset:' || private.client_ip(), 15, interval '15 minutes')
     or not private.hit_limit('reset:all', 300, interval '1 minute') then
    return 'slow_down';
  end if;

  select p.id, p.user_id into v_profile, v_user
  from public.member_private mp join public.profiles p on p.id = mp.profile_id
  where lower(mp.email) = lower(btrim(left(coalesce(p_email, ''), 320)))
    and p.user_id is not null and p.status <> 'inactive';

  if v_profile is not null then
    select * into v_reset from public.password_reset_codes where profile_id = v_profile for update;
  end if;
  if v_reset.profile_id is null or v_reset.expires_at <= now() then
    -- As much work as checking a real code.
    perform extensions.crypt('', extensions.gen_salt('bf'));
    return 'invalid';
  end if;
  if extensions.crypt(upper(btrim(left(coalesce(p_code, ''), 32))), v_reset.code_hash) <> v_reset.code_hash then
    if v_reset.attempts + 1 >= 5 then
      delete from public.password_reset_codes where profile_id = v_profile;
    else
      update public.password_reset_codes set attempts = attempts + 1 where profile_id = v_profile;
    end if;
    return 'invalid';
  end if;

  update auth.users
    set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf', 10)), updated_at = now()
    where id = v_user;
  -- Signed out everywhere else: whoever knew the old password loses the session too.
  begin
    delete from auth.sessions where user_id = v_user;
  exception
    when insufficient_privilege then v_sessions := false;
  end;
  delete from public.password_reset_codes where profile_id = v_profile;
  perform public.log_action('password_reset_by_code', v_profile, jsonb_build_object('sessions_revoked', v_sessions));
  return 'ok';
end;
$$;

-- Guessing a join code. A limit is treated as a wrong code: the page says the same either way. It
-- is generous for one address, because a whole class scans the QR from one school network, and
-- still hopeless for guessing: 3 live codes among 8.5 * 10^11.
create or replace function public.check_join_code(p_code text)
returns table (track_id text, track_title text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.hit_limit('join:' || private.client_ip(), 200, interval '10 minutes')
     or not private.hit_limit('join:all', 600, interval '1 minute') then
    return;
  end if;
  return query
    select t.id, t.title
    from public.usable_join_code(left(p_code, 32)) c
    join public.tracks t on t.id = c.track_id;
end;
$$;

-- ── Sign-up ─────────────────────────────────────────────────────────────────
-- A staff invite lasts three days. Names lose control and direction characters, which can make
-- one name look like another.
create or replace function public.profiles_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.full_name := btrim(regexp_replace(new.full_name, '[\u0001-\u001F\u007F-\u009F​-‏ -‮⁠-⁯﻿]', '', 'g'));
  new.github_username := nullif(btrim(new.github_username), '');
  new.codeforces_handle := nullif(btrim(new.codeforces_handle), '');
  if new.avatar_path is not null then
    -- An avatar must be the member's own upload…
    if split_part(new.avatar_path, '/', 1) <> new.user_id::text then
      raise exception 'avatar_path_foreign';
    end if;
    -- …and only with a "yes" to photos.
    if not coalesce((select mp.photo_consent from public.member_private mp where mp.profile_id = new.id), false) then
      new.avatar_path := null;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta      jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_code    public.join_codes%rowtype;
  v_invite  public.staff_invites%rowtype;
  v_name    text := btrim(coalesce(meta ->> 'full_name', ''));
  v_grade   int;
  v_profile uuid;
begin
  -- Staff, created in the dashboard (no join code in the metadata).
  if coalesce(meta ->> 'join_code', '') = '' then
    -- A bcrypt hash from Supabase Auth; users without a password (GitHub) never match.
    if coalesce(new.encrypted_password, '') like '$2%' then
      delete from public.staff_invites
      where email = lower(btrim(coalesce(new.email, '')))
        and created_at > now() - interval '3 days'
        and new.encrypted_password = extensions.crypt(temp_password, new.encrypted_password)
      returning * into v_invite;
    end if;
    if v_invite.email is null then
      raise exception 'invalid_join_code';
    end if;

    insert into public.profiles (user_id, full_name, role, grade, track_id, cohort_id, status)
    values (new.id, btrim(v_invite.full_name), v_invite.role, null, null, public.default_cohort_id(), 'active')
    on conflict (user_id) do nothing
    returning id into v_profile;

    if v_profile is not null then
      insert into public.member_private (profile_id, email) values (v_profile, new.email);
      perform public.log_action('staff_account_created', v_profile, jsonb_build_object('role', v_invite.role));
    end if;
    return new;
  end if;

  select * into v_code from public.usable_join_code(meta ->> 'join_code');
  if not found then
    raise exception 'invalid_join_code';
  end if;

  if char_length(v_name) not between 1 and 120 then
    raise exception 'invalid_full_name';
  end if;

  begin
    v_grade := (meta ->> 'grade')::int;
  exception
    when others then v_grade := null;
  end;
  if v_grade is null or v_grade not between 7 and 12 then
    raise exception 'invalid_grade';
  end if;

  -- A pupil joins as «pending» until their lead (or the director / curator) confirms them.
  insert into public.profiles (user_id, full_name, role, grade, track_id, cohort_id, status)
  values (new.id, v_name, 'member', v_grade, v_code.track_id, v_code.cohort_id, 'pending')
  on conflict (user_id) do nothing
  returning id into v_profile;

  if v_profile is not null then
    update public.join_codes set uses = uses + 1 where code = v_code.code;
    insert into public.member_private (profile_id, email, telegram, photo_consent)
    values (
      v_profile, new.email, nullif(left(btrim(coalesce(meta ->> 'telegram', '')), 64), ''),
      case meta ->> 'photo_consent' when 'true' then true when 'false' then false end
    );
  end if;
  return new;
end;
$$;

-- ── Push ────────────────────────────────────────────────────────────────────
-- The function sends to whatever is stored here, so only the browsers' own push services are
-- accepted: Chrome and everything built on it, Firefox, Safari, Edge.
create or replace function public.is_push_endpoint(p_url text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(p_url, '') ~* '^https://(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/'
$$;

delete from public.push_subscriptions where not public.is_push_endpoint(endpoint);

create or replace function public.register_push(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := public.current_profile_id();
begin
  if v_me is null or not public.is_active_member() then
    raise exception 'not_authenticated';
  end if;
  if not public.is_push_endpoint(btrim(p_endpoint)) then
    raise exception 'invalid_push_endpoint';
  end if;
  insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth, user_agent)
  values (v_me, btrim(p_endpoint), btrim(p_p256dh), btrim(p_auth), left(nullif(btrim(coalesce(p_user_agent, '')), ''), 300))
  on conflict (endpoint) do update
    set profile_id = excluded.profile_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, created_at = now(), last_used_at = null;
  -- Ten devices a member at most: the oldest ones go.
  delete from public.push_subscriptions
  where id in (
    select id from public.push_subscriptions where profile_id = v_me
    order by coalesce(last_used_at, created_at) desc offset 10
  );
end;
$$;

-- Each event is announced once, however many times the function is asked to.
create table public.push_once (
  key        text primary key check (char_length(key) <= 120),
  created_at timestamptz not null default now()
);
alter table public.push_once enable row level security;
revoke all on public.push_once from anon, authenticated;

-- ── Files ───────────────────────────────────────────────────────────────────
-- Stops well before the free plan's gigabyte: a full project is switched off, a refused upload isn't.
create or replace function public.storage_has_room()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum((o.metadata ->> 'size')::bigint), 0) < 900 * 1024 * 1024 from storage.objects o
$$;

-- 36 weeks of three files, with room for replaced ones; 100 MB in all.
create or replace function public.can_upload_work(p_folder text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.storage_has_room() and (
    select count(*) < 150 and coalesce(sum((o.metadata ->> 'size')::bigint), 0) < 100 * 1024 * 1024
    from storage.objects o
    where o.bucket_id = 'works' and starts_with(o.name, p_folder || '/')
  )
$$;

-- With a "yes" to photos, and no more than a replacement needs.
create or replace function public.may_store_avatar()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.storage_has_room()
    and coalesce((
      select mp.photo_consent from public.member_private mp
      join public.profiles p on p.id = mp.profile_id
      where p.user_id = auth.uid()
    ), false)
    and (
      select count(*) < 3 from storage.objects o
      where o.bucket_id = 'avatars' and starts_with(o.name, auth.uid()::text || '/')
    )
$$;

-- Only a photo someone's profile shows now: one taken down or never put on a profile stays private.
create or replace function public.is_avatar_shown(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles p where p.avatar_path = p_path)
$$;

drop policy if exists avatars_read on storage.objects;
create policy avatars_read on storage.objects for select to authenticated
  using (
    bucket_id = 'avatars'
    and public.is_active_member()
    and (
      (storage.foldername(name))[1] = (select auth.uid())::text
      or public.is_avatar_shown(name)
      or (public.is_director() and public.is_aal2())
    )
  );

drop policy if exists avatars_insert_own on storage.objects;
create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_active_member()
    and public.may_store_avatar()
  );

-- The Hub never overwrites a photo: a new one is a new file.
drop policy if exists avatars_update_own on storage.objects;

drop policy if exists avatars_delete on storage.objects;
create policy avatars_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (public.is_director() and public.is_aal2()))
  );

drop policy if exists works_insert on storage.objects;
create policy works_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'works'
    and (storage.foldername(name))[1] = (select public.current_profile_id())::text
    and array_length(storage.foldername(name), 1) = 1
    and public.is_work_file_name(substr(name, char_length((storage.foldername(name))[1]) + 2))
    and public.is_active_member()
    and public.can_upload_work((storage.foldername(name))[1])
  );

drop policy if exists works_delete on storage.objects;
create policy works_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'works'
    and ((storage.foldername(name))[1] = (select public.current_profile_id())::text or (public.is_director() and public.is_aal2()))
  );

drop policy if exists news_photos_insert on storage.objects;
create policy news_photos_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'news'
    and public.can_edit_news_folder((storage.foldername(name))[1])
    and public.storage_has_room()
  );

-- ── Live updates: a private channel for each member ─────────────────────────
-- With "Allow public access" off in Realtime Settings, nobody without a session can open a
-- channel. Rows still arrive under the rules of the table; this only says who joins the topic.
do $$
begin
  if to_regclass('realtime.messages') is not null then
    drop policy if exists chats_own_channel on realtime.messages;
    create policy chats_own_channel on realtime.messages for select to authenticated
      using ((select realtime.topic()) = 'chats-' || (select public.current_profile_id())::text);
  end if;
end;
$$;

-- ── Daily tidy-up ───────────────────────────────────────────────────────────
-- Run by the push function's daily call.
create or replace function public.security_housekeeping()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.password_reset_codes where expires_at < now();
  delete from public.staff_invites where created_at < now() - interval '3 days';
  delete from private.rate_limits where window_start < now() - interval '2 days';
  delete from public.push_once where created_at < now() - interval '7 days';
  delete from public.push_subscriptions where coalesce(last_used_at, created_at) < now() - interval '180 days';
end;
$$;

-- ── Who may call what ───────────────────────────────────────────────────────
revoke execute on all functions in schema public from public, anon;
grant execute on function public.check_join_code(text) to anon, authenticated;
grant execute on function public.reset_password_with_code(text, text, text) to anon, authenticated;

revoke execute on function
  public.strong_password(text), public.security_housekeeping()
  from authenticated;
grant execute on function public.security_housekeeping() to service_role;
