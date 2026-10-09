-- Launch prep (October 2026), step 8: the project base.
--
-- A project states a concrete problem, its user, scope, roles, dates, how it is checked and
-- how it is shown. Each member's contribution is recorded and can be confirmed by the
-- member's track staff. Projects may mix members of different tracks.

create table public.projects (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(btrim(title)) between 1 and 120),
  problem      text not null check (char_length(btrim(problem)) between 1 and 2000),
  target_user  text not null check (char_length(btrim(target_user)) between 1 and 500),
  scope        text check (scope is null or char_length(scope) <= 2000),
  roles        text check (roles is null or char_length(roles) <= 1000),
  starts_on    date,
  ends_on      date,
  verification text check (verification is null or char_length(verification) <= 1000),
  demo         text check (demo is null or char_length(demo) <= 1000),
  links        text check (links is null or char_length(links) <= 1000),
  status       text not null default 'active' check (status in ('idea', 'active', 'done', 'archived')),
  team_id      uuid references public.teams (id) on delete set null,
  owner_id     uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint projects_dates check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table public.project_members (
  project_id   uuid not null references public.projects (id) on delete cascade,
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  role         text check (role is null or char_length(role) <= 80),
  contribution text check (contribution is null or char_length(contribution) <= 1000),
  confirmed_by uuid references public.profiles (id) on delete set null,
  confirmed_at timestamptz,
  joined_at    timestamptz not null default now(),
  primary key (project_id, profile_id)
);
create index on public.project_members (profile_id);

-- Owner, director / curator, or the lead of a track one of the members is in.
create or replace function public.can_edit_project(p_project uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.projects where id = p_project and owner_id = public.current_profile_id())
    or public.is_oversight()
    or (public.my_role() = 'track_lead' and exists (
      select 1 from public.project_members pm join public.profiles p on p.id = pm.profile_id
      where pm.project_id = p_project and p.track_id = public.my_track_id()
    ))
$$;

create or replace function public.projects_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_projects_before_update
  before update on public.projects
  for each row execute function public.projects_before_update();

-- Editing your contribution withdraws its confirmation.
create or replace function public.project_members_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.contribution is distinct from old.contribution or new.role is distinct from old.role then
    new.confirmed_by := null;
    new.confirmed_at := null;
  end if;
  return new;
end;
$$;

create trigger trg_project_members_before_update
  before update on public.project_members
  for each row execute function public.project_members_before_update();

alter table public.projects        enable row level security;
alter table public.project_members enable row level security;
revoke all on public.projects, public.project_members from anon, authenticated;
grant select on public.projects, public.project_members to authenticated;
grant update (title, problem, target_user, scope, roles, starts_on, ends_on, verification, demo,
              links, status, team_id)
  on public.projects to authenticated;
grant update (role, contribution) on public.project_members to authenticated;

create policy projects_select on public.projects for select to authenticated
  using (public.is_active_member());
create policy projects_update on public.projects for update to authenticated
  using (public.can_edit_project(id))
  with check (public.can_edit_project(id));

create policy project_members_select on public.project_members for select to authenticated
  using (public.is_active_member());
create policy project_members_update_own on public.project_members for update to authenticated
  using (profile_id = public.current_profile_id())
  with check (profile_id = public.current_profile_id());

create or replace function public.create_project(
  p_title text, p_problem text, p_target_user text, p_scope text default null,
  p_roles text default null, p_starts_on date default null, p_ends_on date default null,
  p_verification text default null, p_demo text default null, p_links text default null,
  p_team uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := public.current_profile_id();
  v_id uuid;
begin
  if v_me is null or not public.is_active_member() then
    raise exception 'not_authenticated';
  end if;
  if p_team is not null and not exists (
    select 1 from public.team_members where team_id = p_team and profile_id = v_me
  ) then
    raise exception 'not_in_team';
  end if;

  insert into public.projects (title, problem, target_user, scope, roles, starts_on, ends_on,
                               verification, demo, links, team_id, owner_id)
  values (btrim(p_title), btrim(p_problem), btrim(p_target_user),
          nullif(btrim(coalesce(p_scope, '')), ''), nullif(btrim(coalesce(p_roles, '')), ''),
          p_starts_on, p_ends_on,
          nullif(btrim(coalesce(p_verification, '')), ''), nullif(btrim(coalesce(p_demo, '')), ''),
          nullif(btrim(coalesce(p_links, '')), ''), p_team, v_me)
  returning id into v_id;
  insert into public.project_members (project_id, profile_id) values (v_id, v_me);
  return v_id;
end;
$$;

create or replace function public.add_project_member(p_project uuid, p_profile uuid, p_role text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_edit_project(p_project) then
    raise exception 'forbidden';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile and status = 'active') then
    raise exception 'not_found';
  end if;
  insert into public.project_members (project_id, profile_id, role)
  values (p_project, p_profile, nullif(btrim(coalesce(p_role, '')), ''))
  on conflict (project_id, profile_id) do nothing;
end;
$$;

create or replace function public.remove_project_member(p_project uuid, p_profile uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_profile <> public.current_profile_id() and not public.can_edit_project(p_project) then
    raise exception 'forbidden';
  end if;
  delete from public.project_members where project_id = p_project and profile_id = p_profile;
end;
$$;

-- The member's track staff confirm what they did.
create or replace function public.confirm_contribution(p_project uuid, p_profile uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_manage(p_profile) or p_profile = public.current_profile_id() then
    raise exception 'forbidden';
  end if;
  update public.project_members
    set confirmed_by = public.current_profile_id(), confirmed_at = now()
    where project_id = p_project and profile_id = p_profile
      and coalesce(btrim(contribution), '') <> '';
  if not found then
    raise exception 'nothing_to_confirm';
  end if;
end;
$$;
