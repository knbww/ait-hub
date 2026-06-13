-- Onboarding accept → provision (roadmap Pillar 2, workflow ① — second half).
--
-- When an admin moves an application to 'accepted', fire the `onboarding-accept` workflow:
-- it creates the auth user (Admin API), the profile is auto-provisioned by handle_new_user(),
-- a magic-link invite is generated, delivered (Resend if configured, else Telegram), and the
-- application is marked 'provisioned'.
--
-- Same best-effort contract as application_screening_webhook: failures never block the UPDATE.
-- Reuses the `edge_function_base` / `trigger_internal_key` Vault secrets created for screening.

create or replace function public.notify_application_accepted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_key  text;
begin
  -- Only fire on the transition into 'accepted'.
  if new.status is distinct from 'accepted' or old.status is not distinct from 'accepted' then
    return new;
  end if;

  begin
    select decrypted_secret into v_base
      from vault.decrypted_secrets where name = 'edge_function_base';
    select decrypted_secret into v_key
      from vault.decrypted_secrets where name = 'trigger_internal_key';
    if v_base is null or v_key is null then
      raise warning 'notify_application_accepted: vault secrets missing; skipping webhook';
      return new;
    end if;

    perform net.http_post(
      url     := v_base || '/trigger-workflow',
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-key', v_key),
      body    := jsonb_build_object('workflow', 'onboarding-accept', 'data', row_to_json(new)),
      timeout_milliseconds := 5000
    );
  exception
    when others then
      raise warning 'notify_application_accepted webhook failed: %', sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists trg_notify_application_accepted on public.applications;
create trigger trg_notify_application_accepted
  after update of status on public.applications
  for each row execute function public.notify_application_accepted();
