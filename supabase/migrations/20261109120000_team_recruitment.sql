-- Team recruitment (November 2026): the «Join Our Team» form on aitclub.org/team and the
-- Recruitment section of the Hub. What holds, checked by scripts/db-test.mjs:
--
--  * Applications arrive only through the `apply` edge function. It checks Cloudflare Turnstile and
--    calls submit_application() with the secret key: guests still can't call a single new function
--    or read a single row.
--  * submit_application() checks every field itself; the form in the browser is a convenience. It
--    keeps only the answers of the chosen department, refuses outside the dates of the round, limits
--    attempts per address, per email and in all, and answers a repeated request with the application
--    it already made, so a lost answer never makes a second one.
--  * Most applicants are minors. Applications, notes and contacts are open to the director and the
--    curator and to the Hub accounts the director lets in, always with a session confirmed with a
--    code (aal2), like other people's contacts elsewhere in the Hub.
--  * Changes go through functions, which write the audit log. Export to CSV needs the right to it.
--  * Applications are kept for a limited time (security_housekeeping deletes them), and the director
--    deletes one on request.

-- ── Roles of the round ──────────────────────────────────────────────────────
-- The same list as src/lib/recruitment.ts. Developer, platform administrator and methodologist are
-- not open: the Hub is the club leader's job, the method is the mentors'.
create or replace function private.team_role_department(p_role text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_role
    when 'lead_mentor'        then 'education'
    when 'co_mentor'          then 'education'
    when 'smm'                then 'pr'
    when 'designer'           then 'pr'
    when 'video'              then 'pr'
    when 'copywriter'         then 'pr'
    when 'community'          then 'pr'
    when 'operations_manager' then 'operations'
    when 'event_manager'      then 'operations'
    when 'hr'                 then 'operations'
    when 'partnerships'       then 'operations'
    when 'ambassadors'        then 'operations'
    when 'data_manager'       then 'data'
  end
$$;

-- ── Applications ────────────────────────────────────────────────────────────
create table public.team_applications (
  id                uuid primary key default gen_random_uuid(),
  -- What the applicant sees and quotes: AIT- and six characters without look-alikes.
  public_id         text not null unique check (public_id ~ '^AIT-[A-Z0-9]{6}$'),
  -- Made by the form once per application: a repeated request gets the same answer.
  request_key       uuid not null unique,
  created_at        timestamptz not null default now(),
  full_name         text not null check (char_length(full_name) between 2 and 120),
  applicant_status  text not null check (applicant_status in ('nis_student', 'nis_graduate', 'university', 'other')),
  school            text not null check (char_length(school) between 2 and 160),
  grade             text not null check (char_length(grade) between 1 and 40),
  email             text not null check (char_length(email) <= 254 and email ~ '^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$'),
  telegram          text check (telegram ~ '^[A-Za-z0-9_]{5,32}$'),
  experience        text check (char_length(experience) <= 1500),
  department        text not null check (department in ('education', 'pr', 'operations', 'data')),
  primary_role      text not null,
  extra_role        text,
  -- The chosen department's questions only (private.application_answers).
  answers           jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  hours             text not null check (hours in ('lt2', '2_4', '4_6', '6_8', 'gt8')),
  work_times        text[] not null check (
    cardinality(work_times) between 1 and 5
    and work_times <@ array['after_school', 'evening', 'saturday', 'sunday', 'flexible']),
  interview         text not null check (interview in ('yes', 'coordinate')),
  term              text not null check (term in ('long', 'launch', 'undecided')),
  other_role        text not null check (other_role in ('yes', 'maybe', 'no')),
  motivation        text not null check (char_length(motivation) between 1 and 2000),
  extra_info        text check (char_length(extra_info) <= 2000),
  -- «I understand it's voluntary and unpaid», «I agree to the processing»: both are required, and
  -- the version names the text of the terms the applicant agreed to (aitclub.org/privacy).
  volunteer_ack     boolean not null check (volunteer_ack),
  consent           boolean not null check (consent),
  consent_version   text not null check (consent_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  -- Under 18: a parent or guardian knows about the application and agrees.
  is_adult          boolean not null,
  guardian_consent  boolean not null default false,
  status            text not null default 'applied' check (status in (
    'applied', 'under_review', 'shortlisted', 'interview', 'task', 'accepted', 'rejected', 'withdrawn')),
  status_changed_at timestamptz not null default now(),
  assignee_id       uuid references public.profiles (id) on delete set null,
  score             smallint check (score between 1 and 5),
  updated_at        timestamptz not null default now(),
  constraint team_applications_role check (private.team_role_department(primary_role) = department),
  constraint team_applications_extra_role check (
    extra_role is null or (extra_role <> primary_role and private.team_role_department(extra_role) is not null)),
  constraint team_applications_minor check (is_adult or guardian_consent)
);
create index on public.team_applications (created_at desc);
create index on public.team_applications (lower(email));
create index on public.team_applications (assignee_id);

-- Internal notes of the organizers. The applicant never sees them.
create table public.team_application_notes (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.team_applications (id) on delete cascade,
  author_id      uuid references public.profiles (id) on delete set null,
  body           text not null check (char_length(body) between 1 and 2000),
  created_at     timestamptz not null default now()
);
create index on public.team_application_notes (application_id, created_at);

-- Who else the director lets see the applications, and whether they may download them.
create table public.recruitment_access (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  can_export boolean not null default false,
  granted_by uuid references public.profiles (id) on delete set null,
  granted_at timestamptz not null default now()
);

-- ── Who may see them ────────────────────────────────────────────────────────
-- Has access at all, with or without the code in this session.
create or replace function private.has_recruitment_role()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    public.is_oversight()
    or (public.is_active_member() and exists (
      select 1 from public.recruitment_access a where a.profile_id = public.current_profile_id())),
    false)
$$;

create or replace function public.can_see_applications()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.is_aal2() and private.has_recruitment_role(), false)
$$;

