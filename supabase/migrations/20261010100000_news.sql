-- Club news (October 2026): short posts from club management — announcements, results,
-- reminders — shown on the home page and on the news page.
--
-- Text and an optional link only: no photos, so nothing here depends on the photo answer.
-- Director / curator post for the whole club or for any track; a track lead posts for their own
-- track. Every active member reads every post; nothing is public. A pinned post stays on top.

create table public.news (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(btrim(title)) between 1 and 160),
  body         text not null check (char_length(btrim(body)) between 1 and 4000),
  link_url     text check (link_url is null or (link_url ~* '^https://' and char_length(link_url) <= 500)),
  track_id     text references public.tracks (id),
  pinned       boolean not null default false,
  author_id    uuid references public.profiles (id) on delete set null,
  published_at timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index on public.news (published_at desc);

-- From the Hub the author is whoever posts and the date is when they did. Maintenance runs
-- without a signed-in user (migrations, the demo seed) may set both.
create or replace function public.news_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
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
  return new;
end;
$$;

create trigger trg_news_before_write
  before insert or update on public.news
  for each row execute function public.news_before_write();

alter table public.news enable row level security;
revoke all on public.news from anon, authenticated;
grant select, delete on public.news to authenticated;
grant insert (title, body, link_url, track_id, pinned) on public.news to authenticated;
grant update (title, body, link_url, track_id, pinned) on public.news to authenticated;

create policy news_select on public.news for select to authenticated
  using (public.is_active_member());
create policy news_insert on public.news for insert to authenticated
  with check (public.is_staff() and public.can_edit_track(track_id));
create policy news_update on public.news for update to authenticated
  using (public.can_edit_track(track_id))
  with check (public.can_edit_track(track_id));
create policy news_delete on public.news for delete to authenticated
  using (public.can_edit_track(track_id));
