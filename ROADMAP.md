# AIT Hub → Production Roadmap

Architecture decisions locked in for this roadmap:

- **Database / backend:** Supabase (Postgres + Auth + RLS + Storage + Edge Functions + pgvector + Realtime)
- **Automation:** self-hosted n8n (Docker Compose, queue mode) on a VPS
- **Auth model:** multi-role community (`member`, `mentor`, `admin`)
- **Phase 1 priority:** ship production infrastructure first, then layer automation and AI

---

## 0. Baseline (where we are today)

AIT Hub is currently a high-fidelity **design prototype**, not yet an application:

- One ~830-line component (`src/App.jsx`) renders ten dashboard cards from hardcoded arrays.
- No data layer, auth, backend, persistence, routing, types, tests, or version control.
- The mock arrays (`profiles`, `proofOfWork`, `leaderboardData`, `researchPapers`, `skillNodes`,
  `deadlines`, `alumni`, `cardsConfig`) already imply the domain model — they map almost 1:1 to a
  Supabase schema, which is what makes Phase 1 concrete.

---

## 1. Production-Ready Architecture

### 1a. Technical debt to clear (from `src/App.jsx`)

| Issue | Location | Fix |
|---|---|---|
| Entire app is one component | `App.jsx` (830 lines) | Decompose into card components + a registry; one file per card |
| Dynamic Tailwind class that doesn't compile | `bg-${badge.color}` (~L347) | Tailwind JIT can't see runtime-built names — badges render unstyled. Use a static class |
| `variants` prop on a plain `<div>` | Resources tab (~L807) | Invalid prop → React warning; make it `motion.div` or drop it |
| Missing `key`s in `.map()` | research/network/resources tabs | Add stable keys |
| `Math.random()` in render | heatmap (~L480) | Re-randomizes every render; compute once (`useMemo`) or use real data |
| Global `zoom: 80%` hack | root wrapper (~L512) | Breaks layout math + a11y; replace with proper responsive sizing (deferred — see Phase 0 note) |
| No env, types, router, state lib | project-wide | Addressed below |
| Mixed Russian/English comments | throughout | Standardize to English |

### 1b. Target architecture

```
                ┌─────────────────────────────────────────────┐
   Browser ───▶ │  React SPA (Vite, TS)                        │
                │  React Router · TanStack Query · Zustand     │
                └───────────┬─────────────────────┬───────────┘
                            │ supabase-js          │ fetch (authed)
                            ▼                       ▼
                ┌──────────────────────┐   ┌────────────────────┐
                │  Supabase (managed)  │   │ Supabase Edge Fn   │
                │  Postgres + RLS      │◀──│ (JWT verify, then  │
                │  Auth · Storage      │   │  HMAC-sign + relay)│
                │  pgvector · Realtime │   └─────────┬──────────┘
                └──────────┬───────────┘             │ signed webhook
                           ▲                          ▼
                           │ service-role writes  ┌───────────────────────┐
                           └──────────────────────│  n8n (self-hosted VPS) │
                                                  │  queue mode + Redis    │
                                                  │  + own Postgres + Caddy│
                                                  └───────────┬───────────┘
                                                              ▼
                                              Claude API · GitHub · email · Discord
```

**Frontend stack changes:** TypeScript, React Router (route-per-tab, code-split), TanStack Query
(all server state), Zustand (UI state — dev mode, dashboard layout), `@supabase/supabase-js`.
Extract the repeated "glass card" Tailwind into one `<GlassCard>` component. Persist `cardsConfig`
(currently `useState`) to a `dashboard_layouts` table per user.

**Backend = Supabase.** Collapses four services into one and pairs cleanly with n8n's native
Postgres/Supabase nodes; RLS gives the multi-role security model without a custom auth backend.

### 1c. Data model (mock arrays → tables)

```
profiles        (id→auth.users, full_name, role[member|mentor|admin], avatar_url, bio, xp)
courses         · enrollments (profile_id, course_id, progress)
proof_of_work   (profile_id, date, task, status)
projects        (owner_id, title, progress)
skills          (profile_id, skill, level, category)
research_papers (author_id, title, tags[], citations, content, embedding vector(1024))
deadlines       (title, due_date, scope)
xp_events       (profile_id, source, delta, created_at)   → leaderboard = view/matview
activity        (profile_id, day, count)                  → heatmap
applications    (email, payload jsonb, ai_score, status)  → Apply Now funnel
dashboard_layouts (profile_id, layout jsonb)
```

### 1d. Multi-role auth + RLS

Roles live in `profiles.role`, surfaced as a JWT custom claim via an auth hook so policies and n8n
can read it. Baseline policies:

