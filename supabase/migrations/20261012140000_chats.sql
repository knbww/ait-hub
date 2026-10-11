-- Chats (October 2026): one chat per team and per project, and each member's conversation with
-- club management («Написать руководству»).
--
-- Who reads and writes:
--  * a team chat — the team's members and the leads of its track;
--  * a project chat — the owner, the members and the leads of the members' tracks;
--  * a member's conversation with management — the member, the leads of their track, the
--    director and the curator.
-- Nobody else reads a chat, the director and the curator included: the club is for school
-- students, so instead of reading everything they act on reports. Any participant can report a
-- message; the report keeps a copy of it, the director and the curator review it and may remove
-- the message. A lead may also remove messages in the chats they take part in. Removing someone
-- else's message goes to the audit log. New messages arrive live (Supabase Realtime, under the
-- same rules) and as a push to the other participants.

create table public.conversations (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in ('team', 'project', 'lead')),
  team_id         uuid unique references public.teams (id) on delete cascade,
  project_id      uuid unique references public.projects (id) on delete cascade,
  member_id       uuid unique references public.profiles (id) on delete cascade,
  created_at      timestamptz not null default now(),
  last_message_at timestamptz,
  check (
    (kind = 'team' and team_id is not null and project_id is null and member_id is null)
    or (kind = 'project' and project_id is not null and team_id is null and member_id is null)
    or (kind = 'lead' and member_id is not null and team_id is null and project_id is null)
  )
);

-- Everyone who takes part in a conversation (active accounts only).
create or replace function public.chat_participants(p_conversation uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  with c as (select * from public.conversations where id = p_conversation)
  select p.id from public.profiles p, c
  where p.status = 'active' and (
    (c.kind = 'team' and (
      exists (select 1 from public.team_members tm where tm.team_id = c.team_id and tm.profile_id = p.id)
      or (p.role = 'track_lead' and p.track_id = (select t.track_id from public.teams t where t.id = c.team_id))
    ))
    or (c.kind = 'project' and (
      exists (select 1 from public.projects pr where pr.id = c.project_id and pr.owner_id = p.id)
      or exists (select 1 from public.project_members pm where pm.project_id = c.project_id and pm.profile_id = p.id)
      or (p.role = 'track_lead' and p.track_id in (
        select m.track_id from public.project_members pm join public.profiles m on m.id = pm.profile_id
        where pm.project_id = c.project_id and m.track_id is not null))
    ))
    or (c.kind = 'lead' and (
      p.id = c.member_id
      or p.role in ('director', 'curator')
      or (p.role = 'track_lead' and p.track_id is not null
          and p.track_id = (select m.track_id from public.profiles m where m.id = c.member_id))
    ))
  )
$$;
revoke execute on function public.chat_participants(uuid) from public, anon, authenticated;
grant execute on function public.chat_participants(uuid) to service_role;

create or replace function public.can_chat(p_conversation uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.chat_participants(p_conversation) as p(id) where p.id = public.current_profile_id()
  )
$$;
revoke execute on function public.can_chat(uuid) from public, anon;

alter table public.conversations enable row level security;
revoke all on public.conversations from anon, authenticated;
grant select on public.conversations to authenticated;
create policy conversations_select on public.conversations for select to authenticated
  using (public.can_chat(id));

-- ── Messages ────────────────────────────────────────────────────────────────
create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  author_id       uuid not null references public.profiles (id) on delete cascade,
  body            text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at      timestamptz not null default now()
);
create index on public.messages (conversation_id, created_at desc);
create index on public.messages (author_id);

-- From the Hub the author is whoever writes; at most ten messages a minute. Maintenance runs
-- (the demo seed) may set author and date.
create or replace function public.messages_before_insert()
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
  if (select count(*) from public.messages m
      where m.author_id = new.author_id and m.created_at > now() - interval '1 minute') >= 10 then
    raise exception 'too_fast';
  end if;
  return new;
end;
$$;

create or replace function public.messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.conversations set last_message_at = new.created_at
    where id = new.conversation_id and (last_message_at is null or last_message_at < new.created_at);
  return null;
end;
$$;

