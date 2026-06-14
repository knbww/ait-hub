# n8n workflows

Import each via the n8n editor (**⋯ → Import from File**). All external calls use env vars
(see `supabase/functions/README.md` for the full list), so no credential wiring is needed.

| File | Trigger | Does |
|---|---|---|
| `onboarding.json` | Webhook `POST /webhook/onboarding` (from the relay, on application INSERT) | HMAC verify → Groq pre-screen → write `ai_score`/`status` → Telegram admin alert (deep-links to `/admin`) |
| `onboarding-accept.json` | Webhook `POST /webhook/onboarding-accept` (from the relay, when admin sets `status='accepted'`) | HMAC verify → Admin-API create user → magic-link invite (`redirect_to` = live app) → **DM the applicant** if Telegram-connected, else Resend / admin Telegram → mark `provisioned` |
| `telegram-connect.json` | **Telegram Trigger** (bot receives `/start <token>`) | Parse the deep-link token → write `telegram_chat_id` onto the matching application → confirm to the user |
| `error-handler.json` | Error Trigger (any failed workflow) | Shape error → insert into `automation_errors` → Telegram alert |

## Wire the error handler (one step, after import)

The Error Trigger only fires for workflows that name it. For each workflow (start with
`onboarding`): **Settings → Error Workflow → "AIT Hub — Error handler (dead-letter)"**. Now any
failure (bad signature, Groq error, Supabase write failure) lands in `automation_errors` and pings
Telegram instead of vanishing into the execution log.

Then **activate** the workflows (toggle, top-right).

## Telegram onboarding (bot DMs the applicant directly)

So the bot can message applicants (not just relay links to an admin), wire up `telegram-connect`:

1. **Create a bot** via [@BotFather](https://t.me/BotFather) → set `TELEGRAM_BOT_TOKEN` in `infra/n8n/.env`.
2. **Frontend:** set `VITE_TELEGRAM_BOT=<botusername>` (no `@`) in `.env.local` and rebuild — the
   Apply modal then shows a "Connect Telegram" deep link (`t.me/<bot>?start=<token>`).
3. **DB:** push the `application_telegram` migration (`npm run db:push`) — adds `telegram_token` /
   `telegram_chat_id` to `applications`.
4. **Import `telegram-connect.json`**, open the **Telegram Trigger** node, and attach your bot
   credential (the trigger registers the bot webhook on activate — one webhook per bot). Activate it.
5. (Optional) set `APP_URL=https://ait-hub.pages.dev` in `.env` so invite links / the admin deep
   link use your domain without editing the workflow JSON.

Flow: apply → tap **Connect Telegram** → press Start → the bot stores your `chat_id` → on accept,
the invite link is **DM'd straight to the applicant**. A bot can't message a user first (Telegram
anti-spam), which is exactly why the deep-link + Start step exists.
