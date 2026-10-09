-- Launch prep (October 2026), step 1: remove what the club no longer uses.
--
-- The June build modelled a different club: AI-only "seasons", an automatic AIP price list,
-- rank levels, referrals, a help board, challenges with point prizes, an n8n + Groq onboarding
-- pipeline and prototype display tables. None of it matches how AIT Club works now, and the
-- n8n / AI pieces sent minors' data outside the club. Everything below is dropped; the
-- replacement (tracks, year programme, AIT Points journal, calendar, track ratings) is built by
-- the migrations that follow.
--
-- Data: rows in these tables are demo / test data and the old intake applications. Real
-- accounts (auth.users and their profiles) and dashboard layouts are kept.

-- ── n8n relay, AI screening, applications ───────────────────────────────────
drop trigger if exists trg_notify_application_created on public.applications;
drop trigger if exists trg_notify_application_accepted on public.applications;
drop function if exists public.notify_application_created();
drop function if exists public.notify_application_accepted();
drop table if exists public.automation_errors;
drop table if exists public.applications;
drop table if exists public.mentorship_bookings;

drop trigger if exists trg_guard_profile_ai on public.profiles;
drop function if exists public.guard_profile_ai_columns();

-- The relay's shared secrets are useless without the triggers above.
do $$
begin
  delete from vault.secrets where name in ('edge_function_base', 'trigger_internal_key');
exception
  when others then
    raise notice 'vault cleanup skipped: %', sqlerrm;
end;
$$;

-- ── referrals, help board, challenges ───────────────────────────────────────
drop view if exists public.referral_funnel;
drop function if exists public.claim_referral(text);
drop function if exists public.maybe_reward_referral(uuid);

drop function if exists public.post_help(text, text);
drop function if exists public.claim_help(uuid);
drop function if exists public.confirm_help(uuid);
drop table if exists public.help_requests;

drop function if exists public.enter_challenge(uuid, text, text);
drop function if exists public.judge_entry(uuid, int, int, int);
drop table if exists public.challenge_entries;
drop table if exists public.challenges;

-- ── seasons and the old points ledger ───────────────────────────────────────
drop view if exists public.aip_journal;
drop view if exists public.leaderboard;
drop function if exists public.aip_leaderboard(uuid, timestamptz);
drop function if exists public.award_aip(uuid, text, int, text);
drop function if exists public.check_in(uuid, text);
drop function if exists public.open_attendance(uuid, text, int);
drop function if exists public.review_submission(uuid, text, boolean);
drop function if exists public.submit_assignment(uuid, text, text);
drop table if exists public.week_meetings;
drop table if exists public.attendance;
drop table if exists public.submissions;
drop table if exists public.xp_events;
drop function if exists public.active_season_id();
drop table if exists public.season_weeks;
drop table if exists public.seasons;

-- ── teams (rebuilt with tracks and a five-person limit) ─────────────────────
drop function if exists public.create_team(text, text, text[]);
drop function if exists public.request_join_team(uuid, text, text);
drop function if exists public.respond_join_request(uuid, boolean);
drop table if exists public.team_requests;
drop table if exists public.team_members;
drop table if exists public.teams;

-- ── prototype display tables ────────────────────────────────────────────────
drop table if exists public.enrollments;
drop table if exists public.courses;
drop table if exists public.proof_of_work;
drop type if exists public.pow_status;
drop table if exists public.skills;
drop table if exists public.research_papers;
drop table if exists public.resources;
drop table if exists public.deadlines;
drop table if exists public.projects;
drop table if exists public.github_stats;
drop table if exists public.activity;

-- ── profile fields the club does not collect ────────────────────────────────
alter table public.profiles
  drop column if exists bio,
  drop column if exists title,
  drop column if exists university,
  drop column if exists grad_year,
  drop column if exists github_url,
  drop column if exists leetcode_url,
  drop column if exists linkedin_url,
  drop column if exists ai_profile_score,
  drop column if exists ai_profile_summary,
  drop column if exists ai_profile_at,
  drop column if exists referral_code,
  drop column if exists referred_by,
  drop column if exists referral_rewarded;

-- Demo / unclaimed profiles: the old seed rows and leftovers of deleted logins.
delete from public.profiles where user_id is null;
