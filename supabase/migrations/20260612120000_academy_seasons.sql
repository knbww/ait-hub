-- Module 3: Academy / Season 1 — the weekly academic loop.
--
-- A season holds N weeks of program + materials. Members submit assignments and
-- self-check-in to meetings with a host-announced code (+10 AIP); hosts
-- (mentor/admin) review submissions (зачёт → +20 AIP). Points land in the
-- existing `xp_events` table (surfaced as "AIP" in the UI) and flow into the
-- `leaderboard` view automatically.
--
-- Anti-cheat: members never write points or attendance directly. Every award
-- goes through a SECURITY DEFINER function, and the attendance code lives in a
-- table members cannot read.

-- ── Idempotency key for AIP awards (reused by future point sources) ──────────
alter table public.xp_events add column ref text;
create unique index xp_events_dedup
  on public.xp_events (profile_id, source, ref)
  where ref is not null;

-- ── Seasons & weekly program ─────────────────────────────────────────────────
create table public.seasons (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  start_date  date,
  week_count  int  not null default 9,
  status      text not null default 'draft',   -- draft | active | archived
  created_at  timestamptz not null default now()
);

create table public.season_weeks (
  id               uuid primary key default gen_random_uuid(),
  season_id        uuid not null references public.seasons (id) on delete cascade,
  week_number      int  not null,
  topic            text not null,
  description      text,
  course_url       text,
  colab_url        text,
  kaggle_url       text,
  video_url        text,
  assignment_brief text,
  due_date         date,
  unique (season_id, week_number)
);
create index on public.season_weeks (season_id);

create table public.submissions (
  id          uuid primary key default gen_random_uuid(),
  week_id     uuid not null references public.season_weeks (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  link        text not null,
  comment     text,
  status      text not null default 'submitted',  -- submitted | reviewed
  passed      boolean,
  reviewer_id uuid references public.profiles (id) on delete set null,
  feedback    text,
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (week_id, profile_id)
);
create index on public.submissions (week_id);
create index on public.submissions (profile_id);

create table public.attendance (
  week_id       uuid not null references public.season_weeks (id) on delete cascade,
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  primary key (week_id, profile_id)
);

-- Attendance code + window. NOT public-read: only hosts may read it, so members
-- can't scrape the code to self-award. check_in() reads it as definer.
create table public.week_meetings (
  week_id    uuid primary key references public.season_weeks (id) on delete cascade,
  code       text,
  opens_at   timestamptz,
  closes_at  timestamptz,
  updated_at timestamptz not null default now()
);

-- ── Helpers ──────────────────────────────────────────────────────────────────
create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.profiles where user_id = auth.uid();
$$;

create or replace function public.is_mentor_or_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role in ('mentor', 'admin')
  );
$$;

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.seasons       enable row level security;
alter table public.season_weeks  enable row level security;
alter table public.submissions   enable row level security;
alter table public.attendance    enable row level security;
alter table public.week_meetings enable row level security;

-- Program is public (display content); only admins curate it.
create policy "public read seasons"      on public.seasons      for select using (true);
create policy "public read season_weeks" on public.season_weeks for select using (true);
create policy "admin manage seasons" on public.seasons for all
  using (public.is_admin()) with check (public.is_admin());
create policy "admin manage season_weeks" on public.season_weeks for all
  using (public.is_admin()) with check (public.is_admin());

-- Submissions / attendance: a member reads only their own; hosts read all.
-- No member write policy → writes happen only via the definer functions below.
create policy "read own submissions" on public.submissions for select
  using (public.is_mentor_or_admin() or profile_id = public.current_profile_id());
create policy "read own attendance" on public.attendance for select
  using (public.is_mentor_or_admin() or profile_id = public.current_profile_id());

-- Meeting codes: hosts only (read + manage). check_in() bypasses this as definer.
create policy "host manage meetings" on public.week_meetings for all
  using (public.is_mentor_or_admin()) with check (public.is_mentor_or_admin());

-- ── Member: submit / resubmit an assignment ─────────────────────────────────
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
end;
$$;

-- ── Member: self check-in by meeting code (+10 AIP, idempotent) ──────────────
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

  insert into public.xp_events (profile_id, source, delta, ref)
  values (v_profile, 'attendance', 10, 'attendance:' || p_week_id)
  on conflict (profile_id, source, ref) where ref is not null do nothing;

  return 'ok';
end;
$$;

-- ── Host: open / rotate the attendance window for a week ─────────────────────
create or replace function public.open_attendance(
  p_week_id uuid, p_code text, p_minutes int default 30
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_mentor_or_admin() then
    raise exception 'forbidden';
  end if;

  insert into public.week_meetings (week_id, code, opens_at, closes_at, updated_at)
  values (p_week_id, p_code, now(),
          now() + make_interval(mins => greatest(p_minutes, 1)), now())
  on conflict (week_id) do update
    set code = excluded.code, opens_at = excluded.opens_at,
        closes_at = excluded.closes_at, updated_at = now();
end;
$$;

-- ── Host: review a submission (зачёт → +20 AIP, idempotent) ──────────────────
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
    insert into public.xp_events (profile_id, source, delta, ref)
    values (v_profile, 'assignment', 20, 'assignment:' || p_submission_id)
    on conflict (profile_id, source, ref) where ref is not null do nothing;
  end if;
end;
$$;

-- Actions are for signed-in members/hosts only (they also guard internally).
-- Revoke the default PUBLIC execute grant and re-grant to `authenticated` so
-- anonymous RPC callers can't even reach them.
revoke execute on function public.submit_assignment(uuid, text, text) from public, anon;
revoke execute on function public.check_in(uuid, text)               from public, anon;
revoke execute on function public.open_attendance(uuid, text, int)   from public, anon;
revoke execute on function public.review_submission(uuid, text, boolean) from public, anon;

grant execute on function public.submit_assignment(uuid, text, text)     to authenticated;
grant execute on function public.check_in(uuid, text)                    to authenticated;
grant execute on function public.open_attendance(uuid, text, int)        to authenticated;
grant execute on function public.review_submission(uuid, text, boolean)  to authenticated;