create or replace function public.can_export_applications()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.can_see_applications() and (
    public.is_oversight()
    or exists (
      select 1 from public.recruitment_access a
      where a.profile_id = public.current_profile_id() and a.can_export)
  ), false)
$$;

-- For the Hub's menu and page: none, needs_code (access, but the session has no code), view,
-- export, manage (the director: access, the dates of the round, deletion).
create or replace function public.my_recruitment_access()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when not private.has_recruitment_role() then 'none'
    when not public.is_aal2() then 'needs_code'
    when public.is_director() then 'manage'
    when public.can_export_applications() then 'export'
    else 'view'
  end
$$;

-- Forbidden comes before the second factor: someone without access learns nothing more.
create or replace function private.require_recruitment_access()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.has_recruitment_role() then
    raise exception 'forbidden';
  end if;
  perform public.require_mfa();
end;
$$;

create or replace function private.require_recruitment_director()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_director() then
    raise exception 'forbidden';
  end if;
  perform public.require_mfa();
end;
$$;

alter table public.team_applications enable row level security;
alter table public.team_application_notes enable row level security;
alter table public.recruitment_access enable row level security;
revoke all on public.team_applications, public.team_application_notes, public.recruitment_access
  from public, anon, authenticated;
grant select on public.team_applications to authenticated;
grant select, delete on public.team_application_notes to authenticated;

create policy team_applications_select on public.team_applications for select to authenticated
  using ((select public.can_see_applications()));
create policy team_application_notes_select on public.team_application_notes for select to authenticated
  using ((select public.can_see_applications()));
create policy team_application_notes_delete on public.team_application_notes for delete to authenticated
  using (author_id = (select public.current_profile_id()) and (select public.can_see_applications()));

-- ── The dates of the round ──────────────────────────────────────────────────
-- 9–16 November 2026, Kazakhstan time (UTC+5): open from the 9th, closed from the 17th.
insert into private.settings (key, value) values
  ('recruitment_opens_at', '2026-11-09 00:00:00+05'),
  ('recruitment_closes_at', '2026-11-17 00:00:00+05')
on conflict (key) do nothing;