-- A lead or a reviewed report removing someone else's message leaves a trace; messages that go
-- with their chat or their author don't.
create or replace function public.messages_after_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null
     and old.author_id is distinct from public.current_profile_id()
     and exists (select 1 from public.conversations c where c.id = old.conversation_id)
     and exists (select 1 from public.profiles p where p.id = old.author_id) then
    perform public.log_action('message_removed', old.author_id,
      jsonb_build_object('conversation_id', old.conversation_id, 'excerpt', left(old.body, 200)));
  end if;
  return null;
end;
$$;

create trigger trg_messages_before_insert before insert on public.messages
  for each row execute function public.messages_before_insert();
create trigger trg_messages_after_insert after insert on public.messages
  for each row execute function public.messages_after_insert();
create trigger trg_messages_after_delete after delete on public.messages
  for each row execute function public.messages_after_delete();
revoke execute on function
  public.messages_before_insert(), public.messages_after_insert(), public.messages_after_delete()
  from public, anon, authenticated;

alter table public.messages enable row level security;
revoke all on public.messages from anon, authenticated;
grant select, delete on public.messages to authenticated;
grant insert (conversation_id, body) on public.messages to authenticated;

create policy messages_select on public.messages for select to authenticated
  using (public.can_chat(conversation_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (author_id = (select public.current_profile_id()) and public.can_chat(conversation_id));
create policy messages_delete on public.messages for delete to authenticated
  using (
    author_id = (select public.current_profile_id())
    or (public.my_role() = 'track_lead' and public.can_chat(conversation_id))
  );

-- Live updates: the realtime publication exists on Supabase, not in the local test database.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages;
  end if;
end;
$$;

-- ── Read marks ──────────────────────────────────────────────────────────────
create table public.conversation_reads (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  profile_id      uuid not null references public.profiles (id) on delete cascade,
  last_read_at    timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);
create index on public.conversation_reads (profile_id);

alter table public.conversation_reads enable row level security;
revoke all on public.conversation_reads from anon, authenticated;
grant select on public.conversation_reads to authenticated;
create policy conversation_reads_select on public.conversation_reads for select to authenticated
  using (profile_id = (select public.current_profile_id()));

create or replace function public.mark_chat_read(p_conversation uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_chat(p_conversation) then
    raise exception 'forbidden';
  end if;
  insert into public.conversation_reads (conversation_id, profile_id, last_read_at)
  values (p_conversation, public.current_profile_id(), now())
  on conflict (conversation_id, profile_id) do update set last_read_at = excluded.last_read_at;
end;
$$;
revoke execute on function public.mark_chat_read(uuid) from public, anon;

-- ── Opening a chat ──────────────────────────────────────────────────────────
-- Each returns the conversation, creating it on first use; only for those who take part in it.
create or replace function public.open_team_chat(p_team uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from public.teams where id = p_team) then
    raise exception 'not_found';
  end if;
  insert into public.conversations (kind, team_id) values ('team', p_team) on conflict (team_id) do nothing;
  select id into v_id from public.conversations where team_id = p_team;
  if not public.can_chat(v_id) then
    raise exception 'forbidden';
  end if;
  return v_id;
end;
$$;

create or replace function public.open_project_chat(p_project uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not exists (select 1 from public.projects where id = p_project) then
    raise exception 'not_found';
  end if;
  insert into public.conversations (kind, project_id) values ('project', p_project) on conflict (project_id) do nothing;
  select id into v_id from public.conversations where project_id = p_project;
  if not public.can_chat(v_id) then
    raise exception 'forbidden';
  end if;
  return v_id;
end;
$$;

-- A member opens their own conversation with management; staff open a member's.
create or replace function public.open_lead_chat(p_member uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid := coalesce(p_member, public.current_profile_id());
  v_id     uuid;
begin
  if not exists (select 1 from public.profiles where id = v_member and role = 'member') then
    raise exception 'not_found';
  end if;
  insert into public.conversations (kind, member_id) values ('lead', v_member) on conflict (member_id) do nothing;
  select id into v_id from public.conversations where member_id = v_member;
  if not public.can_chat(v_id) then
    raise exception 'forbidden';
  end if;
  return v_id;
end;
$$;
revoke execute on function public.open_team_chat(uuid), public.open_project_chat(uuid), public.open_lead_chat(uuid)
  from public, anon;

-- The inbox: the caller's conversations with the last message and how many are unread.
create or replace function public.my_conversations()
returns table (
  id uuid, kind text, team_id uuid, project_id uuid, member_id uuid, name text,
  last_message_at timestamptz, last_body text, last_author_id uuid, last_author text, unread int
)
language sql
stable
set search_path = ''
as $$
  select c.id, c.kind, c.team_id, c.project_id, c.member_id,
         coalesce(t.name, pr.title, m.full_name),
         c.last_message_at, lm.body, lm.author_id, la.full_name,
         (select count(*)::int from public.messages x
          where x.conversation_id = c.id
            and x.author_id <> public.current_profile_id()
            and x.created_at > coalesce(r.last_read_at, '-infinity'))
  from public.conversations c
  left join public.teams t on t.id = c.team_id
  left join public.projects pr on pr.id = c.project_id
  left join public.profiles m on m.id = c.member_id
  left join public.conversation_reads r on r.conversation_id = c.id and r.profile_id = public.current_profile_id()
  left join lateral (
    select x.body, x.author_id from public.messages x
    where x.conversation_id = c.id order by x.created_at desc limit 1
  ) lm on true
  left join public.profiles la on la.id = lm.author_id
  order by c.last_message_at desc nulls last, c.created_at desc
$$;
revoke execute on function public.my_conversations() from public, anon;

-- ── Reports ─────────────────────────────────────────────────────────────────
create table public.message_reports (
  id              uuid primary key default gen_random_uuid(),
  message_id      uuid references public.messages (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete set null,
  reporter_id     uuid references public.profiles (id) on delete set null,
  author_id       uuid references public.profiles (id) on delete set null,
  -- A copy of the message, so the report still says what was written after it is removed.
  excerpt         text not null check (char_length(excerpt) <= 2000),
  reason          text check (reason is null or char_length(reason) <= 500),
  status          text not null default 'open' check (status in ('open', 'removed', 'dismissed')),
  created_at      timestamptz not null default now(),
  resolved_at     timestamptz,
  resolved_by     uuid references public.profiles (id) on delete set null
);
create unique index message_reports_once on public.message_reports (message_id, reporter_id) where status = 'open';
create index on public.message_reports (status, created_at desc);
create index on public.message_reports (reporter_id);
create index on public.message_reports (author_id);
create index on public.message_reports (conversation_id);
create index on public.message_reports (resolved_by);

alter table public.message_reports enable row level security;
revoke all on public.message_reports from anon, authenticated;
grant select on public.message_reports to authenticated;
create policy message_reports_select on public.message_reports for select to authenticated
  using (public.is_oversight() or reporter_id = (select public.current_profile_id()));

create or replace function public.report_message(p_message uuid, p_reason text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_msg public.messages%rowtype;
  v_id  uuid;
begin
  select * into v_msg from public.messages where id = p_message;
  if not found then
    raise exception 'not_found';
  end if;
  if not public.can_chat(v_msg.conversation_id) or v_msg.author_id = public.current_profile_id() then
    raise exception 'forbidden';
  end if;
  insert into public.message_reports (message_id, conversation_id, reporter_id, author_id, excerpt, reason)
  values (v_msg.id, v_msg.conversation_id, public.current_profile_id(), v_msg.author_id, v_msg.body,
          nullif(btrim(coalesce(p_reason, '')), ''))
  on conflict (message_id, reporter_id) where status = 'open' do nothing
  returning id into v_id;
  return v_id;
end;
$$;

-- Director / curator: remove the message or dismiss the report. Other open reports of the same
-- message are closed with it.
create or replace function public.resolve_report(p_report uuid, p_remove boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.message_reports%rowtype;
begin
  if not public.is_oversight() then
    raise exception 'forbidden';
  end if;
  select * into v_report from public.message_reports where id = p_report;
  if not found then
    raise exception 'not_found';
  end if;
  update public.message_reports
    set status = case when p_remove then 'removed' else 'dismissed' end,
        resolved_at = now(),
        resolved_by = public.current_profile_id()
    where status = 'open' and (id = p_report or (v_report.message_id is not null and message_id = v_report.message_id));
  if p_remove and v_report.message_id is not null then
    delete from public.messages where id = v_report.message_id;
  end if;
end;
$$;
revoke execute on function public.report_message(uuid, text), public.resolve_report(uuid, boolean) from public, anon;
