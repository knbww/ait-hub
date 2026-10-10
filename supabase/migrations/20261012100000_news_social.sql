-- News get photos, likes and comments (October 2026).
--
--  * Photos live in a private bucket `news`, in a folder named after the post: members see them
--    through short-lived signed links, nothing is public. Whoever may edit a post may add or
--    remove its photos (up to six). The Hub shrinks each photo before the upload, which also
--    drops its metadata (location, camera). Before publishing photos the author confirms that
--    everyone in them agreed to be photographed; the form lists the members who said no.
--  * Every active member may like a post once and comment on it. A comment is removed by its
--    author, by whoever may edit the post, or by the director / curator; removing someone else's
--    comment is written to the audit log. The author of a post may close its comments.

alter table public.news
  add column photos text[] not null default '{}' check (cardinality(photos) <= 6),
  add column allow_comments boolean not null default true;

grant insert (allow_comments) on public.news to authenticated;
grant update (photos, allow_comments) on public.news to authenticated;

-- Photos are files of this post's folder: `<post id>/<name>.<jpg|png|webp>`.
create or replace function public.news_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_photo text;
begin
  new.updated_at := now();
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      new.author_id := public.current_profile_id();
      new.published_at := now();
    else
      new.author_id := old.author_id;
      new.published_at := old.published_at;
    end if;
  end if;
  foreach v_photo in array new.photos loop
    if v_photo !~ ('^' || new.id::text || '/[A-Za-z0-9_-]{1,64}\.(jpg|png|webp)$') then
      raise exception 'invalid_photo_path';
    end if;
  end loop;
  return new;
end;
$$;

-- ── Photos: private bucket, members only ────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('news', 'news', false, 3 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- May the caller change the photos of the post that owns this folder?
create or replace function public.can_edit_news_folder(p_folder text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.news n
    where n.id::text = p_folder and public.can_edit_track(n.track_id)
  )
$$;

revoke execute on function public.can_edit_news_folder(text) from public, anon;

create policy news_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'news' and public.is_active_member());
create policy news_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'news' and public.can_edit_news_folder((storage.foldername(name))[1]));
create policy news_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'news' and public.can_edit_news_folder((storage.foldername(name))[1]));

-- ── Likes ───────────────────────────────────────────────────────────────────
create table public.news_likes (
  news_id    uuid not null references public.news (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (news_id, profile_id)
);
create index on public.news_likes (profile_id);

alter table public.news_likes enable row level security;
revoke all on public.news_likes from anon, authenticated;
grant select, delete on public.news_likes to authenticated;
grant insert (news_id, profile_id) on public.news_likes to authenticated;

create policy news_likes_select on public.news_likes for select to authenticated
  using (public.is_active_member());
create policy news_likes_insert on public.news_likes for insert to authenticated
  with check (profile_id = (select public.current_profile_id()) and public.is_active_member());
create policy news_likes_delete on public.news_likes for delete to authenticated
  using (profile_id = (select public.current_profile_id()));

-- ── Comments ────────────────────────────────────────────────────────────────
create table public.news_comments (
  id         uuid primary key default gen_random_uuid(),
  news_id    uuid not null references public.news (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index on public.news_comments (news_id, created_at);
create index on public.news_comments (author_id);

-- From the Hub the author is whoever writes. At most five comments a minute, and none under a
-- post whose comments are closed. Maintenance runs (the demo seed) may set author and date.
-- Definer: it counts the writer's comments and reads the post whoever is writing; whether they
-- may write at all is the insert policy's call.
create or replace function public.news_comments_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.body := btrim(new.body);
  if auth.uid() is null then
    return new;
  end if;
  new.author_id := public.current_profile_id();
  new.created_at := now();
  if not coalesce((select n.allow_comments from public.news n where n.id = new.news_id), false) then
    raise exception 'comments_closed';
  end if;
  if (select count(*) from public.news_comments c
      where c.author_id = new.author_id and c.created_at > now() - interval '1 minute') >= 5 then
    raise exception 'too_fast';
  end if;
  return new;
end;
$$;

create trigger trg_news_comments_before_insert
  before insert on public.news_comments
  for each row execute function public.news_comments_before_insert();

-- A moderator removing someone else's comment leaves a trace. Comments that go together with
-- their post or their author (cascades) don't.
create or replace function public.news_comments_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and old.author_id is distinct from public.current_profile_id()
     and exists (select 1 from public.news n where n.id = old.news_id)
     and exists (select 1 from public.profiles p where p.id = old.author_id) then
    perform public.log_action('comment_removed', old.author_id,
      jsonb_build_object('news_id', old.news_id, 'excerpt', left(old.body, 200)));
  end if;
  return old;
end;
$$;

create trigger trg_news_comments_after_delete
  after delete on public.news_comments
  for each row execute function public.news_comments_after_delete();

revoke execute on function
  public.news_comments_before_insert(), public.news_comments_after_delete()
  from public, anon, authenticated;

alter table public.news_comments enable row level security;
revoke all on public.news_comments from anon, authenticated;
grant select, delete on public.news_comments to authenticated;
grant insert (news_id, body) on public.news_comments to authenticated;

create policy news_comments_select on public.news_comments for select to authenticated
  using (public.is_active_member());
create policy news_comments_insert on public.news_comments for insert to authenticated
  with check (author_id = (select public.current_profile_id()) and public.is_active_member());
create policy news_comments_delete on public.news_comments for delete to authenticated
  using (
    author_id = (select public.current_profile_id())
    or exists (select 1 from public.news n where n.id = news_id and public.can_edit_track(n.track_id))
  );
