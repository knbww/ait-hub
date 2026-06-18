# tg-relay — Telegram via Cloudflare Worker

A tiny Cloudflare Worker that makes the AIT Hub Telegram bot work from a network that
**throttles `api.telegram.org`** (common with some ISPs). The n8n host can reach Cloudflare but
not Telegram directly; Cloudflare's edge reaches Telegram fine. So the Worker is both:

- **the bot's webhook** — a stable `*.workers.dev` URL that never rotates (unlike the quick tunnel),
  so it never needs re-wiring. Handles `/start <token>` → links the chat to the application.
- **the outbound relay** — n8n POSTs to `/send` instead of calling `api.telegram.org`. Every
  Telegram call happens from Cloudflare, independent of the home network.

```
Applicant ─/start─▶ Telegram ─▶ Worker /tg/webhook ─▶ Supabase (link chat) + reply
n8n ─POST /send─▶ Worker ─▶ Telegram                 (admin alerts, accept invite DM)
```

Live: **https://tg-relay.knbww.workers.dev**

## Routes

| Route | Purpose |
|---|---|
| `GET /health` | liveness |
| `GET /setup` | one-time: bind the bot webhook to this Worker (runs on Cloudflare → reaches Telegram) |
| `POST /tg/webhook` | incoming Telegram updates; verifies the secret-token header; handles `/start <token>` |
| `POST /send` | `{ chat_id, text, parse_mode?, disable_web_page_preview? }` — allowlisted to the admin chat + known applicants |

## Config

| Name | Where | Value |
|---|---|---|
| `SUPABASE_URL` | `wrangler.jsonc` var | project URL (public) |
| `TELEGRAM_BOT_TOKEN` | secret | from @BotFather |
| `SUPABASE_SERVICE_ROLE_KEY` | secret | service role (writes `telegram_chat_id`) |
| `ADMIN_CHAT_ID` | secret | the Council chat that receives screening alerts |
| `TG_WEBHOOK_SECRET` | secret | random; Telegram echoes it back as a header so only Telegram can post |

## Deploy / re-deploy

```bash
npm run tg:deploy          # from repo root  (== cd infra/tg-relay && wrangler deploy)

# set secrets once (values never printed):
cd infra/tg-relay
printf '%s' "$BOT_TOKEN"     | npx wrangler secret put TELEGRAM_BOT_TOKEN
printf '%s' "$SERVICE_ROLE"  | npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
printf '%s' "$ADMIN_CHAT_ID" | npx wrangler secret put ADMIN_CHAT_ID
printf '%s' "$(openssl rand -hex 16)" | npx wrangler secret put TG_WEBHOOK_SECRET

# bind the bot webhook (once, or after changing the bot):
curl https://tg-relay.knbww.workers.dev/setup
```

After this the Telegram side is stable: no `wire-tg`, no dependency on the home ISP, survives n8n
restarts. n8n's `onboarding` / `onboarding-accept` workflows POST to `/send`; the standalone
`telegram-connect` n8n workflow is **replaced by this Worker** (deactivate/delete it in n8n).
