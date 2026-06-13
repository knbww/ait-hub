-- Dead-letter table for n8n automation failures (roadmap Pillar 1f — observability).
--
-- n8n's Error-Trigger workflow writes a row here (via the service role, which bypasses RLS)
-- whenever any workflow execution fails; admins read it. `correlation_id` ties a failure back
-- to the relay log / Sentry event when the failed workflow carried one.

create table public.automation_errors (
  id             uuid primary key default gen_random_uuid(),
  workflow       text,
  execution_id   text,
  last_node      text,
  correlation_id text,
  message        text,
  detail         jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now()
);
create index on public.automation_errors (created_at desc);

alter table public.automation_errors enable row level security;

-- Admin-read only. Writes come from n8n via the service role (bypasses RLS) — no insert policy.
create policy "admin read automation_errors" on public.automation_errors for select
  using (public.is_admin());
