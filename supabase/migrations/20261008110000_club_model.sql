-- Launch prep (October 2026), step 2: the club as it works now.
--
--  * Three tracks (ИИ / Алгоритмы и олимпиады / Стартап-инженерия); a member is in one.
--  * Grades 7–12. Roles: member, track_lead, director, curator ("staff" = the last three).
--  * Cohorts (groups): one today; regional online groups later, each with its own week 1.
--  * Join codes: a track lead shows the track's code (as a QR) at the meeting. Signing up with
--    it is the lead's confirmation and puts the member into that track. No code, no account.
--  * Minors' data: `profiles` holds only what other members may see; contacts and the answer
--    about photos live in `member_private`, visible to the member, their track lead and the
--    director / curator. Without a "yes" to photos, no photo is stored or shown.
--  * Staff actions that change someone's account are written to `audit_log`.
--
-- Access helpers are SECURITY DEFINER and read `profiles` directly (no JWT claims), so they
-- work whether or not the custom access-token hook is enabled.

create extension if not exists pgcrypto with schema extensions;

-- ── Tracks & cohorts ─────────────────────────────────────────────────────────
create table public.tracks (
  id          text primary key,
  title       text not null,
  short_title text not null,
  drive_url   text check (drive_url is null or drive_url ~* '^https://'),
  sort        int  not null
);

insert into public.tracks (id, title, short_title, sort) values
  ('ai',      'Искусственный интеллект', 'ИИ',        1),
  ('algo',    'Алгоритмы и олимпиады',   'Алгоритмы', 2),
  ('startup', 'Стартап-инженерия',       'Стартап',   3);

create table public.cohorts (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index cohorts_single_default on public.cohorts (is_default) where is_default;

insert into public.cohorts (title, is_default) values ('AIT Club · 2026/27', true);

create or replace function public.default_cohort_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.cohorts where is_default
$$;

-- ── Profiles: roles as text, new fields ─────────────────────────────────────
drop policy if exists "public read profiles" on public.profiles;
drop policy if exists "update own profile" on public.profiles;
drop policy if exists "admin manage profiles" on public.profiles;

alter table public.profiles alter column role drop default;
alter table public.profiles alter column role type text using (
  case role::text
    when 'admin'  then 'director'
    when 'mentor' then 'track_lead'
    else 'member'
  end
);
alter table public.profiles alter column role set default 'member';
alter table public.profiles add constraint profiles_role_check
  check (role in ('member', 'track_lead', 'director', 'curator'));

-- Still referenced by Authentication > Hooks if the hook is enabled in the dashboard, so it
-- must keep existing; it now reads the text role.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
as $$
declare
  claims      jsonb := event -> 'claims';
  member_role text;
begin
  select role into member_role
  from public.profiles
  where user_id = (event ->> 'user_id')::uuid;

  if claims -> 'app_metadata' is null then
    claims := jsonb_set(claims, '{app_metadata}', '{}'::jsonb);
  end if;
  claims := jsonb_set(claims, '{app_metadata,role}', to_jsonb(coalesce(member_role, 'member')));
  return jsonb_set(event, '{claims}', claims);
end;
$$;

drop type public.user_role;

alter table public.profiles rename column avatar_url to avatar_path;

alter table public.profiles
  add column grade               int check (grade between 7 and 12),
  add column track_id            text references public.tracks (id),
  add column cohort_id           uuid references public.cohorts (id) on delete set null,
  add column codeforces_handle   text,
  add column status              text not null default 'active',
  add column course_completed_at timestamptz,
  add column updated_at          timestamptz not null default now();

alter table public.profiles add constraint profiles_status_check
  check (status in ('active', 'inactive'));
alter table public.profiles add constraint profiles_full_name_check
  check (char_length(btrim(full_name)) between 1 and 120) not valid;
alter table public.profiles add constraint profiles_handles_check check (
  (github_username is null or github_username ~ '^[A-Za-z0-9-]{1,39}$')
  and (codeforces_handle is null or codeforces_handle ~ '^[A-Za-z0-9_.-]{1,24}$')
) not valid;

create index on public.profiles (track_id);

-- Avatars move to a private bucket: store the object path, not a public URL. Photos are shown
-- only after an explicit "yes" to photos, which nobody has given yet — so clear them for now.
update public.profiles set avatar_path = null;

update public.profiles set cohort_id = public.default_cohort_id() where cohort_id is null;
alter table public.profiles alter column cohort_id set default public.default_cohort_id();

-- ── Private member data ──────────────────────────────────────────────────────
create table public.member_private (
  profile_id    uuid primary key references public.profiles (id) on delete cascade,
  email         text,
  telegram      text check (telegram is null or char_length(telegram) <= 64),
  -- May the club photograph / film the member? null = not answered yet.
  photo_consent boolean,
  updated_at    timestamptz not null default now()
);

insert into public.member_private (profile_id, email)
select p.id, u.email
from public.profiles p
join auth.users u on u.id = p.user_id
on conflict (profile_id) do nothing;

-- ── Access helpers ───────────────────────────────────────────────────────────
create or replace function public.current_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from public.profiles where user_id = auth.uid()
$$;

-- The caller's role, or null when signed out or deactivated.
create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.profiles where user_id = auth.uid() and status = 'active'
$$;

create or replace function public.my_track_id()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select track_id from public.profiles where user_id = auth.uid()
$$;

create or replace function public.is_active_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where user_id = auth.uid() and status = 'active')
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.my_role() in ('track_lead', 'director', 'curator'), false)
$$;

