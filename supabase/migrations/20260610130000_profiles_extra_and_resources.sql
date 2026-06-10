-- Bucket 1: academic/social fields on profiles (for the Network & Wall-of-Proof
-- cards) and a resources library table (for the Resources page).

alter table public.profiles
  add column university   text,
  add column grad_year    text,
  add column title        text,
  add column github_url   text,
  add column leetcode_url text,
  add column linkedin_url text;

create table public.resources (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  category    text,
  url         text,
  icon        text,
  created_at  timestamptz not null default now()
);

alter table public.resources enable row level security;
create policy "public read resources" on public.resources for select using (true);
create policy "admin manage resources" on public.resources for all
  using (public.current_role_claim() = 'admin')
  with check (public.current_role_claim() = 'admin');

-- Demo data on the seeded profiles.
update public.profiles
  set university = 'MIT', grad_year = '2024', title = 'ML Engineer'
  where id = '00000000-0000-0000-0000-000000000007';
update public.profiles
  set university = 'Stanford', grad_year = '2023', title = 'Research Scientist'
  where id = '00000000-0000-0000-0000-000000000008';
update public.profiles
  set github_url   = 'https://github.com/knbww',
      leetcode_url = 'https://leetcode.com',
      linkedin_url = 'https://linkedin.com'
  where id = '00000000-0000-0000-0000-000000000001';

insert into public.resources (title, description, category, url, icon) values
  ('Cloud Credits', 'Google Colab Pro, AWS Credits', 'Infrastructure', '#', 'zap'),
  ('Templates',     'LaTeX, Notion Dashboards',      'Productivity',   '#', 'file-text'),
  ('Datasets',      'Verified Research Data',         'Data',          '#', 'database');
