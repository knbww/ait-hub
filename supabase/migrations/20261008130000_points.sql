-- Launch prep (October 2026), step 4: AIT Points (AIP).
--
-- A cumulative score for confirmed work. The price list is not approved yet, so nothing is
-- awarded automatically: club staff add entries by hand — how many, for what, with a note —
-- and the journal records who confirmed each one. A track lead awards only members of their
-- track; director and curator anyone; nobody themselves. The journal is append-only: a
-- mistake is fixed with a "correction" entry, never by editing history.
--
-- Members see their own entries and everyone's totals (leaderboard); the entries of others
-- are visible only to staff who manage them. AIT Points never mix with the track rating.

create table public.points_entries (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  amount     int  not null check (amount <> 0 and abs(amount) <= 1000),
  category   text not null check (category in (
    'required_work', 'extra_work', 'project_stage', 'event',
    'team_help', 'org_contribution', 'correction'
  )),
  note       text not null check (char_length(btrim(note)) between 1 and 300),
  awarded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint points_positive_unless_correction check (category = 'correction' or amount > 0)
);
create index on public.points_entries (profile_id, created_at desc);

alter table public.points_entries enable row level security;
revoke all on public.points_entries from anon, authenticated;
grant select on public.points_entries to authenticated;

create policy points_entries_select on public.points_entries for select to authenticated
  using (profile_id = public.current_profile_id() or public.can_manage(profile_id));

create or replace function public.award_points(p_profile uuid, p_amount int, p_category text, p_note text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not public.is_staff() or not public.can_manage(p_profile) then
    raise exception 'forbidden';
  end if;
  if p_profile = public.current_profile_id() then
    raise exception 'self_award';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile and status = 'active') then
    raise exception 'not_found';
  end if;

  insert into public.points_entries (profile_id, amount, category, note, awarded_by)
  values (p_profile, p_amount, p_category, btrim(coalesce(p_note, '')), public.current_profile_id())
  returning id into v_id;
  return v_id;
end;
$$;

-- Totals only, for any active member. Staff are not ranked.
create or replace function public.points_leaderboard(p_track text default null)
returns table (profile_id uuid, full_name text, avatar_path text, track_id text, grade int, total int)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.full_name, p.avatar_path, p.track_id, p.grade,
         coalesce(sum(e.amount), 0)::int as total
  from public.profiles p
  left join public.points_entries e on e.profile_id = p.id
  where public.is_active_member()
    and p.status = 'active'
    and p.role = 'member'
    and (p_track is null or p.track_id = p_track)
  group by p.id
  order by total desc, p.full_name
$$;

create or replace function public.points_total(p_profile uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.is_active_member() then
    coalesce((select sum(amount) from public.points_entries where profile_id = p_profile), 0)::int
  end
$$;
