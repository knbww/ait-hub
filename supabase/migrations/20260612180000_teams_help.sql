-- Module 5: Teams & help board.
--
-- Founders form small teams (≤4) via join requests; members help each other on a
-- help board where a confirmed task awards the helper +15 AIP. Two-party check:
-- the helper does the work, the *requester* confirms (anti-cheat, spec §2/§5).

create table public.teams (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  goal         text,
  founder_id   uuid not null references public.profiles (id) on delete cascade,
  needed_roles text[] not null default '{}',
  status       text not null default 'forming',  -- forming | active | archived
  created_at   timestamptz not null default now()
);

create table public.team_members (
  team_id    uuid not null references public.teams (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role       text not null default 'build',      -- build | growth | data | founder
  joined_at  timestamptz not null default now(),
  primary key (team_id, profile_id)
);
create index on public.team_members (profile_id);

create table public.team_requests (
  id         uuid primary key default gen_random_uuid(),
  team_id    uuid not null references public.teams (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role       text not null default 'build',
  note       text,
  status     text not null default 'pending',    -- pending | accepted | declined
  created_at timestamptz not null default now(),
  unique (team_id, profile_id)
);
create index on public.team_requests (team_id);

create table public.help_requests (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  title        text not null,
  description  text,
  status       text not null default 'open',      -- open | claimed | done
  helper_id    uuid references public.profiles (id) on delete set null,
  rewarded     boolean not null default false,
  created_at   timestamptz not null default now(),
  claimed_at   timestamptz,
  done_at      timestamptz
);
create index on public.help_requests (status);

alter table public.teams         enable row level security;
alter table public.team_members  enable row level security;
alter table public.team_requests enable row level security;
alter table public.help_requests enable row level security;

create policy "public read teams"         on public.teams         for select using (true);
create policy "public read team_members"  on public.team_members  for select using (true);
create policy "public read help_requests" on public.help_requests for select using (true);

-- Join requests: requester, the team's founder, or an admin may read.
create policy "read team_requests" on public.team_requests for select using (
  public.is_admin()
  or profile_id = public.current_profile_id()
  or exists (
    select 1 from public.teams t where t.id = team_id and t.founder_id = public.current_profile_id()
  )
);

-- Founder/admin may edit their team (e.g. status); other writes go via functions.
create policy "founder manage teams" on public.teams for update
  using (public.is_admin() or founder_id = public.current_profile_id())
  with check (public.is_admin() or founder_id = public.current_profile_id());

-- ── Team functions ───────────────────────────────────────────────────────────
create or replace function public.create_team(p_name text, p_goal text, p_roles text[])
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_me   uuid := public.current_profile_id();
  v_team uuid;
begin
  if v_me is null then raise exception 'not authenticated'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'name required'; end if;

  insert into public.teams (name, goal, founder_id, needed_roles)
  values (p_name, p_goal, v_me, coalesce(p_roles, '{}'))
  returning id into v_team;

  insert into public.team_members (team_id, profile_id, role) values (v_team, v_me, 'founder');
  return v_team;
end;
$$;

create or replace function public.request_join_team(p_team uuid, p_role text, p_note text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := public.current_profile_id();
begin
  if v_me is null then return 'unauthenticated'; end if;
  if exists (select 1 from public.team_members where team_id = p_team and profile_id = v_me) then
    return 'already_member';
  end if;

  insert into public.team_requests (team_id, profile_id, role, note, status)
  values (p_team, v_me, coalesce(nullif(trim(p_role), ''), 'build'), p_note, 'pending')
  on conflict (team_id, profile_id) do update
    set role = excluded.role, note = excluded.note, status = 'pending';
  return 'ok';
end;
$$;

create or replace function public.respond_join_request(p_request uuid, p_accept boolean)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_me    uuid := public.current_profile_id();
  v_req   public.team_requests%rowtype;
  v_count int;
begin
  if v_me is null then return 'unauthenticated'; end if;
  select * into v_req from public.team_requests where id = p_request;
  if not found then return 'not_found'; end if;
  if not exists (select 1 from public.teams where id = v_req.team_id and founder_id = v_me) then
    raise exception 'forbidden';
  end if;

  if not p_accept then
    update public.team_requests set status = 'declined' where id = p_request;
    return 'declined';
  end if;

  select count(*) into v_count from public.team_members where team_id = v_req.team_id;
  if v_count >= 4 then return 'full'; end if;

  insert into public.team_members (team_id, profile_id, role)
  values (v_req.team_id, v_req.profile_id, v_req.role)
  on conflict do nothing;
  update public.team_requests set status = 'accepted' where id = p_request;
  return 'ok';
end;
$$;

-- ── Help-board functions ─────────────────────────────────────────────────────
create or replace function public.post_help(p_title text, p_description text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare v_me uuid := public.current_profile_id();
begin
  if v_me is null then return 'unauthenticated'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'title required'; end if;
  insert into public.help_requests (requester_id, title, description)
  values (v_me, p_title, p_description);
  return 'ok';
end;
$$;

create or replace function public.claim_help(p_request uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_me  uuid := public.current_profile_id();
  v_req public.help_requests%rowtype;
begin
  if v_me is null then return 'unauthenticated'; end if;
  select * into v_req from public.help_requests where id = p_request;
  if not found then return 'not_found'; end if;
  if v_req.requester_id = v_me then return 'own'; end if;
  if v_req.status <> 'open' then return 'taken'; end if;

  update public.help_requests
    set status = 'claimed', helper_id = v_me, claimed_at = now()
    where id = p_request;
  return 'ok';
end;
$$;

create or replace function public.confirm_help(p_request uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_me  uuid := public.current_profile_id();
  v_req public.help_requests%rowtype;
begin
  if v_me is null then return 'unauthenticated'; end if;
  select * into v_req from public.help_requests where id = p_request;
  if not found then return 'not_found'; end if;
  if v_req.requester_id <> v_me then raise exception 'forbidden'; end if;
  if v_req.status <> 'claimed' or v_req.helper_id is null then return 'not_claimed'; end if;

  update public.help_requests
    set status = 'done', done_at = now(), rewarded = true
    where id = p_request;

  insert into public.xp_events (profile_id, source, delta, ref, awarded_by, season_id)
  values (v_req.helper_id, 'help', 15, 'help:' || p_request, v_me, public.active_season_id())
  on conflict (profile_id, source, ref) where ref is not null do nothing;
  return 'ok';
end;
$$;

-- ── Grants ───────────────────────────────────────────────────────────────────
revoke execute on function public.create_team(text, text, text[])        from public, anon;
revoke execute on function public.request_join_team(uuid, text, text)    from public, anon;
revoke execute on function public.respond_join_request(uuid, boolean)    from public, anon;
revoke execute on function public.post_help(text, text)                  from public, anon;
revoke execute on function public.claim_help(uuid)                       from public, anon;
revoke execute on function public.confirm_help(uuid)                     from public, anon;

grant execute on function public.create_team(text, text, text[])         to authenticated;
grant execute on function public.request_join_team(uuid, text, text)     to authenticated;
grant execute on function public.respond_join_request(uuid, boolean)     to authenticated;
grant execute on function public.post_help(text, text)                   to authenticated;
grant execute on function public.claim_help(uuid)                        to authenticated;
grant execute on function public.confirm_help(uuid)                      to authenticated;
