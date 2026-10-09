-- Launch prep (October 2026), step 9: exports and the final lock-down.
--
-- Backup plan: the club keeps working if the Hub is down (materials in Drive, a fallback form
-- and member sheet), so staff can export members, points and results to a spreadsheet at any
-- time. Data requests: a member can download everything stored about them; their track lead
-- and director / curator can too. Every staff export is logged.
--
-- Last, anonymous access is closed everywhere except the join-code check.

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

-- Works (per week) and published rating results, one row each.
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

-- Everything stored about one member, as JSON.
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

-- ── No anonymous access, except checking a join code ────────────────────────
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke execute on all functions in schema public from public, anon;
grant execute on function public.check_join_code(text) to anon, authenticated;

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from public, anon;
