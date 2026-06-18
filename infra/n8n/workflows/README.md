# n8n workflows

Import each via the n8n editor (**⋯ → Import from File**). All external calls use env vars
(see `supabase/functions/README.md` for the full list), so no credential wiring is needed.

| File | Trigger | Does |
|---|---|---|
| `onboarding.json` | Webhook `POST /webhook/onboarding` (from the relay, on application INSERT) | HMAC verify → Groq pre-screen → write `ai_score`/`status` → admin alert **via the [tg-relay Worker](../../tg-relay/) `/send`** |
| `onboarding-accept.json` | Webhook `POST /webhook/onboarding-accept` (from the relay, when admin sets `status='accepted'`) | HMAC verify → Admin-API create user → magic-link invite (`redirect_to` = live app) → **DM the applicant** (or admin fallback) **via the tg-relay Worker `/send`** → mark `provisioned` |
| `error-handler.json` | Error Trigger (any failed workflow) | Shape error → insert into `automation_errors` → Telegram alert |

> **Telegram goes through the [tg-relay Cloudflare Worker](../../tg-relay/), not `api.telegram.org` directly.**
> The home network throttles Telegram; the Worker (on Cloudflare) doesn't. It's also the bot's
> webhook now, so the old `telegram-connect` n8n workflow is **replaced** — deactivate/delete it.

## Wire the error handler (one step, after import)

The Error Trigger only fires for workflows that name it. For each workflow (start with
`onboarding`): **Settings → Error Workflow → "AIT Hub — Error handler (dead-letter)"**. Now any
failure (bad signature, Groq error, Supabase write failure) lands in `automation_errors` and pings
Telegram instead of vanishing into the execution log.

Then **activate** the workflows (toggle, top-right).

## Telegram onboarding (bot DMs the applicant directly)

The bot can message applicants directly. **All Telegram traffic goes through the
[tg-relay Cloudflare Worker](../../tg-relay/)** — the home network throttles `api.telegram.org`,
the Worker (on Cloudflare) doesn't, and it's also the bot's webhook (stable URL, survives restarts).

1. **Create a bot** via [@BotFather](https://t.me/BotFather) → set `TELEGRAM_BOT_TOKEN` in `infra/n8n/.env`.
2. **Frontend:** set `VITE_TELEGRAM_BOT=<botusername>` (no `@`) in `.env.local` and rebuild — the
   Apply modal then shows a "Connect Telegram" deep link (`t.me/<bot>?start=<token>`).
3. **DB:** push the `application_telegram` migration (`npm run db:push`) — adds `telegram_token` /
   `telegram_chat_id` to `applications`.
4. **Deploy the Worker** — see [`infra/tg-relay/`](../../tg-relay/): `npm run tg:deploy`, set its
   secrets, then `curl https://tg-relay.knbww.workers.dev/setup` once to bind the bot webhook.
   The Worker handles `/start` and exposes `/send` for n8n. (This replaces the old
   `telegram-connect` n8n workflow — deactivate/delete that one.)
5. **n8n:** `onboarding` / `onboarding-accept` POST to the Worker's `/send`; re-import them so the
   send URL is up to date.
6. (Optional) set `APP_URL=https://ait-hub.pages.dev` in `.env` so invite links / the admin deep
   link use your domain without editing the workflow JSON.

Flow: apply → tap **Connect Telegram** → press Start → Telegram → Worker stores your `chat_id` →
on accept, the invite link is **DM'd straight to the applicant** (n8n → Worker → Telegram). A bot
can't message a user first (Telegram anti-spam), which is why the deep-link + Start step exists.
