-- Push notifications (October 2026): a device the member allowed to notify.
--
-- The browser hands out an endpoint plus two keys; the Edge Function `push` sends through it:
-- a work reviewed, a news post, a request to join a team, and the evening before a deadline or
-- an event. A device belongs to whoever registered it last (a shared computer changes hands);
-- members see and remove only their own. Nothing here is shown to anyone else.

create table public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  endpoint     text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh       text not null check (char_length(p256dh) <= 200),
  auth         text not null check (char_length(auth) <= 100),
  user_agent   text check (user_agent is null or char_length(user_agent) <= 300),
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);
create index on public.push_subscriptions (profile_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant select on public.push_subscriptions to authenticated;

create policy push_subscriptions_select_own on public.push_subscriptions for select to authenticated
  using (profile_id = (select public.current_profile_id()));

create or replace function public.register_push(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := public.current_profile_id();
begin
  if v_me is null or not public.is_active_member() then
    raise exception 'not_authenticated';
  end if;
  insert into public.push_subscriptions (profile_id, endpoint, p256dh, auth, user_agent)
  values (v_me, btrim(p_endpoint), btrim(p_p256dh), btrim(p_auth), left(nullif(btrim(coalesce(p_user_agent, '')), ''), 300))
  on conflict (endpoint) do update
    set profile_id = excluded.profile_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, created_at = now(), last_used_at = null;
end;
$$;

create or replace function public.unregister_push(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions
  where endpoint = btrim(p_endpoint) and profile_id = public.current_profile_id();
$$;

revoke execute on function public.register_push(text, text, text, text), public.unregister_push(text) from public, anon;
