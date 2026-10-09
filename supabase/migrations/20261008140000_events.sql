-- Launch prep (October 2026), step 5: the club calendar.
--
-- Concrete dates and the person responsible for each event live here (the template — which
-- events happen in which weeks — stays in the track calendars in Drive). Only the club's own
-- event types exist. Staff create events as drafts; members see them once confirmed, so the
-- calendar never promises something the club hasn't confirmed.
--
-- Rated events (Codeforces contest / AI tournament / pitch review) change the track rating.
-- Their rules must be announced before the start: confirming a rated event stamps
-- rules_published_at, the rules can't be edited once it starts, and results can only be
-- published when the rules were out before the start.

create table public.events (
  id                 uuid primary key default gen_random_uuid(),
  cohort_id          uuid not null default public.default_cohort_id() references public.cohorts (id) on delete cascade,
  type               text not null,
  title              text not null check (char_length(btrim(title)) between 1 and 160),
  track_id           text references public.tracks (id),
  starts_at          timestamptz not null,
  ends_at            timestamptz,
  location           text check (location is null or char_length(location) <= 200),
  description        text check (description is null or char_length(description) <= 4000),
  responsible_id     uuid references public.profiles (id) on delete set null,
  is_rated           boolean not null default false,
  rules              text check (rules is null or char_length(rules) <= 8000),
  rules_url          text check (rules_url is null or rules_url ~* '^https://'),
  rules_published_at timestamptz,
  status             text not null default 'draft'
                     check (status in ('draft', 'confirmed', 'cancelled', 'completed')),
  created_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint events_type_check check (type in (
    'contest', 'tournament', 'pitch_review', 'simulation',
    'workshop', 'hackathon', 'demo_day', 'talkx', 'club_evening'
  )),
  -- Track-specific formats belong to their track; the rest are club-wide or per track.
  constraint events_type_track check (
    (type <> 'contest' or track_id is not distinct from 'algo')
    and (type <> 'tournament' or track_id is not distinct from 'ai')
    and (type not in ('pitch_review', 'simulation') or track_id is not distinct from 'startup')
  ),
  constraint events_dates check (ends_at is null or ends_at >= starts_at),
  constraint events_rated_type check (not is_rated or type in ('contest', 'tournament', 'pitch_review')),
  constraint events_rated_rules check (
    not is_rated or coalesce(btrim(rules), '') <> '' or rules_url is not null
  )
);
create index on public.events (starts_at);

-- May the caller edit things that belong to this track (events, rating results)?
-- Director / curator: everything, including club-wide events. Lead: their own track.
create or replace function public.can_edit_track(p_track text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_oversight()
    or (public.my_role() = 'track_lead' and p_track is not null and p_track = public.my_track_id())
$$;

create or replace function public.events_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_by := public.current_profile_id();
    new.created_at := now();
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.cohort_id := old.cohort_id;
  end if;

  -- Once a rated event has started, its rules and terms are frozen.
  if tg_op = 'UPDATE' and old.is_rated and old.rules_published_at is not null and now() >= old.starts_at
     and (new.rules is distinct from old.rules
          or new.rules_url is distinct from old.rules_url
          or new.is_rated is distinct from old.is_rated
          or new.starts_at is distinct from old.starts_at
          or new.type is distinct from old.type
          or new.track_id is distinct from old.track_id
          or new.status = 'draft') then
    raise exception 'rules_locked';
  end if;

  -- rules_published_at = when the current rules became visible to members (confirmation).
  if not new.is_rated or new.status = 'draft' then
    new.rules_published_at := null;
  elsif tg_op = 'INSERT'
        or old.rules_published_at is null
        or new.rules is distinct from old.rules
        or new.rules_url is distinct from old.rules_url then
    new.rules_published_at := now();
  else
    new.rules_published_at := old.rules_published_at;
  end if;

  if new.status = 'completed' then
    if now() < new.starts_at then
      raise exception 'event_not_started';
    end if;
    if new.is_rated and (new.rules_published_at is null or new.rules_published_at >= new.starts_at) then
      raise exception 'rules_not_announced_in_advance';
    end if;
  end if;

  -- Reopening a finished event (it changes the rating) is for director / curator only.
  if tg_op = 'UPDATE' and old.status = 'completed' and new.status <> 'completed'
     and not public.is_oversight() then
    raise exception 'forbidden';
  end if;
  return new;
end;
$$;

create trigger trg_events_before_write
  before insert or update on public.events
  for each row execute function public.events_before_write();

create or replace function public.events_after_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform public.log_action('event_created', null,
      jsonb_build_object('event', new.id, 'title', new.title, 'status', new.status));
  elsif tg_op = 'DELETE' then
    perform public.log_action('event_deleted', null,
      jsonb_build_object('event', old.id, 'title', old.title));
  elsif new.status is distinct from old.status then
    perform public.log_action('event_' || new.status, null,
      jsonb_build_object('event', new.id, 'title', new.title, 'from', old.status));
  end if;
  return null;
end;
$$;

create trigger trg_events_after_write
  after insert or update or delete on public.events
  for each row execute function public.events_after_write();

alter table public.events enable row level security;
revoke all on public.events from anon, authenticated;
grant select, insert, update, delete on public.events to authenticated;

create policy events_select on public.events for select to authenticated
  using (public.is_active_member() and (status <> 'draft' or public.is_staff()));
create policy events_insert on public.events for insert to authenticated
  with check (public.can_edit_track(track_id));
create policy events_update on public.events for update to authenticated
  using (public.can_edit_track(track_id))
  with check (public.can_edit_track(track_id));
create policy events_delete on public.events for delete to authenticated
  using (public.can_edit_track(track_id) and status = 'draft');
