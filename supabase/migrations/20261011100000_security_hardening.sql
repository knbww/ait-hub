-- Security hardening (October 2026), after the Supabase security advisor and the removal of the
-- June automation:
--  * pg_net goes: nothing in the database calls out any more.
--  * The optional access-token hook goes: access rules read roles from the database.
--  * Trigger functions can't be called through the API.
--  * Staff actions on other people's data — exports, deletion, role changes, password resets —
--    need a session confirmed with a second factor (a code from an authenticator app).
--  * Foreign keys get indexes; the dashboard-layout policy reads the caller once per query.

drop extension if exists pg_net;
drop function if exists public.custom_access_token_hook(jsonb);

revoke execute on function
  public.events_after_write(), public.events_before_write(), public.handle_new_user(),
  public.member_private_after_consent(), public.member_private_before_write(),
  public.news_before_write(), public.profiles_before_write(),
  public.project_members_before_update(), public.projects_before_update(),
  public.rating_results_before_write(), public.team_members_guard()
  from public, anon, authenticated;

-- ── Second factor for sensitive staff actions ───────────────────────────────
-- Supabase puts the assurance level of the session into the token: aal2 after an
-- authenticator-app code. Called from the security-definer functions below, after their own
-- permission check, so the error tells staff what is missing.
create or replace function public.require_mfa()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required';
  end if;
end;
$$;
revoke execute on function public.require_mfa() from public, anon, authenticated;

