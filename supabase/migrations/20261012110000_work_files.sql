-- Files with a week's work (October 2026): up to three files of up to 5 MB each — a PDF, a
-- screenshot, a notebook, an archive with code — next to the link or instead of it.
--
-- Files live in a private bucket `works`, in the member's folder (named after their profile).
-- They are seen by whoever sees the work: the member, their track lead, the director / curator.
-- Members add and remove their own files; the director may remove anyone's (deleting a
-- member's data). Only document, image, archive and code formats are accepted, and the Hub
-- stores code and text as plain text, so a browser never runs them.

alter table public.submissions alter column link drop not null;
alter table public.submissions
  add column files jsonb not null default '[]'::jsonb
    check (jsonb_typeof(files) = 'array' and jsonb_array_length(files) <= 3),
  add constraint submissions_link_or_files check (link is not null or jsonb_array_length(files) > 0);

-- ── Bucket ──────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('works', 'works', false, 5 * 1024 * 1024, array[
  'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/zip', 'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.presentation',
  'application/vnd.oasis.opendocument.spreadsheet'
])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- A file name the Hub gives: random letters, then one of the accepted extensions.
create or replace function public.is_work_file_name(p_name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_name ~ ('^[A-Za-z0-9_-]{1,40}\.(pdf|png|jpe?g|webp|gif|zip|txt|md|csv|json|ipynb|py|cpp|cc|c|h|hpp'
                   '|java|kt|cs|go|rs|rb|php|js|jsx|ts|tsx|html|css|sql|sh|docx|pptx|xlsx|odt|odp|ods)$')
$$;

-- May the caller see the files in this member's folder?
create or replace function public.can_see_work_folder(p_folder text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_folder = public.current_profile_id()::text
    or exists (select 1 from public.profiles p where p.id::text = p_folder and public.can_manage(p.id))
$$;
revoke execute on function public.can_see_work_folder(text) from public, anon;

create policy works_read on storage.objects for select to authenticated
  using (bucket_id = 'works' and public.can_see_work_folder((storage.foldername(name))[1]));
create policy works_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'works'
    and (storage.foldername(name))[1] = (select public.current_profile_id())::text
    and array_length(storage.foldername(name), 1) = 1
    and public.is_work_file_name(substr(name, char_length((storage.foldername(name))[1]) + 2))
    and public.is_active_member()
  );
create policy works_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'works'
    and ((storage.foldername(name))[1] = (select public.current_profile_id())::text or public.is_director())
  );

