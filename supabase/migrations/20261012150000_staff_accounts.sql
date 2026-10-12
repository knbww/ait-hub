-- Director / curator accounts from the dashboard: Authentication → Add user, with a temporary
-- password. Sign-up through the Hub still needs a join code. An account created without one is
-- let in only if the operator invited that email in the SQL Editor beforehand (see README):
--  * the invite names the role and the temporary password; the account must come with that same
--    password. Supabase Auth inserts the user the same way for a public sign-up and for Add user,
--    but the password hash is already in the row, so someone who only knows the email can't take
--    the invite;
--  * the invite is used up by the account, so no staff email or password stays in the database;
--    none is kept in the repo either;
--  * the account gets the role, no track and no grade (staff are adults).
-- Track leads are pupils: they still sign up with their track's code and the director promotes them.

-- Created anew: a database may hold an older shape of this table, and invites are only pending
-- accounts, nothing to keep.
drop table if exists public.staff_invites;
create table public.staff_invites (
  email         text primary key check (email = lower(btrim(email))),
  role          text not null check (role in ('director', 'curator')),
  full_name     text not null check (char_length(btrim(full_name)) between 1 and 120),
  temp_password text not null check (char_length(temp_password) between 8 and 72),
  created_at    timestamptz not null default now()
);
alter table public.staff_invites enable row level security;
revoke all on public.staff_invites from anon, authenticated;

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

  select * into v_code
  from public.join_codes
  where code = upper(btrim(meta ->> 'join_code')) and active;
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

  insert into public.profiles (user_id, full_name, role, grade, track_id, cohort_id, status)
  values (new.id, v_name, 'member', v_grade, v_code.track_id, v_code.cohort_id, 'active')
  on conflict (user_id) do nothing
  returning id into v_profile;

  if v_profile is not null then
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

-- A track lead left without a track (set_member_track to none) compared `null = p_track`, and
-- `if not null` let them through: they could replace every track's code. Now it's 'forbidden'.
create or replace function public.rotate_join_code(p_track text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not (public.is_oversight()
          or (public.my_role() = 'track_lead' and coalesce(public.my_track_id() = p_track, false))) then
    raise exception 'forbidden';
  end if;
  if not exists (select 1 from public.tracks where id = p_track) then
    raise exception 'invalid_track';
  end if;

  update public.join_codes
    set active = false
    where track_id = p_track and cohort_id = public.default_cohort_id() and active;

  loop
    v_code := public.generate_join_code();
    exit when not exists (select 1 from public.join_codes where code = v_code);
  end loop;

  insert into public.join_codes (code, track_id, cohort_id, created_by)
  values (v_code, p_track, public.default_cohort_id(), public.current_profile_id());
  perform public.log_action('join_code_rotated', null, jsonb_build_object('track', p_track));
  return v_code;
end;
$$;