create or replace function private.recruitment_window()
returns table (opens_at timestamptz, closes_at timestamptz)
language sql
stable
set search_path = ''
as $$
  select (select value::timestamptz from private.settings where key = 'recruitment_opens_at'),
         (select value::timestamptz from private.settings where key = 'recruitment_closes_at')
$$;

create or replace function private.recruitment_open()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(now() >= w.opens_at and now() < w.closes_at, false) from private.recruitment_window() w
$$;

-- For the edge function: whether the form takes applications now. No data in it.
create or replace function public.recruitment_status()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('open', private.recruitment_open(), 'opens_at', w.opens_at, 'closes_at', w.closes_at)
  from private.recruitment_window() w
$$;

create or replace function public.recruitment_window()
returns table (opens_at timestamptz, closes_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select w.opens_at, w.closes_at from private.recruitment_window() w where public.can_see_applications()
$$;

create or replace function public.set_recruitment_window(p_opens timestamptz, p_closes timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_recruitment_director();
  if p_opens is null or p_closes is null or p_closes <= p_opens or p_closes - p_opens > interval '120 days' then
    raise exception 'invalid_window';
  end if;
  insert into private.settings (key, value) values
    ('recruitment_opens_at', to_jsonb(p_opens) #>> '{}'),
    ('recruitment_closes_at', to_jsonb(p_closes) #>> '{}')
  on conflict (key) do update set value = excluded.value;
  perform public.log_action('recruitment_window_set', null,
    jsonb_build_object('opens_at', p_opens, 'closes_at', p_closes));
end;
$$;

-- ── Reading the form ────────────────────────────────────────────────────────
-- Each check names the field it refused (the error's detail), so the form can point to it.

-- One line: invisible and direction characters (they can make one name look like another) go,
-- other control characters and runs of spaces become one space.
create or replace function private.form_line(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(btrim(regexp_replace(regexp_replace(regexp_replace(coalesce(p, ''),
    '[​-‏ -‮⁠-⁯﻿]', '', 'g'),
    '[\x01-\x1F\x7F-\x9F]', ' ', 'g'),
    '\s+', ' ', 'g')), '')
$$;

-- Several lines: the same, but line breaks stay, with one empty line at most.
create or replace function private.form_text(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(btrim(regexp_replace(regexp_replace(regexp_replace(regexp_replace(
    replace(coalesce(p, ''), E'\r\n', E'\n'),
    '[​-‏ -‮⁠-⁯﻿]', '', 'g'),
    '[\x01-\x09\x0B-\x1F\x7F-\x9F]', ' ', 'g'),
    '[ ]+\n', E'\n', 'g'),
    E'\n{3,}', E'\n\n', 'g'), E' \n'), '')
$$;

create or replace function private.form_field(p_form jsonb, p_key text, p_max int, p_required boolean,
                                              p_multiline boolean default false)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_raw jsonb := p_form -> p_key;
  v     text;
begin
  if v_raw is not null and jsonb_typeof(v_raw) <> 'null' then
    if jsonb_typeof(v_raw) <> 'string' then
      raise exception 'invalid_form' using detail = p_key;
    end if;
    v := case when p_multiline then private.form_text(v_raw #>> '{}') else private.form_line(v_raw #>> '{}') end;
  end if;
  if (v is null and p_required) or coalesce(char_length(v) > p_max, false) then
    raise exception 'invalid_form' using detail = p_key;
  end if;
  return v;
end;
$$;

create or replace function private.form_choice(p_form jsonb, p_key text, p_allowed text[], p_required boolean default true)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_raw jsonb := p_form -> p_key;
  v     text;
begin
  if v_raw is not null and jsonb_typeof(v_raw) <> 'null' then
    if jsonb_typeof(v_raw) <> 'string' then
      raise exception 'invalid_form' using detail = p_key;
    end if;
    v := nullif(v_raw #>> '{}', '');
  end if;
  if v is null then
    if p_required then
      raise exception 'invalid_form' using detail = p_key;
    end if;
    return null;
  end if;
  if not (v = any (p_allowed)) then
    raise exception 'invalid_form' using detail = p_key;
  end if;
  return v;
end;
$$;

-- Several options: known ones only, each once, in the order of the form.
create or replace function private.form_choices(p_form jsonb, p_key text, p_allowed text[], p_min int default 1)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_raw jsonb := p_form -> p_key;
  v     text[] := '{}'::text[];
begin
  if v_raw is not null and jsonb_typeof(v_raw) <> 'null' then
    if jsonb_typeof(v_raw) <> 'array'
       or exists (select 1 from jsonb_array_elements(v_raw) e where jsonb_typeof(e) <> 'string') then
      raise exception 'invalid_form' using detail = p_key;
    end if;
    select coalesce(array_agg(o order by i), '{}'::text[]) into v
    from unnest(p_allowed) with ordinality as a (o, i)
    where v_raw ? o;
    if (select count(distinct e) from jsonb_array_elements_text(v_raw) e) <> cardinality(v) then
      raise exception 'invalid_form' using detail = p_key;
    end if;
  end if;
  if cardinality(v) < p_min then
    raise exception 'invalid_form' using detail = p_key;
  end if;
  return v;
end;
$$;

-- Links to a portfolio, GitHub, Codeforces: http(s) addresses only, three at most. Not required.
create or replace function private.form_links(p_form jsonb, p_key text)
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_raw  jsonb := p_form -> p_key;
  v      text[] := '{}'::text[];
  v_item jsonb;
  v_link text;
begin
  if v_raw is null or jsonb_typeof(v_raw) = 'null' then
    return v;
  end if;
  if jsonb_typeof(v_raw) <> 'array' or jsonb_array_length(v_raw) > 3 then
    raise exception 'invalid_form' using detail = p_key;
  end if;
  for v_item in select e from jsonb_array_elements(v_raw) e loop
    if jsonb_typeof(v_item) <> 'string' then
      raise exception 'invalid_form' using detail = p_key;
    end if;
    v_link := private.form_line(v_item #>> '{}');
    continue when v_link is null;
    if char_length(v_link) > 300
       or v_link !~* '^https?://[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(:[0-9]{1,5})?([/?#][^[:space:]]*)?$' then
      raise exception 'invalid_form' using detail = p_key;
    end if;
    v := array_append(v, v_link);
  end loop;
  return v;
end;
$$;

create or replace function private.form_bool(p_form jsonb, p_key text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if jsonb_typeof(p_form -> p_key) is distinct from 'boolean' then
    raise exception 'invalid_form' using detail = p_key;
  end if;
  return (p_form ->> p_key)::boolean;
end;
$$;

-- The questions of the chosen department, as src/lib/recruitment.ts asks them. Answers to other
-- departments' questions are not kept.
create or replace function private.application_answers(p_form jsonb, p_department text)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  a       jsonb := coalesce(p_form -> 'answers', '{}'::jsonb);
  v_tools text[];
begin
  if jsonb_typeof(a) <> 'object' then
    raise exception 'invalid_form' using detail = 'answers';
  end if;

  if p_department = 'education' then
    return jsonb_strip_nulls(jsonb_build_object(
      'direction',    private.form_choice(a, 'direction', array['ai', 'algo', 'startup']),
      'preferred',    private.form_choice(a, 'preferred', array['lead', 'co', 'both']),
      'skills',       private.form_field(a, 'skills', 1500, true, true),
      'achievements', private.form_field(a, 'achievements', 1500, true, true),
      'links',        to_jsonb(private.form_links(a, 'links')),
      'explain',      private.form_field(a, 'explain', 1000, true, true),
      'tasks',        to_jsonb(private.form_choices(a, 'tasks',
                        array['theory', 'practice', 'review', 'materials', 'co_teaching', 'substitute'])),
      'solo_lesson',  private.form_choice(a, 'solo_lesson', array['yes', 'after_prep', 'not_yet']),
      'substitute',   private.form_choice(a, 'substitute', array['yes', 'sometimes', 'no'])
    ));
  elsif p_department = 'pr' then
    v_tools := private.form_choices(a, 'tools',
      array['figma', 'canva', 'adobe', 'capcut', 'premiere', 'instagram', 'telegram', 'other']);
    return jsonb_strip_nulls(jsonb_build_object(
      'tools',       to_jsonb(v_tools),
      'tools_other', case when 'other' = any (v_tools) then private.form_field(a, 'tools_other', 120, false) end,
      'tasks',       to_jsonb(private.form_choices(a, 'tasks',
                       array['smm', 'content_plan', 'posters', 'reels', 'texts', 'interviews', 'community', 'analytics'])),
      'links',       to_jsonb(private.form_links(a, 'links')),
      'idea',        private.form_field(a, 'idea', 1500, true, true),
      'style',       private.form_choice(a, 'style', array['own', 'team', 'both']),
      'after_week',  private.form_choice(a, 'after_week', array['yes', 'limited', 'projects'])
    ));
  elsif p_department = 'operations' then
    return jsonb_strip_nulls(jsonb_build_object(
      'tasks',          to_jsonb(private.form_choices(a, 'tasks',
                          array['events', 'schedules', 'interviews', 'candidates', 'speakers', 'partners', 'schools', 'documents'])),
      'org_experience', private.form_field(a, 'org_experience', 1500, false, true),
      'case',           private.form_field(a, 'case', 1500, true, true),
      'tracking',       private.form_field(a, 'tracking', 1000, true, true),
      'outreach',       private.form_choice(a, 'outreach', array['yes', 'with_guidance', 'internal'])
    ));
  elsif p_department = 'data' then
    v_tools := private.form_choices(a, 'tools', array['sheets', 'excel', 'python', 'sql', 'bi', 'other', 'none']);
    if 'none' = any (v_tools) and cardinality(v_tools) > 1 then
      raise exception 'invalid_form' using detail = 'tools';
    end if;
    return jsonb_strip_nulls(jsonb_build_object(
      'tools',           to_jsonb(v_tools),
      'tools_other',     case when 'other' = any (v_tools) then private.form_field(a, 'tools_other', 120, false) end,
      'interests',       to_jsonb(private.form_choices(a, 'interests',
                           array['registrations', 'attendance', 'assignments', 'activity', 'ait_week', 'social', 'dashboards'])),
      'data_experience', private.form_field(a, 'data_experience', 1500, false, true),
      'metrics',         private.form_field(a, 'metrics', 1000, true, true),
      'reports',         private.form_choice(a, 'reports', array['yes', 'schedule', 'oneoff']),
      'privacy',         private.form_field(a, 'privacy', 1000, true, true)
    ));
  end if;
  raise exception 'invalid_form' using detail = 'department';
end;
$$;

-- ── Submitting ──────────────────────────────────────────────────────────────
-- Called by the `apply` edge function only, after Turnstile, with the visitor's address. Returns
-- {"ok": true, "id": "AIT-…", …} or {"error": "invalid_form", "field": …} / "closed" / "slow_down".
-- Refusals are returned, not raised: an error would roll the attempt counters back.
create or replace function public.submit_application(p_key uuid, p_form jsonb, p_ip text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app    public.team_applications%rowtype;
  v_new    public.team_applications%rowtype;
  v_ip     text := left(nullif(btrim(coalesce(p_ip, '')), ''), 64);
  v_detail text;
begin
  -- A repeated request (the answer got lost on the way): the same application, nothing new.
  select * into v_app from public.team_applications where request_key = p_key;
  if found then
    return jsonb_build_object('ok', true, 'id', v_app.public_id, 'created_at', v_app.created_at,
                              'department', v_app.department, 'role', v_app.primary_role);
  end if;
  if p_key is null or jsonb_typeof(p_form) is distinct from 'object' or octet_length(p_form::text) > 32768 then
    return jsonb_build_object('error', 'invalid_form', 'field', 'form');
  end if;
  if not private.recruitment_open() then
    return jsonb_build_object('error', 'closed');
  end if;
  -- Generous for one address: a whole school applies from one network. Turnstile stops the bots;
  -- this stops a flood that gets past it.
  if (v_ip is not null and v_ip <> 'unknown' and not private.hit_limit('apply:' || v_ip, 60, interval '1 hour'))
     or not private.hit_limit('apply:all', 300, interval '1 hour') then
    return jsonb_build_object('error', 'slow_down');
  end if;

  begin
    v_new.department := private.form_choice(p_form, 'department', array['education', 'pr', 'operations', 'data']);
    v_new.primary_role := private.form_field(p_form, 'role', 40, true);
    if private.team_role_department(v_new.primary_role) is distinct from v_new.department then
      raise exception 'invalid_form' using detail = 'role';
    end if;
    v_new.extra_role := private.form_field(p_form, 'extra_role', 40, false);
    if v_new.extra_role is not null
       and (v_new.extra_role = v_new.primary_role or private.team_role_department(v_new.extra_role) is null) then
      raise exception 'invalid_form' using detail = 'extra_role';
    end if;

    v_new.full_name := private.form_field(p_form, 'full_name', 120, true);
    if char_length(v_new.full_name) < 2 then
      raise exception 'invalid_form' using detail = 'full_name';
    end if;
    v_new.applicant_status := private.form_choice(p_form, 'applicant_status',
      array['nis_student', 'nis_graduate', 'university', 'other']);
    v_new.school := private.form_field(p_form, 'school', 160, true);
    if char_length(v_new.school) < 2 then
      raise exception 'invalid_form' using detail = 'school';
    end if;
    v_new.grade := private.form_field(p_form, 'grade', 40, true);

    v_new.email := lower(private.form_field(p_form, 'email', 254, true));
    if v_new.email !~ '^[a-z0-9._%+-]+@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$' then
      raise exception 'invalid_form' using detail = 'email';
    end if;
    v_new.telegram := private.form_field(p_form, 'telegram', 80, false);
    if v_new.telegram is not null then
      v_new.telegram := ltrim(regexp_replace(v_new.telegram, '^(https?://)?(www\.)?(t\.me|telegram\.me)/', '', 'i'), '@');
      if v_new.telegram !~ '^[A-Za-z0-9_]{5,32}$' then
        raise exception 'invalid_form' using detail = 'telegram';
      end if;
    end if;
    v_new.experience := private.form_field(p_form, 'experience', 1500, false, true);

    v_new.answers := private.application_answers(p_form, v_new.department);

    v_new.hours := private.form_choice(p_form, 'hours', array['lt2', '2_4', '4_6', '6_8', 'gt8']);
    v_new.work_times := private.form_choices(p_form, 'work_times',
      array['after_school', 'evening', 'saturday', 'sunday', 'flexible']);
    v_new.interview := private.form_choice(p_form, 'interview', array['yes', 'coordinate']);
    v_new.term := private.form_choice(p_form, 'term', array['long', 'launch', 'undecided']);
    v_new.other_role := private.form_choice(p_form, 'other_role', array['yes', 'maybe', 'no']);
    v_new.motivation := private.form_field(p_form, 'motivation', 2000, true, true);
    v_new.extra_info := private.form_field(p_form, 'extra_info', 2000, false, true);

    v_new.volunteer_ack := private.form_bool(p_form, 'volunteer_ack');
    if not v_new.volunteer_ack then
      raise exception 'invalid_form' using detail = 'volunteer_ack';
    end if;
    v_new.consent := private.form_bool(p_form, 'consent');
    if not v_new.consent then
      raise exception 'invalid_form' using detail = 'consent';
    end if;
    v_new.consent_version := p_form ->> 'consent_version';
    if coalesce(v_new.consent_version, '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'invalid_form' using detail = 'consent_version';
    end if;
    v_new.is_adult := private.form_bool(p_form, 'is_adult');
    v_new.guardian_consent := not v_new.is_adult and private.form_bool(p_form, 'guardian_consent');
    if not (v_new.is_adult or v_new.guardian_consent) then
      raise exception 'invalid_form' using detail = 'guardian_consent';
    end if;
  exception
    when raise_exception then
      get stacked diagnostics v_detail = pg_exception_detail;
      if sqlerrm = 'invalid_form' then
        return jsonb_build_object('error', 'invalid_form', 'field', coalesce(nullif(v_detail, ''), 'form'));
      end if;
      raise;
  end;

  -- One person, a few applications a day: enough to send a corrected one. Counted once the form
  -- is in order, so a typo doesn't use a try up.
  if not private.hit_limit('apply:email:' || v_new.email, 5, interval '1 day') then
    return jsonb_build_object('error', 'slow_down');
  end if;

  loop
    v_new.public_id := 'AIT-' || left(public.generate_join_code(), 6);
    exit when not exists (select 1 from public.team_applications where public_id = v_new.public_id);
  end loop;
  v_new.id := gen_random_uuid();
  v_new.request_key := p_key;
  v_new.created_at := now();
  v_new.status := 'applied';
  v_new.status_changed_at := now();
  v_new.updated_at := now();

  begin
    insert into public.team_applications select v_new.*
    on conflict (request_key) do nothing
    returning * into v_app;
  exception
    when check_violation then
      return jsonb_build_object('error', 'invalid_form', 'field', 'form');
  end;
  if v_app.id is null then
    -- The same request at the same moment from another connection: that one made it.
    select * into v_app from public.team_applications where request_key = p_key;
  end if;
  return jsonb_build_object('ok', true, 'id', v_app.public_id, 'created_at', v_app.created_at,
                            'department', v_app.department, 'role', v_app.primary_role);
end;
$$;

-- ── Working with them ───────────────────────────────────────────────────────
-- Everyone who works on the round: director and curator, and whoever the director let in. The
-- assignee of an application is one of them.
create or replace function public.recruitment_team()
returns table (profile_id uuid, full_name text, role text, can_export boolean, granted boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.role,
         p.role in ('director', 'curator') or coalesce(a.can_export, false),
         a.profile_id is not null
  from public.profiles p
  left join public.recruitment_access a on a.profile_id = p.id
  where public.can_see_applications()
    and p.status = 'active'
    and (p.role in ('director', 'curator') or a.profile_id is not null)
  order by p.role in ('director', 'curator') desc, p.full_name
$$;

create or replace function public.set_application_status(p_application uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app public.team_applications%rowtype;
begin
  perform private.require_recruitment_access();
  if p_status is null or p_status not in (
    'applied', 'under_review', 'shortlisted', 'interview', 'task', 'accepted', 'rejected', 'withdrawn') then
    raise exception 'invalid_status';
  end if;
  select * into v_app from public.team_applications where id = p_application for update;
  if not found then
    raise exception 'not_found';
  end if;
  if v_app.status = p_status then
    return;
  end if;
  update public.team_applications
    set status = p_status, status_changed_at = now(), updated_at = now()
    where id = p_application;
  perform public.log_action('application_status', p_application,
    jsonb_build_object('public_id', v_app.public_id, 'from', v_app.status, 'to', p_status));
end;
$$;

create or replace function public.assign_application(p_application uuid, p_assignee uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_public text;
  v_name   text;
begin
  perform private.require_recruitment_access();
  if p_assignee is not null then
    select t.full_name into v_name from public.recruitment_team() t where t.profile_id = p_assignee;
    if not found then
      raise exception 'invalid_assignee';
    end if;
  end if;
  update public.team_applications
    set assignee_id = p_assignee, updated_at = now()
    where id = p_application
    returning public_id into v_public;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.log_action('application_assigned', p_application,
    jsonb_build_object('public_id', v_public, 'assignee', v_name));
end;
$$;

create or replace function public.set_application_score(p_application uuid, p_score int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_recruitment_access();
  if p_score is not null and p_score not between 1 and 5 then
    raise exception 'invalid_score';
  end if;
  update public.team_applications set score = p_score, updated_at = now() where id = p_application;
  if not found then
    raise exception 'not_found';
  end if;
end;
$$;

create or replace function public.add_application_note(p_application uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id   uuid;
  v_body text := private.form_text(left(p_body, 4000));
begin
  perform private.require_recruitment_access();
  if v_body is null or char_length(v_body) > 2000 then
    raise exception 'invalid_note';
  end if;
  if not exists (select 1 from public.team_applications where id = p_application) then
    raise exception 'not_found';
  end if;
  insert into public.team_application_notes (application_id, author_id, body)
  values (p_application, public.current_profile_id(), v_body)
  returning id into v_id;
  return v_id;
end;
$$;

-- Deleting on request: the application, its notes, everything. The log keeps the number only.
create or replace function public.delete_application(p_application uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app public.team_applications%rowtype;
begin
  perform private.require_recruitment_director();
  delete from public.team_applications where id = p_application returning * into v_app;
  if not found then
    raise exception 'not_found';
  end if;
  perform public.log_action('application_deleted', null,
    jsonb_build_object('public_id', v_app.public_id, 'department', v_app.department));
end;
$$;

-- The whole table for a CSV, with the right to download it. Logged.
create or replace function public.export_applications()
returns setof public.team_applications
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  perform private.require_recruitment_access();
  if not public.can_export_applications() then
    raise exception 'forbidden';
  end if;
  return query select * from public.team_applications order by created_at;
  get diagnostics v_count = row_count;
  perform public.log_action('applications_exported', null, jsonb_build_object('count', v_count));
end;
$$;

create or replace function public.grant_recruitment_access(p_profile uuid, p_can_export boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  perform private.require_recruitment_director();
  select role into v_role from public.profiles where id = p_profile and status = 'active';
  if not found then
    raise exception 'not_found';
  end if;
  if v_role in ('director', 'curator') then
    raise exception 'already_has_access';
  end if;
  insert into public.recruitment_access (profile_id, can_export, granted_by)
  values (p_profile, coalesce(p_can_export, false), public.current_profile_id())
  on conflict (profile_id) do update
    set can_export = excluded.can_export, granted_by = excluded.granted_by, granted_at = now();
  perform public.log_action('recruitment_access_granted', p_profile,
    jsonb_build_object('export', coalesce(p_can_export, false)));
end;
$$;

create or replace function public.revoke_recruitment_access(p_profile uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_recruitment_director();
  delete from public.recruitment_access where profile_id = p_profile;
  if not found then
    raise exception 'not_found';
  end if;
  update public.team_applications set assignee_id = null where assignee_id = p_profile;
  perform public.log_action('recruitment_access_revoked', p_profile, '{}'::jsonb);
end;
$$;

-- ── Keeping them no longer than needed ──────────────────────────────────────
-- Run by the push function's daily call. Applications go 90 days after a refusal or a withdrawal,
-- and a year after they came at the latest (aitclub.org/privacy says the same).
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
  delete from public.team_applications
  where (status in ('rejected', 'withdrawn') and status_changed_at < now() - interval '90 days')
     or created_at < now() - interval '1 year';
end;
$$;

-- ── Who may call what ───────────────────────────────────────────────────────
revoke execute on function
  public.can_see_applications(), public.can_export_applications(), public.my_recruitment_access(),
  public.recruitment_status(), public.recruitment_window(), public.set_recruitment_window(timestamptz, timestamptz),
  public.submit_application(uuid, jsonb, text), public.recruitment_team(),
  public.set_application_status(uuid, text), public.assign_application(uuid, uuid),
  public.set_application_score(uuid, int), public.add_application_note(uuid, text),
  public.delete_application(uuid), public.export_applications(),
  public.grant_recruitment_access(uuid, boolean), public.revoke_recruitment_access(uuid)
  from public, anon, authenticated;

grant execute on function
  public.can_see_applications(), public.can_export_applications(), public.my_recruitment_access(),
  public.recruitment_window(), public.set_recruitment_window(timestamptz, timestamptz), public.recruitment_team(),
  public.set_application_status(uuid, text), public.assign_application(uuid, uuid),
  public.set_application_score(uuid, int), public.add_application_note(uuid, text),
  public.delete_application(uuid), public.export_applications(),
  public.grant_recruitment_access(uuid, boolean), public.revoke_recruitment_access(uuid)
  to authenticated;

-- The edge function's key only.
grant execute on function public.submit_application(uuid, jsonb, text), public.recruitment_status() to service_role;
