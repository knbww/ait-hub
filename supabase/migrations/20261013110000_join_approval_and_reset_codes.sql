-- Joining and getting back in (October 2026, after the product review):
--  * A join code ends (14 days by default) and may have a limit of sign-ups: a photographed QR
--    that goes round a class chat stops working on its own.
--  * Whoever signs up with a code waits until the track's lead or the director / curator confirms
--    them. Until then they see only their own profile — not the members, the calendar or the news.
--  * A forgotten password: the lead (or director / curator) issues a one-time code, valid for 15
--    minutes and shown once; the member enters it with their email at /reset and sets the new
--    password themselves, so nobody else ever knows it. Only a hash of the code is kept; five
--    wrong tries cancel it.

-- ── Join codes: an end date and a limit ─────────────────────────────────────
alter table public.join_codes
  add column expires_at timestamptz,
  add column max_uses   int check (max_uses is null or max_uses between 1 and 500),
  add column uses       int not null default 0;

-- Codes already handed out keep working for two more weeks.
update public.join_codes set expires_at = now() + interval '14 days' where active and expires_at is null;

-- The code row, if it can still be used to join.
create or replace function public.usable_join_code(p_code text)
returns setof public.join_codes
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.join_codes c
  where c.code = upper(btrim(coalesce(p_code, '')))
    and c.active
    and (c.expires_at is null or c.expires_at > now())
    and (c.max_uses is null or c.uses < c.max_uses)
$$;
revoke execute on function public.usable_join_code(text) from public, anon, authenticated;

