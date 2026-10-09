-- Launch prep (October 2026), step 6: teams.
--
-- A team belongs to a track (team ratings are per track), has a captain and at most five
-- members; a member is in one active team at a time. Joining goes through a request that the
-- captain or the track's staff answer.

create table public.teams (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 80),
  track_id   text not null references public.tracks (id),
  goal       text check (goal is null or char_length(goal) <= 500),
  captain_id uuid references public.profiles (id) on delete set null,
  status     text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now()
);
create unique index teams_active_name_per_track on public.teams (track_id, lower(btrim(name)))
  where status = 'active';

create table public.team_members (
  team_id    uuid not null references public.teams (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (team_id, profile_id)
);
create index on public.team_members (profile_id);

create table public.team_requests (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  note       text check (note is null or char_length(note) <= 300),
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (team_id, profile_id)
);
create index on public.team_requests (team_id);

-- Five members at most; one active team per member.
create or replace function public.team_members_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.teams where id = new.team_id for update;
  if (select count(*) from public.team_members where team_id = new.team_id) >= 5 then
    raise exception 'team_full';
  end if;
  if exists (
    select 1 from public.team_members m join public.teams t on t.id = m.team_id
    where m.profile_id = new.profile_id and t.status = 'active' and m.team_id <> new.team_id
  ) then
    raise exception 'already_in_team';
  end if;
  return new;
end;
$$;

create trigger trg_team_members_guard
  before insert on public.team_members
  for each row execute function public.team_members_guard();

-- Captain of the team, or staff of its track.
create or replace function public.can_manage_team(p_team uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.teams t
    where t.id = p_team
      and (t.captain_id = public.current_profile_id() or public.can_edit_track(t.track_id))
  )
$$;

alter table public.teams         enable row level security;
alter table public.team_members  enable row level security;
alter table public.team_requests enable row level security;
revoke all on public.teams, public.team_members, public.team_requests from anon, authenticated;
grant select on public.teams, public.team_members, public.team_requests to authenticated;

create policy teams_select on public.teams for select to authenticated
  using (public.is_active_member());
create policy team_members_select on public.team_members for select to authenticated
  using (public.is_active_member());
create policy team_requests_select on public.team_requests for select to authenticated
  using (profile_id = public.current_profile_id() or public.can_manage_team(team_id));

create or replace function public.create_team(p_name text, p_goal text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me   public.profiles%rowtype;
  v_team uuid;
begin
  select * into v_me from public.profiles where user_id = auth.uid() and status = 'active';
  if not found then
    raise exception 'not_authenticated';
  end if;
  if v_me.track_id is null then
    raise exception 'no_track';
  end if;

  insert into public.teams (name, track_id, goal, captain_id)
  values (btrim(p_name), v_me.track_id, nullif(btrim(coalesce(p_goal, '')), ''), v_me.id)
  returning id into v_team;
  insert into public.team_members (team_id, profile_id) values (v_team, v_me.id);
  return v_team;
end;
$$;

create or replace function public.update_team(p_team uuid, p_name text, p_goal text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_manage_team(p_team) then
    raise exception 'forbidden';
  end if;
  update public.teams
    set name = btrim(p_name), goal = nullif(btrim(coalesce(p_goal, '')), '')
    where id = p_team;
end;
$$;

create or replace function public.request_join_team(p_team uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me   public.profiles%rowtype;
  v_team public.teams%rowtype;
begin
  select * into v_me from public.profiles where user_id = auth.uid() and status = 'active';
  if not found then
    raise exception 'not_authenticated';
  end if;
  select * into v_team from public.teams where id = p_team and status = 'active';
  if not found then
    raise exception 'not_found';
  end if;
  if v_me.track_id is distinct from v_team.track_id then
    raise exception 'wrong_track';
  end if;
  if exists (select 1 from public.team_members where team_id = p_team and profile_id = v_me.id) then
    raise exception 'already_member';
  end if;
  if exists (
    select 1 from public.team_members m join public.teams t on t.id = m.team_id
    where m.profile_id = v_me.id and t.status = 'active'
  ) then
    raise exception 'already_in_team';
  end if;
  if (select count(*) from public.team_members where team_id = p_team) >= 5 then
    raise exception 'team_full';
  end if;

  insert into public.team_requests (team_id, profile_id, note, status)
  values (p_team, v_me.id, nullif(btrim(coalesce(p_note, '')), ''), 'pending')
  on conflict (team_id, profile_id) do update
    set note = excluded.note, status = 'pending', created_at = now();
end;
$$;

create or replace function public.respond_join_request(p_request uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_req public.team_requests%rowtype;
begin
  select * into v_req from public.team_requests where id = p_request and status = 'pending';
  if not found then
    raise exception 'not_found';
  end if;
  if not public.can_manage_team(v_req.team_id) then
    raise exception 'forbidden';
  end if;

  if p_accept then
    insert into public.team_members (team_id, profile_id) values (v_req.team_id, v_req.profile_id);
    update public.team_requests set status = 'accepted' where id = p_request;
  else
    update public.team_requests set status = 'declined' where id = p_request;
  end if;
end;
$$;

-- Leaving / removing. A team that loses its captain gets the longest-standing member as
-- captain; an empty team is archived.
create or replace function public.remove_team_member(p_team uuid, p_profile uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team public.teams%rowtype;
begin
  select * into v_team from public.teams where id = p_team;
  if not found then
    raise exception 'not_found';
  end if;
  if p_profile <> public.current_profile_id() and not public.can_manage_team(p_team) then
    raise exception 'forbidden';
  end if;

  delete from public.team_members where team_id = p_team and profile_id = p_profile;
  delete from public.team_requests where team_id = p_team and profile_id = p_profile;

  if v_team.captain_id = p_profile then
    update public.teams
      set captain_id = (
        select profile_id from public.team_members where team_id = p_team order by joined_at limit 1
      )
      where id = p_team;
  end if;
  if not exists (select 1 from public.team_members where team_id = p_team) then
    update public.teams set status = 'archived' where id = p_team;
  end if;
end;
$$;

create or replace function public.archive_team(p_team uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_manage_team(p_team) then
    raise exception 'forbidden';
  end if;
  update public.teams set status = 'archived' where id = p_team;
  delete from public.team_requests where team_id = p_team and status = 'pending';
end;
$$;
