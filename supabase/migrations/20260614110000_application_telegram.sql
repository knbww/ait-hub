-- Telegram onboarding — let the bot DM the applicant directly (no admin forwarding).
--
-- A bot can't message a user it has never met (Telegram anti-spam): it needs the user's
-- numeric chat_id, which only arrives after the user presses Start. So:
--   1. the applicant's browser generates `telegram_token` and embeds it in a deep link
--      (t.me/<bot>?start=<token>) shown right after applying;
--   2. they tap it and press Start;
--   3. the n8n `telegram-connect` workflow looks the application up by `telegram_token`
--      and stores their `telegram_chat_id` (service role);
--   4. on accept, the `onboarding-accept` workflow DMs the invite link to that chat_id.
--
-- The token is set by the (anon) "anyone can apply" INSERT; chat_id is written only by the
-- bot via the service role. No new RLS policy is needed.

alter table public.applications
  add column if not exists telegram_token   uuid,
  add column if not exists telegram_chat_id bigint;

-- The bot looks an application up by this token on /start.
create index if not exists applications_telegram_token_idx
  on public.applications (telegram_token);
