-- Fix: admins couldn't Accept/Reject applications. The UPDATE policy required the JWT
-- app_metadata.role='admin' claim (set only when the custom access-token hook is enabled),
-- while the READ policy already accepts is_admin() (profiles.role). That mismatch let admins
-- SEE applications but silently no-op on UPDATE. Make UPDATE use is_admin() too.

drop policy if exists "admin update applications" on public.applications;
create policy "admin update applications" on public.applications for update
  using (public.is_admin()) with check (public.is_admin());
