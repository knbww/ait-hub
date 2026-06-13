# Supabase Edge Functions

The trusted relay between the browser/DB and self-hosted n8n. The browser never holds the
n8n webhook secret — it calls `trigger-workflow`, which authenticates the caller, HMAC-signs
the payload, and forwards it to the matching n8n webhook.

```
React (member JWT) ─┐
                    ├─▶ trigger-workflow (verify caller → HMAC sign) ─▶ n8n webhook (verify HMAC + timestamp)
applications INSERT ┘   (DB webhook, x-internal-key)
```

## Functions

| Function | Caller | Auth |
|---|---|---|
| `trigger-workflow` | `applications` INSERT trigger (onboarding) | `x-internal-key` header |
| `trigger-workflow` | logged-in member (future in-app flows) | Supabase JWT (`Authorization: Bearer`) |
| `ai-chat` | logged-in member (AIT Copilot widget) | Supabase JWT (`Authorization: Bearer`) |

**`ai-chat`** streams a Groq completion (SSE) back to the browser, grounded in live club data
(active season + course catalogue) plus a curated knowledge base. The `GROQ_API_KEY` stays
server-side; the React widget (`src/components/AiAssistant.tsx`) only ever talks to this function.

Add a new workflow by appending a row to the `WORKFLOWS` allowlist in `trigger-workflow/index.ts`.

## Secrets (set on the Edge Function — never in the client bundle)

```bash
supabase secrets set \
  N8N_WEBHOOK_BASE=https://n8n.yourdomain.com/webhook \
  N8N_WEBHOOK_SECRET=<openssl rand -hex 32; SAME value as n8n's N8N_WEBHOOK_SECRET> \
  TRIGGER_INTERNAL_KEY=<openssl rand -hex 32> \
  GROQ_API_KEY=<your Groq key> \
  GROQ_MODEL=llama-3.3-70b-versatile   # optional; confirm a current id in the Groq console
# SUPABASE_URL and SUPABASE_ANON_KEY are injected automatically.
```

## Deploy

```bash
supabase functions deploy trigger-workflow
supabase functions deploy ai-chat
```

## One-time DB wiring (for the onboarding trigger)

The `application_screening_webhook` migration reads two Vault secrets. Create them once in the
SQL editor (kept out of git because `trigger_internal_key` is a secret):

```sql
select vault.create_secret('https://<project-ref>.supabase.co/functions/v1', 'edge_function_base');
select vault.create_secret('<same value as TRIGGER_INTERNAL_KEY>', 'trigger_internal_key');
```

Then push the migration: `supabase db push`.

## n8n side (env vars on the n8n container — see `infra/n8n/.env`)

Import `infra/n8n/workflows/onboarding.json`, then set these so the workflow runs without
hand-wiring credentials:

| Env var | Used by |
|---|---|
| `N8N_WEBHOOK_SECRET` | HMAC verify (must equal the Edge Function's) |
| `GROQ_API_KEY`, `GROQ_MODEL` (optional) | Groq pre-screen (`GROQ_MODEL` defaults to `llama-3.3-70b-versatile` — confirm a current id in the Groq console) |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | write `ai_score`/`status` back + provision via the Admin API |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID` | admin alert (create a bot via @BotFather) |
| `RESEND_API_KEY`, `RESEND_FROM` (optional) | welcome email on accept. **Until a domain is verified, leave `RESEND_API_KEY` unset** — the accept workflow falls back to relaying the invite link via Telegram |

The relay handles two workflows: `onboarding` (screening, fired on application INSERT) and
`onboarding-accept` (provisioning, fired when an admin sets `status='accepted'`). Both are in the
`WORKFLOWS` allowlist in `trigger-workflow/index.ts` and import from `infra/n8n/workflows/`.

The Verify-signature Code node uses `require('crypto')`, so the n8n container needs
`NODE_FUNCTION_ALLOW_BUILTIN=crypto` and env access in nodes (`N8N_BLOCK_ENV_ACCESS_IN_NODE=false`).
Both are set in `infra/n8n/docker-compose.yml`. (n8n's Code node runs in a `vm` sandbox with **no**
global `crypto`, so `crypto.subtle` is unavailable — use the Node builtin.) The credential store is
the more rotatable alternative to env vars; env keeps the scaffold importable with zero setup.

## Local dev

```bash
supabase functions serve trigger-workflow --env-file ./supabase/functions/.env.local
```

## Known scaffold caveat — HMAC over re-serialized body

The Edge Function signs `${timestamp}.${JSON.stringify(payload)}` and the n8n node re-stringifies
the parsed body. JSON round-trips preserve key order for our payload, so it matches — but to be
bulletproof against exotic payloads, enable **Raw Body** on the Webhook node and verify against the
unparsed bytes. Fine as-is for the application payload (uuid/email/text).
