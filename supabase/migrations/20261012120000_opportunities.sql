-- Competitions and opportunities (October 2026): olympiads, contests, hackathons, startup
-- programmes, camps, internships, grants and courses that members can enter — what each one
-- is, who may take part, dates and links, with the sources the facts came from.
--
-- Club management keeps the list (any staff member adds and edits; director / curator or the
-- author removes; an entry can be hidden instead). Every active member reads it and marks what
-- they want to take part in; a member's marks are seen by them and by whoever manages them, so
-- leads know who to prepare. The evening push reminds members of a saved deadline three days
-- and one day before it.

create table public.opportunities (
  id             uuid primary key default gen_random_uuid(),
  -- Stable name for entries loaded by migrations, so a reload never duplicates them.
  key            text unique check (key ~ '^[a-z0-9-]{2,80}$'),
  title          text not null check (char_length(btrim(title)) between 1 and 200),
  kind           text not null check (kind in ('olympiad', 'competition', 'hackathon', 'startup', 'program',
                                               'camp', 'internship', 'grant', 'course', 'event')),
  organizer      text check (char_length(organizer) <= 400),
  tracks         text[] not null default '{}' check (tracks <@ array['ai', 'algo', 'startup']),
  region         text not null check (region in ('sko', 'kz', 'online', 'intl')),
  grade_min      int check (grade_min between 1 and 12),
  grade_max      int check (grade_max between 1 and 12),
  eligibility    text check (char_length(eligibility) <= 2000),
  team           text check (char_length(team) <= 600),
  fee            text check (char_length(fee) <= 800),
  summary        text not null check (char_length(btrim(summary)) between 1 and 600),
  description    text check (char_length(description) <= 6000),
  how_to_apply   text check (char_length(how_to_apply) <= 2000),
  url            text not null check (url ~* '^https://' and char_length(url) <= 500),
  apply_url      text check (apply_url is null or (apply_url ~* '^https://' and char_length(apply_url) <= 500)),
  deadline       date,
  starts_on      date,
  ends_on        date,
  dates_note     text check (char_length(dates_note) <= 1500),
  -- The dates were read on an official page for the current season.
  dates_verified boolean not null default false,
  sources        text[] not null default '{}' check (cardinality(sources) <= 12),
  notes          text check (char_length(notes) <= 2000),
  hidden         boolean not null default false,
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (grade_min is null or grade_max is null or grade_min <= grade_max),
  check (starts_on is null or ends_on is null or starts_on <= ends_on)
);
create index on public.opportunities (deadline);
create index on public.opportunities (created_by);

create or replace function public.opportunities_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_source text;
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_at := now();
    if auth.uid() is not null then
      new.created_by := public.current_profile_id();
    end if;
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  foreach v_source in array new.sources loop
    if v_source !~* '^https://' or char_length(v_source) > 500 then
      raise exception 'invalid_link';
    end if;
  end loop;
  return new;
end;
$$;

create trigger trg_opportunities_before_write
  before insert or update on public.opportunities
  for each row execute function public.opportunities_before_write();
revoke execute on function public.opportunities_before_write() from public, anon, authenticated;

alter table public.opportunities enable row level security;
revoke all on public.opportunities from anon, authenticated;
grant select, delete on public.opportunities to authenticated;
grant insert (title, kind, organizer, tracks, region, grade_min, grade_max, eligibility, team, fee, summary,
              description, how_to_apply, url, apply_url, deadline, starts_on, ends_on, dates_note,
              dates_verified, sources, notes, hidden)
  on public.opportunities to authenticated;
grant update (title, kind, organizer, tracks, region, grade_min, grade_max, eligibility, team, fee, summary,
              description, how_to_apply, url, apply_url, deadline, starts_on, ends_on, dates_note,
              dates_verified, sources, notes, hidden)
  on public.opportunities to authenticated;

create policy opportunities_select on public.opportunities for select to authenticated
  using (public.is_active_member() and (not hidden or public.is_staff()));
create policy opportunities_insert on public.opportunities for insert to authenticated
  with check (public.is_staff());
create policy opportunities_update on public.opportunities for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());
create policy opportunities_delete on public.opportunities for delete to authenticated
  using (public.is_oversight() or (public.is_staff() and created_by = (select public.current_profile_id())));

-- ── "I want to take part" ───────────────────────────────────────────────────
create table public.opportunity_saves (
  opportunity_id uuid not null references public.opportunities (id) on delete cascade,
  profile_id     uuid not null references public.profiles (id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (opportunity_id, profile_id)
);
create index on public.opportunity_saves (profile_id);

alter table public.opportunity_saves enable row level security;
revoke all on public.opportunity_saves from anon, authenticated;
grant select, delete on public.opportunity_saves to authenticated;
grant insert (opportunity_id, profile_id) on public.opportunity_saves to authenticated;

create policy opportunity_saves_select on public.opportunity_saves for select to authenticated
  using (profile_id = (select public.current_profile_id()) or public.can_manage(profile_id));
create policy opportunity_saves_insert on public.opportunity_saves for insert to authenticated
  with check (profile_id = (select public.current_profile_id()) and public.is_active_member());
create policy opportunity_saves_delete on public.opportunity_saves for delete to authenticated
  using (profile_id = (select public.current_profile_id()));

-- A member's data download lists the opportunities they saved too.
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

  if p_profile <> public.current_profile_id() then
    perform public.log_action('member_data_exported', p_profile, '{}'::jsonb);
  end if;
  return v_result;
end;
$$;