create or replace function public.is_director()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.my_role() = 'director', false)
$$;

-- Director and curator oversee the whole club.
create or replace function public.is_oversight()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.my_role() in ('director', 'curator'), false)
$$;

-- May the caller manage this member (see contacts, works, points journal; award points)?
-- Director / curator: anyone. Track lead: members of their own track.
create or replace function public.can_manage(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_oversight() then true
    when public.my_role() = 'track_lead' then exists (
      select 1 from public.profiles t
      where t.id = p_profile
        and t.role = 'member'
        and t.track_id is not null
        and t.track_id = public.my_track_id()
    )
    else false
  end
$$;

-- ── Profiles & private data: access rules ───────────────────────────────────
-- Definer: it reads the photo answer from member_private whoever is writing.
create or replace function public.profiles_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.full_name := btrim(new.full_name);
  new.github_username := nullif(btrim(new.github_username), '');
  new.codeforces_handle := nullif(btrim(new.codeforces_handle), '');
  if new.avatar_path is not null then
    -- An avatar must be the member's own upload…
    if split_part(new.avatar_path, '/', 1) <> new.user_id::text then
      raise exception 'avatar_path_foreign';
    end if;
    -- …and only with a "yes" to photos.
    if not coalesce((select mp.photo_consent from public.member_private mp where mp.profile_id = new.id), false) then
      new.avatar_path := null;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_profiles_before_write
  before insert or update on public.profiles
  for each row execute function public.profiles_before_write();

revoke all on public.profiles from anon;
revoke insert, update, delete on public.profiles from authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, grade, avatar_path, github_username, codeforces_handle)
  on public.profiles to authenticated;

-- Everyone in the club sees active members' public fields; staff also see deactivated ones.
create policy profiles_select on public.profiles for select to authenticated using (
  user_id = (select auth.uid())
  or (public.is_active_member() and (status = 'active' or public.is_staff()))
);
create policy profiles_update_own on public.profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
-- The access-token hook runs as supabase_auth_admin.
create policy profiles_auth_hook_read on public.profiles for select to supabase_auth_admin
  using (true);

create or replace function public.member_private_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.telegram := nullif(regexp_replace(btrim(coalesce(new.telegram, '')), '^@+', ''), '');
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_member_private_before_write
  before insert or update on public.member_private
  for each row execute function public.member_private_before_write();

-- Saying "no" to photos removes the photo from the profile at once.
create or replace function public.member_private_after_consent()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.photo_consent is not true then
    update public.profiles set avatar_path = null where id = new.profile_id and avatar_path is not null;
  end if;
  return null;
end;
$$;

create trigger trg_member_private_after_consent
  after update of photo_consent on public.member_private
  for each row execute function public.member_private_after_consent();

alter table public.member_private enable row level security;
revoke all on public.member_private from anon, authenticated;
grant select on public.member_private to authenticated;
grant update (telegram, photo_consent) on public.member_private to authenticated;

create policy member_private_select on public.member_private for select to authenticated
  using (profile_id = public.current_profile_id() or public.can_manage(profile_id));
create policy member_private_update_own on public.member_private for update to authenticated
  using (profile_id = public.current_profile_id())
  with check (profile_id = public.current_profile_id());

