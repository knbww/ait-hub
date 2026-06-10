-- Bucket 2: mentorship bookings + a DB-backed admin check that works without
-- the custom-access-token hook (reads profiles directly).

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

create table public.mentorship_bookings (
  id              uuid primary key default gen_random_uuid(),
  mentor_id       uuid references public.profiles (id) on delete set null,
  mentor_name     text,
  requester_name  text not null,
  requester_email text not null,
  note            text,
  status          text not null default 'requested',
  created_at      timestamptz not null default now()
);

alter table public.mentorship_bookings enable row level security;

-- Anyone may request a meeting.
create policy "anyone can request booking" on public.mentorship_bookings
  for insert with check (true);
-- A mentor sees bookings addressed to them; admins see all.
create policy "mentor or admin reads bookings" on public.mentorship_bookings
  for select using (
    public.is_admin()
    or mentor_id in (select id from public.profiles where user_id = auth.uid())
  );
create policy "admin updates bookings" on public.mentorship_bookings
  for update using (public.is_admin()) with check (public.is_admin());

-- Let admins read applications without the JWT role-claim hook
-- (SELECT policies are OR'd with the existing claim-based one).
create policy "db-admin reads applications" on public.applications
  for select using (public.is_admin());
