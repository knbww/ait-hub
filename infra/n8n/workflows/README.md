# n8n workflows

Import each via the n8n editor (**⋯ → Import from File**). All external calls use env vars
(see `supabase/functions/README.md` for the full list), so no credential wiring is needed.

| File | Trigger | Does |
|---|---|---|
| `onboarding.json` | Webhook `POST /webhook/onboarding` (from the relay, on application INSERT) | HMAC verify → Groq pre-screen → write `ai_score`/`status` → Telegram admin alert |
| `onboarding-accept.json` | Webhook `POST /webhook/onboarding-accept` (from the relay, when admin sets `status='accepted'`) | HMAC verify → Admin-API create user → magic-link invite → Resend (if configured) else Telegram → mark `provisioned` |
| `error-handler.json` | Error Trigger (any failed workflow) | Shape error → insert into `automation_errors` → Telegram alert |

## Wire the error handler (one step, after import)

The Error Trigger only fires for workflows that name it. For each workflow (start with
`onboarding`): **Settings → Error Workflow → "AIT Hub — Error handler (dead-letter)"**. Now any
failure (bad signature, Groq error, Supabase write failure) lands in `automation_errors` and pings
Telegram instead of vanishing into the execution log.

Then **activate** both workflows (toggle, top-right).