create or replace function public.export_members()
returns table (
  full_name text, grade int, track text, role text, status text,
  email text, telegram text, photo_consent boolean, points int, joined_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'forbidden';
  end if;
  perform public.require_mfa();
  perform public.log_action('export_members', null, '{}'::jsonb);

  return query
    select p.full_name, p.grade, t.title, p.role, p.status, mp.email, mp.telegram, mp.photo_consent,
           coalesce((select sum(e.amount) from public.points_entries e where e.profile_id = p.id), 0)::int,
           p.created_at
    from public.profiles p
    left join public.tracks t on t.id = p.track_id
    left join public.member_private mp on mp.profile_id = p.id
    where public.can_manage(p.id)
    order by t.sort nulls last, p.full_name;
end;
$$;

create or replace function public.export_points()
returns table (
  created_at timestamptz, member text, track text, amount int,
  category text, note text, awarded_by text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'forbidden';
  end if;
  perform public.require_mfa();
  perform public.log_action('export_points', null, '{}'::jsonb);

  return query
    select e.created_at, p.full_name, t.title, e.amount, e.category, e.note, a.full_name
    from public.points_entries e
    join public.profiles p on p.id = e.profile_id
    left join public.tracks t on t.id = p.track_id
    left join public.profiles a on a.id = e.awarded_by
    where public.can_manage(e.profile_id)
    order by e.created_at;
end;
$$;

create or replace function public.export_results()
returns table (
  kind text, member text, track text, item text, status text,
  place int, score numeric, rating_delta int, happened_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'forbidden';
  end if;
  perform public.require_mfa();
  perform public.log_action('export_results', null, '{}'::jsonb);

  return query
    select 'work'::text, p.full_name, t.title,
           'Неделя ' || w.week_number || ' · ' || w.title, s.status,
           null::int, null::numeric, null::int, s.submitted_at
    from public.submissions s
    join public.profiles p on p.id = s.profile_id
    join public.program_weeks w on w.id = s.week_id
    left join public.tracks t on t.id = w.track_id
    where public.can_manage(s.profile_id)
    union all
    select 'rating'::text, coalesce(p.full_name, tm.name), t.title, e.title, e.status,
           r.place, r.score, r.rating_delta, e.starts_at
    from public.rating_results r
    join public.events e on e.id = r.event_id
    left join public.profiles p on p.id = r.profile_id
    left join public.teams tm on tm.id = r.team_id
    left join public.tracks t on t.id = e.track_id
    where e.status = 'completed' and public.can_edit_track(e.track_id)
    order by 9;
end;
$$;

-- A member downloads their own data freely; staff need the second factor for anyone else's.
create or replace function public.export_member_data(p_profile uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not (p_profile = public.current_profile_id() or public.can_manage(p_profile)) then
    raise exception 'forbidden';
  end if;
  if p_profile is distinct from public.current_profile_id() then
    perform public.require_mfa();
  end if;

  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) - 'user_id' from public.profiles p where p.id = p_profile),
    'contacts', (select to_jsonb(mp) - 'profile_id' from public.member_private mp where mp.profile_id = p_profile),
    'works', coalesce((
      select jsonb_agg(jsonb_build_object(
        'week', w.week_number, 'title', w.title, 'link', s.link, 'comment', s.comment,
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
    ), '[]'::jsonb)
  ) into v_result;

  if p_profile <> public.current_profile_id() then
    perform public.log_action('member_data_exported', p_profile, '{}'::jsonb);
  end if;
  return v_result;
end;
$$;

create or replace function public.set_member_role(p_profile uuid, p_role text)
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
  if p_role not in ('member', 'track_lead', 'director', 'curator') then
    raise exception 'invalid_role';
  end if;
  select role into v_old from public.profiles where id = p_profile;
  if not found then
    raise exception 'not_found';
  end if;
  if v_old = 'director' and p_role <> 'director'
     and (select count(*) from public.profiles where role = 'director' and status = 'active') <= 1 then
    raise exception 'last_director';
  end if;

  update public.profiles set role = p_role where id = p_profile;
  perform public.log_action('role_changed', p_profile, jsonb_build_object('from', v_old, 'to', p_role));
end;
$$;

create or replace function public.admin_set_password(p_profile uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if not public.is_director() then
    raise exception 'forbidden';
  end if;
  perform public.require_mfa();
  if char_length(coalesce(p_password, '')) < 8 then
    raise exception 'weak_password';
  end if;
  select user_id into v_user from public.profiles where id = p_profile;
  if v_user is null then
    raise exception 'not_found';
  end if;

  update auth.users
    set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
        updated_at = now()
    where id = v_user;
  perform public.log_action('password_reset', p_profile, '{}'::jsonb);
end;
$$;

create or replace function public.delete_member(p_profile uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.profiles%rowtype;
  v_auth   boolean := false;
begin
  if not public.is_director() then
    raise exception 'forbidden';
  end if;
  perform public.require_mfa();
  select * into v_target from public.profiles where id = p_profile;
  if not found then
    raise exception 'not_found';
  end if;
  if p_profile = public.current_profile_id() then
    raise exception 'cannot_change_self';
  end if;
  if v_target.role = 'director'
     and (select count(*) from public.profiles where role = 'director' and status = 'active') <= 1 then
    raise exception 'last_director';
  end if;

  perform public.log_action('member_deleted', p_profile,
    jsonb_build_object('full_name', v_target.full_name, 'track', v_target.track_id));
  delete from public.profiles where id = p_profile;

  if v_target.user_id is not null then
    begin
      delete from auth.users where id = v_target.user_id;
      v_auth := true;
    exception
      when insufficient_privilege then v_auth := false;
    end;
  end if;
  return jsonb_build_object('auth_deleted', v_auth);
end;
$$;

-- ── Policy and index tidy-up ────────────────────────────────────────────────
drop policy if exists "own layout" on public.dashboard_layouts;
create policy "own layout" on public.dashboard_layouts for all
  using (profile_id = (select public.current_profile_id()))
  with check (profile_id = (select public.current_profile_id()));

create index if not exists attendance_marked_by_idx on public.attendance (marked_by);
create index if not exists audit_log_actor_id_idx on public.audit_log (actor_id);
create index if not exists events_cohort_id_idx on public.events (cohort_id);
create index if not exists events_created_by_idx on public.events (created_by);
create index if not exists events_responsible_id_idx on public.events (responsible_id);
create index if not exists events_track_id_idx on public.events (track_id);
create index if not exists join_codes_cohort_id_idx on public.join_codes (cohort_id);
create index if not exists join_codes_created_by_idx on public.join_codes (created_by);
create index if not exists news_author_id_idx on public.news (author_id);
create index if not exists news_track_id_idx on public.news (track_id);
create index if not exists points_entries_awarded_by_idx on public.points_entries (awarded_by);
create index if not exists profiles_cohort_id_idx on public.profiles (cohort_id);
create index if not exists project_members_confirmed_by_idx on public.project_members (confirmed_by);
create index if not exists projects_owner_id_idx on public.projects (owner_id);
create index if not exists projects_team_id_idx on public.projects (team_id);
create index if not exists rating_results_entered_by_idx on public.rating_results (entered_by);
create index if not exists submissions_reviewer_id_idx on public.submissions (reviewer_id);
create index if not exists team_requests_profile_id_idx on public.team_requests (profile_id);
create index if not exists teams_captain_id_idx on public.teams (captain_id);
