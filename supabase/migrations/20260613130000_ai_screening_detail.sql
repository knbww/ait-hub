-- Persist the AI screening verdict so the admin Automations panel can show *why* an applicant
-- scored as it did (recommended role, reasons, flags), not just the number. Written by the
-- onboarding workflow's service-role PATCH; admin-read via the existing applications RLS.

alter table public.applications add column if not exists ai_screening jsonb;
