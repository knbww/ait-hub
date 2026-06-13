-- Module 6: Start challenges.
--
-- Council opens a challenge (rules + starter + deadline); members submit a result
-- by link via enter_challenge(); жюри (mentor/admin) scores entries and assigns
-- places with judge_entry(), which awards a one-time prize into the AIP journal
-- (source 'prize'). Closed challenges become a public archive.

create table public.challenges (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  rules       text,
  starter_url text,
  starts_at   timestamptz,
  deadline    timestamptz,
  status      text not null default 'draft',   -- draft | open | judging | closed
  created_at  timestamptz not null default now()
);

create table public.challenge_entries (
  id            uuid primary key default gen_random_uuid(),
  challenge_id  uuid not null references public.challenges (id) on delete cascade,
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  link          text not null,
  comment       text,
  score         int,
  place         int,
  prize_awarded boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (challenge_id, profile_id)
);
create index on public.challenge_entries (challenge_id);
create index on public.challenge_entries (profile_id);

alter table public.challenges        enable row level security;
alter table public.challenge_entries enable row level security;

-- Challenges are public-read; only admins curate them.
create policy "public read challenges" on public.challenges for select using (true);
create policy "admin manage challenges" on public.challenges for all
  using (public.is_admin()) with check (public.is_admin());

-- Entries: own ∨ jury/admin ∨ anyone once the challenge is closed (archive).
-- No direct writes — submissions go through enter_challenge(), grading through judge_entry().
create policy "read entries" on public.challenge_entries for select using (
  public.is_mentor_or_admin()
  or profile_id = public.current_profile_id()
  or exists (select 1 from public.challenges c where c.id = challenge_id and c.status = 'closed')
);

-- ── Member: enter / resubmit while the challenge is open ─────────────────────
create or replace function public.enter_challenge(
  p_challenge uuid, p_link text, p_comment text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile uuid := public.current_profile_id();
  v_ch      public.challenges%rowtype;
begin
  if v_profile is null then
    return 'unauthenticated';
  end if;
  if coalesce(trim(p_link), '') = '' then
    raise exception 'link required';
  end if;

  select * into v_ch from public.challenges where id = p_challenge;
  if not found then
    return 'not_found';
  end if;
  if v_ch.status <> 'open' or (v_ch.deadline is not null and now() > v_ch.deadline) then
    return 'closed';
  end if;

  insert into public.challenge_entries (challenge_id, profile_id, link, comment)
  values (p_challenge, v_profile, p_link, p_comment)
  on conflict (challenge_id, profile_id) do update
    set link = excluded.link, comment = excluded.comment;

  return 'ok';
end;
$$;

-- ── Jury: score an entry + award a one-time prize (place 1/2/3 → +100/75/50) ─
create or replace function public.judge_entry(
  p_entry uuid, p_score int, p_place int, p_aip int
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile uuid;
begin
  if not public.is_mentor_or_admin() then
    raise exception 'forbidden';
  end if;

  update public.challenge_entries
    set score = p_score, place = p_place
    where id = p_entry
    returning profile_id into v_profile;
  if v_profile is null then
    raise exception 'entry not found';
  end if;

  if coalesce(p_aip, 0) > 0 then
    insert into public.xp_events (profile_id, source, delta, ref, note, awarded_by, season_id)
    values (
      v_profile, 'prize', p_aip, 'prize:' || p_entry,
      'Челлендж · место ' || coalesce(p_place::text, '—'),
      public.current_profile_id(), public.active_season_id()
    )
    on conflict (profile_id, source, ref) where ref is not null do nothing;

    update public.challenge_entries set prize_awarded = true where id = p_entry;
  end if;
end;
$$;

revoke execute on function public.enter_challenge(uuid, text, text) from public, anon;
grant  execute on function public.enter_challenge(uuid, text, text) to authenticated;
revoke execute on function public.judge_entry(uuid, int, int, int) from public, anon;
grant  execute on function public.judge_entry(uuid, int, int, int) to authenticated;