```sql
-- Members read all profiles, write only their own
create policy "read_profiles" on profiles for select using (true);
create policy "update_own"   on profiles for update using (auth.uid() = id);

-- Admin-only writes via the custom claim
create policy "admin_writes" on applications for all
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
```

Mentors get a middle tier (e.g. manage mentorship bookings). The **service-role key** (Edge Functions
/ n8n only, never the browser) bypasses RLS for trusted automation writes.

### 1e. Deployment strategy

- **Frontend:** static build → Cloudflare Pages (or Vercel/Netlify). Global CDN, preview deploys per
  branch, instant HTTPS. Envs: `dev` (local), `staging`, `prod`.
- **Supabase:** managed cloud, one project per env. Self-host later only if data-residency demands it.
- **n8n:** self-hosted Docker Compose on a small VPS (~€5–10/mo). **Queue mode** from day one
  (`main` + `worker` + Redis queue + Postgres state) behind **Caddy** for automatic TLS.

```yaml
# docker-compose sketch (VPS)
services:
  caddy:       # TLS + reverse proxy + rate limiting → n8n.aithub.example
  n8n:         # main process, EXECUTIONS_MODE=queue
  n8n-worker:
  redis:       # Bull queue
  postgres:    # n8n state (NOT the app DB — that's Supabase)
```

### 1f. Environment, error handling, logging

- **Env:** only `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` reach the browser (public by design).
  Never ship the service-role key, `ANTHROPIC_API_KEY`, or webhook secrets to the client — those live
  in Edge Function secrets and the n8n credential store. Commit a `.env.example`; `dist/` must contain
  zero secrets.
- **Error handling:** React `ErrorBoundary` per route + a global TanStack Query `onError` → toast.
  Edge Functions return typed error envelopes. n8n uses an Error Trigger workflow that dead-letters
  failures to Discord + an `automation_errors` table.
- **Logging:** Sentry (frontend); Supabase logs / Logflare (DB + Edge); n8n execution logs. Pass a
  `correlation_id` from React → Edge Fn → n8n → Supabase for end-to-end tracing.

---

## 2. n8n Automation Integration

### 2a. Where n8n replaces fragile custom code

Transactional email (welcome/reminders), scheduled jobs (deadline reminders, leaderboard recompute,
GitHub/LeetCode sync), third-party fan-out (Discord/Slack/Telegram, calendar booking for the
"Book 15-min Meeting"), and application screening. Config-not-code, observable, retryable.

### 2b. Three high-impact workflows

1. **User Onboarding / Applications** (the "Apply Now" CTA)
   `React form → Edge Fn → signed webhook → n8n`: validate → AI pre-screen (Haiku, structured score)
   → insert `applications` row → notify admins on Discord. On accept: create auth user + `profiles`
   row + role via the Supabase Admin API, then send a welcome email.
   **Done:** a submitted form provisions a real, role-assigned account and a welcome email — zero
   manual steps.

2. **AI Content Processing** (Proof-of-Work / research submissions)
   `Submit → Edge Fn → signed webhook → n8n`: Claude summarizes, extracts skills, tags, and scores
   quality (structured output) → write metadata back to Supabase → award XP → refresh skills.
   **Done:** a new submission auto-produces tags + summary + an XP award visible on the dashboard.

3. **Engagement / XP & Reminders** (cron, no webhook)
   Scheduled workflow pulls GitHub commits/PRs + LeetCode solves → computes XP deltas → updates
   `xp_events` → refreshes leaderboard matview; a second cron sends deadline reminders.
   **Done:** leaderboard + heatmap reflect real external activity daily with no manual entry.

### 2c. Triggering from React (secure pattern)

Do **not** call raw n8n webhooks from the browser with a secret in JS. Instead:

```
React (Supabase JWT) ──▶ Supabase Edge Function
                          • verifies the caller's JWT (identity + role)
                          • adds HMAC signature + timestamp + correlation_id
                          • forwards to n8n over HTTPS
                                   │
                                   ▼
                          n8n webhook (verifies HMAC, checks timestamp)
```

The browser only ever talks to your own authenticated Edge Function; the webhook URL and shared
secret never leave the server. (Fallback: n8n verifies the Supabase JWT directly against the JWKS —
simpler, but exposes the webhook URL and gives less control over rate limiting.)

### 2d. Production-safe webhook hardening

