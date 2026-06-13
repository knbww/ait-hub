-- Profile avatars: a public Storage bucket where each member may write only
-- under their own auth.uid() folder (avatars/<uid>/…). Read is public so the
-- avatar URL renders everywhere.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars public read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatars update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