create or replace function public.check_join_code(p_code text)
returns table (track_id text, track_title text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.title
  from public.usable_join_code(p_code) c
  join public.tracks t on t.id = c.track_id
$$;

-- A lead replaces their track's code (e.g. after it leaked); director / curator any track's.
-- The new code works for p_days days, for at most p_max_uses sign-ups when given.
drop function if exists public.rotate_join_code(text);
create function public.rotate_join_code(p_track text, p_days int default 14, p_max_uses int default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  -- my_role() is null for a switched-off or unconfirmed account: coalesce, or `not null` lets it by.
  if not (public.is_oversight()
          or coalesce(public.my_role() = 'track_lead' and public.my_track_id() = p_track, false)) then
    raise exception 'forbidden';
  end if;
  if not exists (select 1 from public.tracks where id = p_track) then
    raise exception 'invalid_track';
  end if;
  if p_days is null or p_days not between 1 and 90 or (p_max_uses is not null and p_max_uses not between 1 and 500) then
    raise exception 'invalid_code_terms';
  end if;

  update public.join_codes
    set active = false
    where track_id = p_track and cohort_id = public.default_cohort_id() and active;

  loop
    v_code := public.generate_join_code();
    exit when not exists (select 1 from public.join_codes where code = v_code);
  end loop;

  insert into public.join_codes (code, track_id, cohort_id, created_by, expires_at, max_uses)
  values (v_code, p_track, public.default_cohort_id(), public.current_profile_id(),
          now() + make_interval(days => p_days), p_max_uses);
  perform public.log_action('join_code_rotated', null,
    jsonb_build_object('track', p_track, 'days', p_days, 'max_uses', p_max_uses));
  return v_code;
end;
$$;
revoke execute on function public.rotate_join_code(text, int, int) from public, anon;

-- ── Waiting for confirmation ────────────────────────────────────────────────
alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check
  check (status in ('pending', 'active', 'inactive'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta      jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_code    public.join_codes%rowtype;
  v_invite  public.staff_invites%rowtype;
  v_name    text := btrim(coalesce(meta ->> 'full_name', ''));
  v_grade   int;
  v_profile uuid;
begin
  -- Staff, created in the dashboard (no join code in the metadata).
  if coalesce(meta ->> 'join_code', '') = '' then
    -- A bcrypt hash from Supabase Auth; users without a password (GitHub) never match.
    if coalesce(new.encrypted_password, '') like '$2%' then
      delete from public.staff_invites
      where email = lower(btrim(coalesce(new.email, '')))
        and new.encrypted_password = extensions.crypt(temp_password, new.encrypted_password)
      returning * into v_invite;
    end if;
    if v_invite.email is null then
      raise exception 'invalid_join_code';
    end if;

    insert into public.profiles (user_id, full_name, role, grade, track_id, cohort_id, status)
    values (new.id, btrim(v_invite.full_name), v_invite.role, null, null, public.default_cohort_id(), 'active')
    on conflict (user_id) do nothing
    returning id into v_profile;

    if v_profile is not null then
      insert into public.member_private (profile_id, email) values (v_profile, new.email);
    end if;
    return new;
  end if;

  select * into v_code from public.usable_join_code(meta ->> 'join_code');
  if not found then
    raise exception 'invalid_join_code';
  end if;

  if char_length(v_name) not between 1 and 120 then
    raise exception 'invalid_full_name';
  end if;

  begin
    v_grade := (meta ->> 'grade')::int;
  exception
    when others then v_grade := null;
  end;
  if v_grade is null or v_grade not between 7 and 12 then
    raise exception 'invalid_grade';
  end if;

  -- A pupil joins as «pending» until their lead (or the director / curator) confirms them.
  insert into public.profiles (user_id, full_name, role, grade, track_id, cohort_id, status)
  values (new.id, v_name, 'member', v_grade, v_code.track_id, v_code.cohort_id, 'pending')
  on conflict (user_id) do nothing
  returning id into v_profile;

  if v_profile is not null then
    update public.join_codes set uses = uses + 1 where code = v_code.code;
    insert into public.member_private (profile_id, email, telegram, photo_consent)
    values (
      v_profile, new.email, nullif(left(btrim(coalesce(meta ->> 'telegram', '')), 64), ''),
      case meta ->> 'photo_consent' when 'true' then true when 'false' then false end
    );
  end if;
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- For accounts that predate tracks: join a track with its code.
create or replace function public.claim_track(p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me   public.profiles%rowtype;
  v_code public.join_codes%rowtype;
begin
  select * into v_me from public.profiles where user_id = auth.uid() and status = 'active';
  if not found then
    raise exception 'not_authenticated';
  end if;
  if v_me.track_id is not null then
    raise exception 'track_already_set';
  end if;
  select * into v_code from public.usable_join_code(p_code);
  if not found then
    raise exception 'invalid_join_code';
  end if;

  update public.profiles
    set track_id = v_code.track_id, cohort_id = v_code.cohort_id
    where id = v_me.id;
  update public.join_codes set uses = uses + 1 where code = v_code.code;
  perform public.log_action('track_claimed', v_me.id, jsonb_build_object('track', v_code.track_id));
  return v_code.track_id;
end;
$$;

-- The track's lead or the director / curator lets a new member in, or turns them away (the
-- account is switched off; the director can delete it).
create or replace function public.decide_join(p_profile uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
begin
  select status into v_status from public.profiles where id = p_profile;
  if not found then
    raise exception 'not_found';
  end if;
  if not public.can_manage(p_profile) then
    raise exception 'forbidden';
  end if;
  if v_status <> 'pending' then
    raise exception 'not_pending';
  end if;

  update public.profiles set status = case when p_approve then 'active' else 'inactive' end where id = p_profile;
  perform public.log_action(case when p_approve then 'join_approved' else 'join_rejected' end, p_profile, '{}'::jsonb);
end;
$$;
revoke execute on function public.decide_join(uuid, boolean) from public, anon;

-- ── One-time password reset codes ───────────────────────────────────────────
create table public.password_reset_codes (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  code_hash  text not null,
  attempts   int not null default 0,
  expires_at timestamptz not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index on public.password_reset_codes (created_by);
alter table public.password_reset_codes enable row level security;
revoke all on public.password_reset_codes from anon, authenticated;

-- Staff who manage the member issue a code (second factor required); it is returned once.
create or replace function public.create_reset_code(p_profile uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not public.can_manage(p_profile) or p_profile = public.current_profile_id() then
    raise exception 'forbidden';
  end if;
  perform public.require_mfa();
  if not exists (select 1 from public.profiles where id = p_profile and user_id is not null) then
    raise exception 'not_found';
  end if;

  v_code := public.generate_join_code();
  insert into public.password_reset_codes (profile_id, code_hash, attempts, expires_at, created_by, created_at)
  values (p_profile, extensions.crypt(v_code, extensions.gen_salt('bf')), 0, now() + interval '15 minutes',
          public.current_profile_id(), now())
  on conflict (profile_id) do update
    set code_hash = excluded.code_hash, attempts = 0, expires_at = excluded.expires_at,
        created_by = excluded.created_by, created_at = excluded.created_at;
  perform public.log_action('reset_code_issued', p_profile, '{}'::jsonb);
  return v_code;
end;
$$;
revoke execute on function public.create_reset_code(uuid) from public, anon;

-- The member, signed out: email + code + new password. Returns 'ok' or 'invalid' (the same for a
-- wrong email, a wrong or expired code — nothing tells which). A wrong try is counted without an
-- error, so the count survives; the fifth one cancels the code.
create or replace function public.reset_password_with_code(p_email text, p_code text, p_password text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile uuid;
  v_user    uuid;
  v_reset   public.password_reset_codes%rowtype;
begin
  if char_length(coalesce(p_password, '')) < 8 then
    raise exception 'weak_password';
  end if;

  select p.id, p.user_id into v_profile, v_user
  from public.member_private mp join public.profiles p on p.id = mp.profile_id
  where lower(mp.email) = lower(btrim(coalesce(p_email, ''))) and p.user_id is not null and p.status <> 'inactive';
  if v_profile is null then
    return 'invalid';
  end if;

  select * into v_reset from public.password_reset_codes where profile_id = v_profile for update;
  if not found or v_reset.expires_at <= now() then
    return 'invalid';
  end if;
  if extensions.crypt(upper(btrim(coalesce(p_code, ''))), v_reset.code_hash) <> v_reset.code_hash then
    if v_reset.attempts + 1 >= 5 then
      delete from public.password_reset_codes where profile_id = v_profile;
    else
      update public.password_reset_codes set attempts = attempts + 1 where profile_id = v_profile;
    end if;
    return 'invalid';
  end if;

  update auth.users
    set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')), updated_at = now()
    where id = v_user;
  -- Signed out everywhere else: whoever knew the old password loses the session too.
  begin
    delete from auth.sessions where user_id = v_user;
  exception
    when others then null;
  end;
  delete from public.password_reset_codes where profile_id = v_profile;
  perform public.log_action('password_reset_by_code', v_profile, '{}'::jsonb);
  return 'ok';
end;
$$;
revoke execute on function public.reset_password_with_code(text, text, text) from public;
grant execute on function public.reset_password_with_code(text, text, text) to anon, authenticated;
