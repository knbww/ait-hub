-- RLS policies, role-claim hook, and profile auto-provisioning (roadmap §1d).

-- 1. Provision a profile row whenever an auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, full_name, role)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      new.email
    ),
    'member'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 2. Custom access token hook: inject the member's role as a JWT claim so RLS
--    policies (and downstream services such as n8n) can read it.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims      jsonb;
  member_role public.user_role;
begin
  select role into member_role
  from public.profiles
  where user_id = (event ->> 'user_id')::uuid;

  claims := event -> 'claims';
  claims := jsonb_set(
    claims,
    '{app_metadata,role}',
    to_jsonb(coalesce(member_role::text, 'member'))
  );
  return jsonb_set(event, '{claims}', claims);
end;
$$;

-- The auth admin role runs the hook; it needs to read profiles.
grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
grant select on public.profiles to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

-- 3. Helper: the caller's role claim (defaults to 'member' when absent).
create or replace function public.current_role_claim()
returns text
language sql
stable
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', 'member');
$$;

-- 4. Enable RLS on every table.
alter table public.profiles          enable row level security;
alter table public.courses           enable row level security;
alter table public.enrollments       enable row level security;
alter table public.proof_of_work     enable row level security;
alter table public.projects          enable row level security;
alter table public.skills            enable row level security;
alter table public.research_papers   enable row level security;
alter table public.deadlines         enable row level security;
alter table public.xp_events         enable row level security;
alter table public.activity          enable row level security;
alter table public.applications      enable row level security;
alter table public.dashboard_layouts enable row level security;

-- 5. Public community read (display data). Writes restricted below.
create policy "public read profiles"       on public.profiles        for select using (true);
create policy "public read courses"         on public.courses         for select using (true);
create policy "public read enrollments"     on public.enrollments     for select using (true);
create policy "public read proof_of_work"   on public.proof_of_work   for select using (true);
create policy "public read projects"        on public.projects        for select using (true);
create policy "public read skills"          on public.skills          for select using (true);
create policy "public read research_papers" on public.research_papers for select using (true);
create policy "public read deadlines"       on public.deadlines       for select using (true);
create policy "public read xp_events"       on public.xp_events       for select using (true);
create policy "public read activity"        on public.activity        for select using (true);

-- 6. Members manage their own profile; admins manage all.
create policy "update own profile" on public.profiles for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "admin manage profiles" on public.profiles for all
  using (public.current_role_claim() = 'admin')
  with check (public.current_role_claim() = 'admin');

-- 7. Owner-or-admin writes on member-owned content.
create policy "own proof_of_work" on public.proof_of_work for all
  using (profile_id in (select id from public.profiles where user_id = auth.uid()))
  with check (profile_id in (select id from public.profiles where user_id = auth.uid()));
create policy "own skills" on public.skills for all
  using (profile_id in (select id from public.profiles where user_id = auth.uid()))
  with check (profile_id in (select id from public.profiles where user_id = auth.uid()));
create policy "own enrollments" on public.enrollments for all
  using (profile_id in (select id from public.profiles where user_id = auth.uid()))
  with check (profile_id in (select id from public.profiles where user_id = auth.uid()));

-- 8. Admin-managed curated content (automations use the service role, which
--    bypasses RLS entirely).
create policy "admin manage courses"   on public.courses         for all
  using (public.current_role_claim() = 'admin') with check (public.current_role_claim() = 'admin');
create policy "admin manage deadlines" on public.deadlines       for all
  using (public.current_role_claim() = 'admin') with check (public.current_role_claim() = 'admin');
create policy "admin manage research"  on public.research_papers for all
  using (public.current_role_claim() = 'admin') with check (public.current_role_claim() = 'admin');
create policy "admin manage projects"  on public.projects        for all
  using (public.current_role_claim() = 'admin') with check (public.current_role_claim() = 'admin');
create policy "admin manage xp_events" on public.xp_events       for all
  using (public.current_role_claim() = 'admin') with check (public.current_role_claim() = 'admin');
create policy "admin manage activity"  on public.activity        for all
  using (public.current_role_claim() = 'admin') with check (public.current_role_claim() = 'admin');

-- 9. Applications: anyone may submit; only admins read/triage.
create policy "anyone can apply" on public.applications for insert with check (true);
create policy "admin read applications" on public.applications for select
  using (public.current_role_claim() = 'admin');
create policy "admin update applications" on public.applications for update
  using (public.current_role_claim() = 'admin')
  with check (public.current_role_claim() = 'admin');

-- 10. Dashboard layout is private to its owner.
create policy "own layout" on public.dashboard_layouts for all
  using (profile_id in (select id from public.profiles where user_id = auth.uid()))
  with check (profile_id in (select id from public.profiles where user_id = auth.uid()));
