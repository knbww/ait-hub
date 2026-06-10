# Self-hosted n8n (AIT Hub automation)

Production n8n in **queue mode** (main + worker, Redis queue, Postgres state) behind
**Caddy** for automatic HTTPS. This is the orchestration hub for bucket 3 (GitHub
activity sync) and bucket 4 (application screening, emails, provisioning).

```
Internet ──TLS──▶ Caddy ──▶ n8n (main, editor + webhooks)
                              │  ├── Redis (Bull queue)
                              │  └── Postgres (n8n state)
                              └── n8n-worker (executes jobs)
        Supabase Edge Function ──signed webhook──▶ n8n
        n8n ──service role──▶ Supabase (writes activity, profiles, etc.)
```

## 1. Provision

1. **VPS:** Hetzner CX22 / DigitalOcean / etc. — 2 vCPU, 4 GB RAM, Ubuntu 24.04. Open ports 80 + 443 only.
2. **Domain:** point an A record (e.g. `n8n.yourdomain.com`) at the VPS IP. Caddy needs this to issue a TLS cert.
3. **Install Docker:**
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```

## 2. Configure & launch

```bash
git clone https://github.com/knbww/ait-hub.git
cd ait-hub/infra/n8n
cp .env.example .env
# generate the two secrets:
echo "N8N_ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env
echo "N8N_WEBHOOK_SECRET=$(openssl rand -hex 32)" >> .env
# then edit .env: set N8N_HOST, POSTGRES_PASSWORD, GENERIC_TIMEZONE

docker compose up -d
docker compose logs -f caddy   # watch the cert get issued
```

Open `https://n8n.yourdomain.com`, create the **owner account** (this is the only
admin login — n8n has no public signup). Done — n8n is live.

## 3. Security model

- **Only 80/443 exposed.** Postgres/Redis/n8n are on the internal Docker network.
- **HTTPS everywhere** via Caddy (auto-renewing Let's Encrypt).
- **Webhooks are HMAC-verified.** The browser never calls n8n directly. Flow:
  `React (Supabase JWT) → Supabase Edge Function → HMAC-signed POST → n8n`.
  Each workflow's first node verifies the `x-signature` (HMAC-SHA256 of body, keyed
  with `N8N_WEBHOOK_SECRET`) and rejects stale `x-timestamp`s (replay protection).
- **Secrets live in n8n's credential store** (encrypted with `N8N_ENCRYPTION_KEY`):
  the Supabase **service-role** key, a **GitHub token**, the **Anthropic API key**,
  and the **Resend** (email) key. None of these ever touch the client.
- **Back up** `N8N_ENCRYPTION_KEY` + the `n8n_db` volume; losing the key orphans creds.

## 4. Workflows (built in the n8n UI once the instance is up)

> These are the next step after the stack is running — they're built/imported in the
> editor. Each is triggered either by a signed webhook (from the Edge Function) or a
> schedule, and writes back to Supabase with the service-role key.

1. **GitHub activity sync** (bucket 3) — Schedule (cron, hourly) → GitHub API (commits
   / events for the configured users) → upsert into Supabase `activity` (heatmap) and
   a `commit_activity` table (Project Pulse).
2. **Application screening** (bucket 4) — Webhook `/onboarding` → Claude (Haiku) scores
   the application → update `applications.ai_score`/`status` → notify admins (Discord)
   → on accept: create the auth user + profile + send a welcome email (Resend).
3. **Booking notification** (bucket 4) — Webhook `/booking` → email the mentor + the
   requester via Resend; mark the booking `notified`.

## 5. What I'll wire next (once you share the live `N8N_HOST`)

- A Supabase Edge Function (`trigger-workflow`) that verifies the Supabase JWT, signs
  the payload, and forwards to the n8n webhook.
- Frontend: the Apply/Book modals call that Edge Function (so submissions also kick off
  the workflows, on top of the direct DB insert they already do).
- The three workflows above, plus the `commit_activity` migration for Project Pulse.