HTTPS only (Caddy) · HMAC signature over body + timestamp (replay protection) · short timestamp
window (~5 min) · idempotency key (so retries don't double-award XP) · payload schema validation in an
IF/Code guard · rate limiting at Caddy/Cloudflare · secrets in the n8n credential store with rotation ·
respond 200 fast, process async.

---

## 3. AI & Agentic Workflows

### 3a. Entry points

1. Application pre-screening — summarize + flag.
2. PoW & research analysis — summarize, tag, extract skills, quality score → feeds Skill Matrix + Research Repository.
3. RAG support agent — "find papers on NLP for Kazakh," "how do I submit Proof of Work."
4. Mentor matching — embeddings over member skills ↔ alumni expertise.
5. Profile / PoW narrative generation.

### 3b. Orchestrate in n8n vs. call Claude directly — use both

| Use n8n to orchestrate | Call Claude directly (via Edge Function) |
|---|---|
| Async / batch / scheduled / multi-tool flows | Low-latency interactive features |
| Content processing, screening, RAG **ingestion** | The RAG support **chat** (needs token streaming) |
| Retries, observability, prompt edits without redeploy, key stays server-side | n8n adds latency and is awkward for streaming |

**RAG concretely:** embeddings in Supabase **pgvector**. Ingestion in n8n (chunk → embed → upsert).
Query in an Edge Function: retrieve top-k → call Claude with context → **stream** a cited answer to the
browser. `ANTHROPIC_API_KEY` lives only in the Edge Function / n8n credentials — never in the bundle.

### 3c. Model selection (current Claude API)

| Task | Model | Price (in/out per MTok) | Why |
|---|---|---|---|
| Tagging, classification, cheap pre-screen | Haiku 4.5 (`claude-haiku-4-5`) | $1 / $5 | Fast, cheap, high-volume |
| Summaries, balanced analysis, RAG answers | Sonnet 4.6 (`claude-sonnet-4-6`) | $3 / $15 | Best speed/quality balance |
| High-stakes screening, hard analysis | Opus 4.8 (`claude-opus-4-8`) | $5 / $25 | Most capable; use adaptive thinking |

Use **structured outputs** (`output_config.format` + JSON schema) for tags/scores; enable **prompt
caching** for the stable system prompt and reused RAG context (~0.1× read cost); `thinking:
{type:"adaptive"}` on Opus 4.8 for screening/analysis; **stream** long generations; always parse
JSON output with a real parser.

---

## 4. Actionable Roadmap (phased, with Done criteria)

### Phase 0 — Foundation hygiene (½–1 week)
- `git init`, push to GitHub, branch protection, CI (lint + typecheck + build).
- Migrate to TypeScript; add React Router; decompose `App.jsx` into card components + registry.
- Fix the debt table in §1a (dynamic classes, missing keys, `Math.random` in render, invalid `variants` prop).
- **Note:** the `zoom: 80%` fix is deferred — it changes visual scale and "renders identically" is a
  Phase 0 acceptance bar, so it's flagged with a `TODO` and handled as a design task later.
- **Done:** repo on GitHub; CI green on PRs; app renders identically from decomposed, typed components; no console warnings.

### Phase 1 — Production infrastructure ★ priority (2–4 weeks)
- Stand up Supabase (staging + prod); implement the §1c schema as migrations; enable RLS with §1d policies.
- Wire `supabase-js` + TanStack Query; replace every hardcoded array with live queries; persist `dashboard_layouts`.
- Build Supabase Auth (email/OAuth) + login/profile UI; gate routes by role.
- Deploy frontend to Cloudflare Pages (staging + prod); stand up the n8n Docker stack behind Caddy with TLS.
- Env management, Sentry, error boundaries, structured logging + correlation IDs.
- **Done:** a real user signs up, logs in, sees their own data from Postgres, edits their dashboard,
  and it persists; staging + prod deploy from `git push`; no secrets in the client bundle; errors in Sentry.

### Phase 2 — n8n automation (1–2 weeks)
- Build the Edge Function relay (JWT verify → HMAC sign → forward) and §2d hardening.
- Ship workflows ① (onboarding/applications) and ③ (XP/reminders cron); add the Error Trigger dead-letter workflow.
- **Done:** an application submitted from the UI provisions a role-assigned account + welcome email
  with no manual step; the daily cron updates the leaderboard from real GitHub activity; webhooks
  reject unsigned/replayed/expired requests.

### Phase 3 — AI & agentic workflows (2–3 weeks)
- Ship workflow ② (Claude content processing → tags/summary/XP, structured output).
- Build the RAG pipeline: pgvector schema + n8n ingestion + streaming Edge Function chat; surface a support widget.
- (Stretch) embeddings-based mentor matching.
- **Done:** submitting a PoW/paper auto-generates tags + summary + XP within seconds; a member can ask
  the support agent a question and get a streamed, cited answer drawn from the research repo.

---

## Operational notes

- **Activity source:** GitHub is assumed for the XP/heatmap workflows (matches "Project Pulse" /
  "Wall of Proof"). Confirm before building Phase 2 ③.
- **Email deliverability:** a verified sending domain (Resend/Postmark via n8n) has DNS lead time —
  start it early.