-- ── Audit log ────────────────────────────────────────────────────────────────
create table public.audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid references public.profiles (id) on delete set null,
  action     text not null,
  target_id  uuid,
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;
revoke all on public.audit_log from anon, authenticated;
grant select on public.audit_log to authenticated;
create policy audit_log_select on public.audit_log for select to authenticated
  using (public.is_oversight());

create or replace function public.log_action(p_action text, p_target uuid, p_details jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (actor_id, action, target_id, details)
  values (public.current_profile_id(), p_action, p_target, coalesce(p_details, '{}'::jsonb));
$$;
revoke execute on function public.log_action(text, uuid, jsonb) from public, anon, authenticated;

-- ── Join codes ───────────────────────────────────────────────────────────────
create table public.join_codes (
  code       text primary key check (code ~ '^[A-Z0-9]{6,12}$'),
  track_id   text not null references public.tracks (id),
  cohort_id  uuid not null references public.cohorts (id) on delete cascade,
  active     boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index join_codes_one_active on public.join_codes (track_id, cohort_id) where active;

-- 8 characters from an alphabet without look-alikes (no 0/O, 1/I/L): ~10^12 codes.
create or replace function public.generate_join_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(8);
  result text := '';
begin
  for i in 0..7 loop
    result := result || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return result;
end;
$$;
revoke execute on function public.generate_join_code() from public, anon, authenticated;

insert into public.join_codes (code, track_id, cohort_id)
select public.generate_join_code(), t.id, public.default_cohort_id()
from public.tracks t;

alter table public.join_codes enable row level security;
revoke all on public.join_codes from anon, authenticated;
grant select on public.join_codes to authenticated;
create policy join_codes_select on public.join_codes for select to authenticated using (
  public.is_oversight()
  or (public.my_role() = 'track_lead' and track_id = public.my_track_id())
);

-- Public: lets the join page say which track a code belongs to before signing up.
create or replace function public.check_join_code(p_code text)
returns table (track_id text, track_title text)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.title
  from public.join_codes c
  join public.tracks t on t.id = c.track_id
  where c.code = upper(btrim(p_code)) and c.active
$$;

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
  select * into v_code from public.join_codes where code = upper(btrim(p_code)) and active;
  if not found then
    raise exception 'invalid_join_code';
  end if;

  update public.profiles
    set track_id = v_code.track_id, cohort_id = v_code.cohort_id
    where id = v_me.id;
  perform public.log_action('track_claimed', v_me.id, jsonb_build_object('track', v_code.track_id));
  return v_code.track_id;
end;
$$;

-- A lead replaces their track's code (e.g. after it leaked); director / curator any track's.
create or replace function public.rotate_join_code(p_track text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  if not (public.is_oversight() or (public.my_role() = 'track_lead' and public.my_track_id() = p_track)) then
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

-- ── Sign-up: only with an active join code ──────────────────────────────────
-- Fires on auth.users INSERT (trigger on_auth_user_created). Raising here makes the sign-up
-- request fail, so an account can't exist without a valid code.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta      jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_code    public.join_codes%rowtype;
  v_name    text := btrim(coalesce(meta ->> 'full_name', ''));
  v_grade   int;
  v_profile uuid;
begin
  select * into v_code
  from public.join_codes
  where code = upper(btrim(coalesce(meta ->> 'join_code', ''))) and active;
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

-- ── Staff actions on accounts ───────────────────────────────────────────────
create or replace function public.set_member_role(p_profile uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text;
begin
  if not public.is_director() then
    raise exception 'forbidden';
  end if;
  if p_role not in ('member', 'track_lead', 'director', 'curator') then
    raise exception 'invalid_role';
  end if;
  select role into v_old from public.profiles where id = p_profile;
  if not found then
    raise exception 'not_found';
  end if;
  if v_old = 'director' and p_role <> 'director'
     and (select count(*) from public.profiles where role = 'director' and status = 'active') <= 1 then
    raise exception 'last_director';
  end if;

  update public.profiles set role = p_role where id = p_profile;
  perform public.log_action('role_changed', p_profile, jsonb_build_object('from', v_old, 'to', p_role));
end;
$$;

create or replace function public.set_member_track(p_profile uuid, p_track text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old text;
begin
  if not public.is_director() then
    raise exception 'forbidden';
  end if;
  if p_track is not null and not exists (select 1 from public.tracks where id = p_track) then
    raise exception 'invalid_track';
  end if;
  select track_id into v_old from public.profiles where id = p_profile;
  if not found then
    raise exception 'not_found';
  end if;

  update public.profiles set track_id = p_track where id = p_profile;
  perform public.log_action('track_changed', p_profile, jsonb_build_object('from', v_old, 'to', p_track));
end;
$$;

create or replace function public.set_member_status(p_profile uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.profiles%rowtype;
begin
  if p_status not in ('active', 'inactive') then
    raise exception 'invalid_status';
  end if;
  select * into v_target from public.profiles where id = p_profile;
  if not found then
    raise exception 'not_found';
  end if;
  if not (public.is_director() or (public.my_role() = 'track_lead' and public.can_manage(p_profile))) then
    raise exception 'forbidden';
  end if;
  if p_profile = public.current_profile_id() then
    raise exception 'cannot_change_self';
  end if;
  if v_target.role = 'director' and p_status = 'inactive'
     and (select count(*) from public.profiles where role = 'director' and status = 'active') <= 1 then
    raise exception 'last_director';
  end if;

  update public.profiles set status = p_status where id = p_profile;
  perform public.log_action('status_changed', p_profile,
    jsonb_build_object('from', v_target.status, 'to', p_status));
end;
$$;

-- Without an email domain there is no "forgot password" mail; the director sets a new one.
create or replace function public.admin_set_password(p_profile uuid, p_password text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid;
begin
  if not public.is_director() then
    raise exception 'forbidden';
  end if;
  if char_length(coalesce(p_password, '')) < 8 then
    raise exception 'weak_password';
  end if;
  select user_id into v_user from public.profiles where id = p_profile;
  if v_user is null then
    raise exception 'not_found';
  end if;

  update auth.users
    set encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
        updated_at = now()
    where id = v_user;
  perform public.log_action('password_reset', p_profile, '{}'::jsonb);
end;
$$;

-- Full deletion on request. Profile-owned rows go with the profile (ON DELETE CASCADE); the
-- login is removed too when the database role is allowed to (otherwise the caller is told to
-- delete it in Authentication > Users). Avatar files are removed by the client beforehand.
create or replace function public.delete_member(p_profile uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.profiles%rowtype;
  v_auth   boolean := false;
begin
  if not public.is_director() then
    raise exception 'forbidden';
  end if;
  select * into v_target from public.profiles where id = p_profile;
  if not found then
    raise exception 'not_found';
  end if;
  if p_profile = public.current_profile_id() then
    raise exception 'cannot_change_self';
  end if;
  if v_target.role = 'director'
     and (select count(*) from public.profiles where role = 'director' and status = 'active') <= 1 then
    raise exception 'last_director';
  end if;

  perform public.log_action('member_deleted', p_profile,
    jsonb_build_object('full_name', v_target.full_name, 'track', v_target.track_id));
  delete from public.profiles where id = p_profile;

  if v_target.user_id is not null then
    begin
      delete from auth.users where id = v_target.user_id;
      v_auth := true;
    exception
      when insufficient_privilege then v_auth := false;
    end;
  end if;
  return jsonb_build_object('auth_deleted', v_auth);
end;
$$;

-- ── Avatars: private bucket, members only ───────────────────────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do update set public = false;

update storage.buckets
  set file_size_limit = 2 * 1024 * 1024,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
  where id = 'avatars';

drop policy if exists "avatars public read" on storage.objects;
drop policy if exists "avatars insert own" on storage.objects;
drop policy if exists "avatars update own" on storage.objects;

create policy avatars_read on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and public.is_active_member());
create policy avatars_insert_own on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.is_active_member()
  );
create policy avatars_update_own on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy avatars_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_director())
  );

-- ── Small public tables ─────────────────────────────────────────────────────
alter table public.tracks enable row level security;
alter table public.cohorts enable row level security;
revoke all on public.tracks, public.cohorts from anon, authenticated;
grant select on public.tracks, public.cohorts to authenticated;
grant update (drive_url) on public.tracks to authenticated;

create policy tracks_select on public.tracks for select to authenticated using (true);
create policy tracks_update on public.tracks for update to authenticated
  using (public.is_oversight() or (public.my_role() = 'track_lead' and id = public.my_track_id()))
  with check (public.is_oversight() or (public.my_role() = 'track_lead' and id = public.my_track_id()));
create policy cohorts_select on public.cohorts for select to authenticated using (true);

-- ── Retire the June role helpers ────────────────────────────────────────────
drop function if exists public.is_admin();
drop function if exists public.is_mentor_or_admin();
drop function if exists public.current_role_claim();
