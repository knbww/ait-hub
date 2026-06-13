-- Onboarding automation trigger (roadmap Pillar 2, workflow ①).
--
-- A new application is anonymous (the "anyone can apply" insert policy — no user JWT), so the
-- onboarding workflow is fired server-side from the row itself rather than from the browser.
-- On INSERT we POST the row to the `trigger-workflow` Edge Function, which signs it and forwards
-- to n8n (Groq pre-screen -> update ai_score/status -> Telegram admin alert -> provisioning).
--
-- Best-effort by design: the row is the source of truth. If the Edge Function / n8n is down (home
-- box asleep, tunnel offline), the POST is fire-and-forget via pg_net and any error is swallowed,
-- so the application is never lost and admins can still triage by hand.
--
-- ── One-time manual setup (run once in the SQL editor; NOT committed, since the key is a secret):
--     select vault.create_secret(
--       'https://<project-ref>.supabase.co/functions/v1', 'edge_function_base');
--     select vault.create_secret('<value of TRIGGER_INTERNAL_KEY>', 'trigger_internal_key');
--   The same TRIGGER_INTERNAL_KEY must be set on the Edge Function:
--     supabase secrets set TRIGGER_INTERNAL_KEY=<value>

create extension if not exists pg_net;

create or replace function public.notify_application_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_key  text;
begin
  -- Only screen fresh, unprocessed applications.
  if new.status is distinct from 'pending' then
    return new;
  end if;

  begin
    select decrypted_secret into v_base
      from vault.decrypted_secrets where name = 'edge_function_base';
    select decrypted_secret into v_key
      from vault.decrypted_secrets where name = 'trigger_internal_key';

    if v_base is null or v_key is null then
      raise warning 'notify_application_created: vault secrets missing; skipping webhook';
      return new;
    end if;

    perform net.http_post(
      url     := v_base || '/trigger-workflow',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-internal-key', v_key
      ),
      body    := jsonb_build_object('workflow', 'onboarding', 'data', row_to_json(new)),
      timeout_milliseconds := 5000
    );
  exception
    when others then
      -- Never let automation failure block the insert.
      raise warning 'notify_application_created webhook failed: %', sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists trg_notify_application_created on public.applications;
create trigger trg_notify_application_created
  after insert on public.applications
  for each row execute function public.notify_application_created();
