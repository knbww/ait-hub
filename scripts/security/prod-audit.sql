-- Read-only: paste into Supabase → SQL Editor and run. Returns counts and settings, no names, emails
-- or messages. The `want` column says what a healthy project shows.

select * from (values
  (1, 'Latest migration applied',
   (select max(version) from supabase_migrations.schema_migrations), '20261106120000 or later'),
  (2, 'Tables without row-level security',
   (select count(*)::text from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity), '0'),
  (3, 'Functions a guest can call',
   (select string_agg(p.proname, ', ' order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')), 'check_join_code, reset_password_with_code'),
  (4, 'Definer functions without a fixed search_path',
   (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prosecdef
      and not exists (select 1 from unnest(p.proconfig) c where c like 'search\_path=%')), '0'),
  (5, 'Public storage buckets',
   (select count(*)::text from storage.buckets where public), '0'),
  (6, 'Demo switch in the club''s database',
   (select count(*)::text from private.settings), '0'),
  (7, 'Directors and curators without a second factor',
   (select count(*)::text from public.profiles p
    where p.role in ('director', 'curator') and p.status = 'active' and not exists (
      select 1 from auth.mfa_factors f where f.user_id = p.user_id and f.status = 'verified')), '0'),
  (8, 'Track leads without a second factor',
   (select count(*)::text from public.profiles p
    where p.role = 'track_lead' and p.status = 'active' and not exists (
      select 1 from auth.mfa_factors f where f.user_id = p.user_id and f.status = 'verified')), '0'),
  (9, 'Passwords stored below bcrypt cost 10',
   (select count(*)::text from auth.users where encrypted_password like '$2%' and substr(encrypted_password, 5, 2)::int < 10), '0 (each goes away with a password change)'),
  (10, 'Logins without a profile',
   (select count(*)::text from auth.users u where not exists (select 1 from public.profiles p where p.user_id = u.id)), '0'),
  (11, 'Join codes active with no end date',
   (select count(*)::text from public.join_codes where active and expires_at is null), '0'),
  (12, 'Staff invites waiting',
   (select count(*)::text from public.staff_invites), '0 when nobody is being added'),
  (13, 'Storage used, MB (free plan: 1024)',
   (select coalesce(round(sum((metadata ->> 'size')::bigint) / 1048576.0), 0)::text from storage.objects), 'well below 900'),
  (14, 'Database size, MB (free plan: 500)',
   (select round(pg_database_size(current_database()) / 1048576.0)::text), 'well below 500'),
  (15, 'Push subscriptions outside the browsers'' services',
   (select count(*)::text from public.push_subscriptions where not public.is_push_endpoint(endpoint)), '0')
) as checks (n, what, value, want)
order by n;
