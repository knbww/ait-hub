-- AIT Hub core schema (roadmap §1c).
-- profiles are decoupled from auth.users via a nullable user_id link so the
-- community roster can hold curated/seed members that aren't yet claimed by a
-- login. A trigger (migration 0002) claims a profile on sign-up.

create type public.user_role as enum ('member', 'mentor', 'admin');
create type public.pow_status as enum ('completed', 'pending');

create table public.profiles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid unique references auth.users (id) on delete set null,
  full_name  text not null,
  role       public.user_role not null default 'member',
  avatar_url text,
  bio        text,
  created_at timestamptz not null default now()
);
comment on table public.profiles is
  'Community members. user_id links to an auth account; null = unclaimed/seed profile.';

create table public.courses (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  instructor   text,
  duration     text,
  level        text,
  syllabus_url text
);

create table public.enrollments (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  course_id  uuid not null references public.courses (id) on delete cascade,
  progress   int not null default 0 check (progress between 0 and 100),
  unique (profile_id, course_id)
);

create table public.proof_of_work (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  period     text not null,                       -- display label, e.g. "Dec 2025"
  task       text not null,
  status     public.pow_status not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.projects (
  id       uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles (id) on delete set null,
  title    text not null,
  progress int not null default 0 check (progress between 0 and 100)
);

create table public.skills (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  skill      text not null,
  level      int not null default 0 check (level between 0 and 100),
  category   text
);

create table public.research_papers (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid references public.profiles (id) on delete set null,
  author_name text,                               -- denormalised display author
  title       text not null,
  tags        text[] not null default '{}',
  citations   int not null default 0,
  content     text,
  created_at  timestamptz not null default now()
  -- Phase 3: add `embedding vector(1024)` once pgvector is enabled (RAG).
);

create table public.deadlines (
  id       uuid primary key default gen_random_uuid(),
  title    text not null,
  due_date date not null,
  scope    text not null default 'global'
);

create table public.xp_events (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  source     text not null,
  delta      int not null,
  created_at timestamptz not null default now()
);

create table public.activity (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  day        date not null,
  count      int not null default 0,
  unique (profile_id, day)
);

create table public.applications (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  full_name  text,
  payload    jsonb not null default '{}'::jsonb,
  ai_score   numeric,
  status     text not null default 'pending',
  created_at timestamptz not null default now()
);

create table public.dashboard_layouts (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  layout     jsonb not null,
  updated_at timestamptz not null default now()
);

-- Leaderboard = XP totals per profile. security_invoker so the querying user's
-- RLS applies to the underlying tables.
create view public.leaderboard
with (security_invoker = true) as
  select
    p.id                        as profile_id,
    p.full_name,
    coalesce(p.avatar_url, '')  as avatar_url,
    coalesce(sum(x.delta), 0)::int as xp
  from public.profiles p
  left join public.xp_events x on x.profile_id = p.id
  group by p.id, p.full_name, p.avatar_url;

-- Indexes on foreign keys / hot read paths.
create index on public.enrollments (profile_id);
create index on public.proof_of_work (profile_id);
create index on public.skills (profile_id);
create index on public.xp_events (profile_id);
create index on public.activity (profile_id);
create index on public.research_papers (author_id);
create index on public.deadlines (due_date);
