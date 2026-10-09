-- Local development only: `supabase db reset` / `supabase start` apply this after the
-- migrations. `supabase db push` never runs it, so nothing here reaches the club's database.
--
-- Accounts: sign up at /join with one of the codes below
--   select track_id, code from public.join_codes where active;
-- and make yourself director in the local SQL editor:
--   update public.profiles set role = 'director', track_id = null where full_name = '<your name>';

-- A schedule that starts this week, so the programme pages have a "current week".
insert into public.cohort_weeks (cohort_id, week_number, starts_on)
select public.default_cohort_id(), n, date_trunc('week', current_date)::date + (n - 1) * 7
from generate_series(1, 36) as n
on conflict do nothing;

-- One confirmed club-wide event so the calendar isn't empty while developing.
insert into public.events (type, title, track_id, starts_at, location, status)
values ('workshop', 'Локальный пример: воркшоп', null, now() + interval '3 days', 'Кабинет', 'confirmed');