-- ── Handing in ──────────────────────────────────────────────────────────────
-- `p_files`: [{path, name, size}] — files the member uploaded to their folder first. A link,
-- files, or both.
drop function if exists public.submit_work(uuid, text, text);
create function public.submit_work(p_week uuid, p_link text, p_comment text default null, p_files jsonb default '[]'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me    public.profiles%rowtype;
  v_track text;
  v_link  text := nullif(btrim(coalesce(p_link, '')), '');
  v_files jsonb := coalesce(p_files, '[]'::jsonb);
  v_file  jsonb;
  v_clean jsonb := '[]'::jsonb;
begin
  select * into v_me from public.profiles where user_id = auth.uid() and status = 'active';
  if not found then
    raise exception 'not_authenticated';
  end if;
  select track_id into v_track from public.program_weeks where id = p_week;
  if not found then
    raise exception 'not_found';
  end if;
  if v_me.track_id is distinct from v_track then
    raise exception 'wrong_track';
  end if;
  if v_link is not null and v_link !~* '^https?://' then
    raise exception 'invalid_link';
  end if;
  if jsonb_typeof(v_files) <> 'array' then
    raise exception 'invalid_file';
  end if;
  if jsonb_array_length(v_files) > 3 then
    raise exception 'too_many_files';
  end if;
  if v_link is null and jsonb_array_length(v_files) = 0 then
    raise exception 'link_or_file';
  end if;

  for v_file in select value from jsonb_array_elements(v_files) loop
    if jsonb_typeof(v_file) <> 'object' or jsonb_typeof(v_file -> 'size') <> 'number' then
      raise exception 'invalid_file';
    end if;
    if coalesce(v_file ->> 'path', '') !~ ('^' || v_me.id::text || '/[^/]+$')
       or not public.is_work_file_name(split_part(v_file ->> 'path', '/', 2))
       or char_length(btrim(coalesce(v_file ->> 'name', ''))) not between 1 and 120
       or (v_file ->> 'size')::numeric not between 1 and 5 * 1024 * 1024
       or not exists (select 1 from storage.objects o where o.bucket_id = 'works' and o.name = v_file ->> 'path') then
      raise exception 'invalid_file';
    end if;
    v_clean := v_clean || jsonb_build_array(jsonb_build_object(
      'path', v_file ->> 'path',
      'name', btrim(v_file ->> 'name'),
      'size', (v_file ->> 'size')::bigint
    ));
  end loop;

  insert into public.submissions (profile_id, week_id, link, comment, files)
  values (v_me.id, p_week, v_link, nullif(btrim(coalesce(p_comment, '')), ''), v_clean)
  on conflict (profile_id, week_id) do update
    set link = excluded.link,
        comment = excluded.comment,
        files = excluded.files,
        status = 'submitted',
        feedback = null,
        reviewer_id = null,
        reviewed_at = null,
        submitted_at = now();
end;
$$;
revoke execute on function public.submit_work(uuid, text, text, jsonb) from public, anon;

-- A member's data download lists their files too.
create or replace function public.export_member_data(p_profile uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not (p_profile = public.current_profile_id() or public.can_manage(p_profile)) then
    raise exception 'forbidden';
  end if;
  if p_profile is distinct from public.current_profile_id() then
    perform public.require_mfa();
  end if;

  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) - 'user_id' from public.profiles p where p.id = p_profile),
    'contacts', (select to_jsonb(mp) - 'profile_id' from public.member_private mp where mp.profile_id = p_profile),
    'works', coalesce((
      select jsonb_agg(jsonb_build_object(
        'week', w.week_number, 'title', w.title, 'link', s.link, 'comment', s.comment,
        'files', (select coalesce(jsonb_agg(f ->> 'name'), '[]'::jsonb) from jsonb_array_elements(s.files) f),
        'status', s.status, 'feedback', s.feedback,
        'submitted_at', s.submitted_at, 'reviewed_at', s.reviewed_at
      ) order by w.week_number)
      from public.submissions s join public.program_weeks w on w.id = s.week_id
      where s.profile_id = p_profile
    ), '[]'::jsonb),
    'attendance', coalesce((
      select jsonb_agg(jsonb_build_object('week', w.week_number, 'meeting', a.kind, 'marked_at', a.marked_at)
                       order by w.week_number, a.kind)
      from public.attendance a join public.program_weeks w on w.id = a.week_id
      where a.profile_id = p_profile
    ), '[]'::jsonb),
    'ait_points', coalesce((
      select jsonb_agg(jsonb_build_object(
        'amount', e.amount, 'category', e.category, 'note', e.note,
        'confirmed_by', a.full_name, 'created_at', e.created_at
      ) order by e.created_at)
      from public.points_entries e left join public.profiles a on a.id = e.awarded_by
      where e.profile_id = p_profile
    ), '[]'::jsonb),
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object('team', t.name, 'track', t.track_id, 'joined_at', m.joined_at))
      from public.team_members m join public.teams t on t.id = m.team_id
      where m.profile_id = p_profile
    ), '[]'::jsonb),
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object(
        'project', pr.title, 'role', pm.role, 'contribution', pm.contribution,
        'confirmed', pm.confirmed_at is not null
      ))
      from public.project_members pm join public.projects pr on pr.id = pm.project_id
      where pm.profile_id = p_profile
    ), '[]'::jsonb),
    'rating_results', coalesce((
      select jsonb_agg(jsonb_build_object(
        'event', e.title, 'track', e.track_id, 'date', e.starts_at,
        'place', r.place, 'score', r.score, 'rating_delta', r.rating_delta
      ) order by e.starts_at)
      from public.rating_results r join public.events e on e.id = r.event_id
      where r.profile_id = p_profile and e.status = 'completed'
    ), '[]'::jsonb),
    'news_comments', coalesce((
      select jsonb_agg(jsonb_build_object('news', n.title, 'comment', c.body, 'created_at', c.created_at)
                       order by c.created_at)
      from public.news_comments c join public.news n on n.id = c.news_id
      where c.author_id = p_profile
    ), '[]'::jsonb)
  ) into v_result;

  if p_profile <> public.current_profile_id() then
    perform public.log_action('member_data_exported', p_profile, '{}'::jsonb);
  end if;
  return v_result;
end;
$$;
