-- Launch prep (October 2026), step 7: track ratings.
--
-- Three independent ratings, one per track, never merged with each other or with AIT Points.
-- A rating changes only through a rated event (contest / tournament / pitch review) whose
-- rules were announced before it started. Staff of the event's track enter the results —
-- place, score and the rating change the announced rules give — after the start, and
-- completing the event publishes them. Published results are locked; reopening an event is
-- for director / curator only and is logged. Results are per member or per team.

create table public.rating_results (
  id           uuid primary key default gen_random_uuid(),
  event_id     uuid not null references public.events (id) on delete cascade,
  profile_id   uuid references public.profiles (id) on delete cascade,
  team_id      uuid references public.teams (id) on delete cascade,
  place        int check (place is null or place > 0),
  score        numeric(10, 2),
  rating_delta int not null check (abs(rating_delta) <= 1000),
  note         text check (note is null or char_length(note) <= 300),
  entered_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  constraint rating_results_subject check (num_nonnulls(profile_id, team_id) = 1),
  unique (event_id, profile_id),
  unique (event_id, team_id)
);
create index on public.rating_results (profile_id);
create index on public.rating_results (team_id);

-- Results can be edited while the rated event has started, is not yet completed, and its
-- rules were announced before the start — by staff of the event's track.
create or replace function public.can_edit_results(p_event uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event
      and e.is_rated
      and e.status = 'confirmed'
      and e.rules_published_at is not null
      and e.rules_published_at < e.starts_at
      and now() >= e.starts_at
      and public.can_edit_track(e.track_id)
  )
$$;

create or replace function public.rating_results_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_track text;
begin
  select track_id into v_track from public.events where id = new.event_id;
  if new.team_id is not null
     and not exists (select 1 from public.teams where id = new.team_id and track_id = v_track) then
    raise exception 'team_wrong_track';
  end if;
  new.entered_by := public.current_profile_id();
  return new;
end;
$$;

create trigger trg_rating_results_before_write
  before insert or update on public.rating_results
  for each row execute function public.rating_results_before_write();

alter table public.rating_results enable row level security;
revoke all on public.rating_results from anon, authenticated;
grant select, insert, update, delete on public.rating_results to authenticated;

create policy rating_results_select on public.rating_results for select to authenticated using (
  public.is_active_member() and exists (
    select 1 from public.events e
    where e.id = event_id and (e.status = 'completed' or public.can_edit_track(e.track_id))
  )
);
create policy rating_results_insert on public.rating_results for insert to authenticated
  with check (public.can_edit_results(event_id));
create policy rating_results_update on public.rating_results for update to authenticated
  using (public.can_edit_results(event_id))
  with check (public.can_edit_results(event_id));
create policy rating_results_delete on public.rating_results for delete to authenticated
  using (public.can_edit_results(event_id));

-- ── Ratings (published results only) ────────────────────────────────────────
create or replace function public.track_rating(p_track text)
returns table (
  profile_id uuid, full_name text, avatar_path text, grade int,
  rating int, events int, best_place int, last_event_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.avatar_path, p.grade,
         sum(r.rating_delta)::int as rating,
         count(*)::int,
         min(r.place),
         max(e.starts_at)
  from public.rating_results r
  join public.events e on e.id = r.event_id
  join public.profiles p on p.id = r.profile_id
  where public.is_active_member()
    and e.status = 'completed'
    and e.track_id = p_track
    and p.status = 'active'
  group by p.id
  order by rating desc, p.full_name
$$;

create or replace function public.team_rating(p_track text)
returns table (team_id uuid, name text, status text, rating int, events int, best_place int)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.name, t.status,
         sum(r.rating_delta)::int as rating,
         count(*)::int,
         min(r.place)
  from public.rating_results r
  join public.events e on e.id = r.event_id
  join public.teams t on t.id = r.team_id
  where public.is_active_member()
    and e.status = 'completed'
    and e.track_id = p_track
  group by t.id
  order by rating desc, t.name
$$;
