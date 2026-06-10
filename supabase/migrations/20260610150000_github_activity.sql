-- Bucket 3: GitHub activity. The n8n cron workflow writes here with the service
-- role (bypasses RLS); the app reads it (public read).

alter table public.profiles add column github_username text;

create table public.github_stats (
  profile_id     uuid primary key references public.profiles (id) on delete cascade,
  open_prs       int not null default 0,
  last_commit_at timestamptz,
  commit_series  int[] not null default '{}',   -- last 7 days of commit counts
  updated_at     timestamptz not null default now()
);

alter table public.github_stats enable row level security;
create policy "public read github_stats" on public.github_stats for select using (true);
create policy "admin manage github_stats" on public.github_stats for all
  using (public.is_admin()) with check (public.is_admin());

-- The `activity` table (profile_id, day, count) created in migration 0001 backs
-- the heatmap; n8n upserts daily contribution counts into it.
