-- The curator is an adult on the club's staff, not a pupil: no school grade and no track.
--  * Curators promoted from a pupil account kept both; they are cleared here.
--  * A check keeps it that way (her own profile edit, a track from a join code, a track set by
--    the director all fail).
--  * set_member_role clears both when someone becomes curator.

update public.profiles set grade = null, track_id = null
where role = 'curator' and (grade is not null or track_id is not null);

alter table public.profiles drop constraint if exists profiles_curator_no_grade_track;
alter table public.profiles add constraint profiles_curator_no_grade_track
  check (role <> 'curator' or (grade is null and track_id is null));

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
  perform public.require_mfa();
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

  update public.profiles
    set role = p_role,
        grade = case when p_role = 'curator' then null else grade end,
        track_id = case when p_role = 'curator' then null else track_id end
    where id = p_profile;
  perform public.log_action('role_changed', p_profile, jsonb_build_object('from', v_old, 'to', p_role));
end;
$$;
