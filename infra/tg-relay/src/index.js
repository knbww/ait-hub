// tg-relay — Cloudflare Worker that makes the AIT Hub Telegram bot work from a network that
// throttles api.telegram.org (the n8n host can't reach Telegram, but it can reach Cloudflare,
// and Cloudflare's edge reaches Telegram fine). The Worker is BOTH:
//   • the bot's webhook  (stable *.workers.dev URL — never rotates like the quick tunnel)
//   • the outbound relay (n8n POSTs here instead of calling api.telegram.org directly)
//
// Routes:
//   GET  /health         → liveness
//   GET  /setup          → (one-time) bind the bot webhook to this Worker, from Cloudflare
//   POST /tg/webhook     → incoming Telegram updates; handles "/start <token>" → links chat
//   POST /send           → { chat_id, text, parse_mode?, disable_web_page_preview? } → sends
//
// Secrets (wrangler secret put): TELEGRAM_BOT_TOKEN, SUPABASE_SERVICE_ROLE_KEY,
//                                TG_WEBHOOK_SECRET, ADMIN_CHAT_ID
// Var (wrangler.jsonc):          SUPABASE_URL

const tgUrl = (env, method) => `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } })

async function tgSend(env, chat_id, text, extra = {}) {
  const res = await fetch(tgUrl(env, 'sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, text, disable_web_page_preview: true, ...extra }),
  })
  return res.json()
}

function sb(env, path, init = {}) {
  return fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  })
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const path = url.pathname

    if (path === '/health') return json({ ok: true })

    // One-time bind: point the bot's webhook at this Worker. Runs on Cloudflare, so it
    // reaches Telegram even when the home network can't. Open it once in a browser.
    if (path === '/setup') {
      const hook = `${url.origin}/tg/webhook`
      const res = await fetch(tgUrl(env, 'setWebhook'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: hook,
          secret_token: env.TG_WEBHOOK_SECRET,
          drop_pending_updates: true,
          allowed_updates: ['message'],
        }),
      })
      return json({ webhook: hook, setWebhook: await res.json() })
    }

    // Incoming Telegram updates (the bot's webhook).
    if (path === '/tg/webhook' && request.method === 'POST') {
      if (env.TG_WEBHOOK_SECRET &&
          request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== env.TG_WEBHOOK_SECRET) {
        return new Response('forbidden', { status: 403 })
      }
      const update = await request.json().catch(() => ({}))
      const msg = update.message
      if (msg && typeof msg.text === 'string') {
        const chatId = msg.chat.id
        const m = msg.text.match(/^\/start\s+(\S+)/)
        if (m) {
          const token = m[1]
          const res = await sb(env, `applications?telegram_token=eq.${encodeURIComponent(token)}`, {
            method: 'PATCH',
            headers: { Prefer: 'return=representation' },
            body: JSON.stringify({ telegram_chat_id: chatId }),
          })
          const rows = await res.json().catch(() => [])
          await tgSend(
            env,
            chatId,
            Array.isArray(rows) && rows.length
              ? 'Telegram connected ✅ — we will message you here when your application is reviewed.'
              : 'We could not find that application. Apply on AIT Hub and use the Connect Telegram button.',
          )
        } else {
          await tgSend(
            env,
            chatId,
            'Hi! Apply at AIT Hub first, then use the Connect Telegram button so we can link your application.',
          )
        }
      }
      return json({ ok: true }) // ack Telegram fast
    }

    // Outbound relay for n8n. Allowlisted to the admin chat + known applicants so it can't
    // be abused as an open send-as-the-bot endpoint.
    if (path === '/send' && request.method === 'POST') {
      const body = await request.json().catch(() => null)
      if (!body || body.chat_id == null || !body.text) return json({ ok: false, error: 'bad_request' }, 400)
      const chatId = String(body.chat_id)

      let allowed = env.ADMIN_CHAT_ID && chatId === String(env.ADMIN_CHAT_ID)
      if (!allowed) {
        const res = await sb(env, `applications?telegram_chat_id=eq.${encodeURIComponent(chatId)}&select=id&limit=1`)
        const rows = await res.json().catch(() => [])
        allowed = Array.isArray(rows) && rows.length > 0
      }
      if (!allowed) return json({ ok: false, error: 'chat_not_allowed' }, 403)

      const extra = {}
      if (body.parse_mode) extra.parse_mode = body.parse_mode
      if (body.disable_web_page_preview != null) extra.disable_web_page_preview = body.disable_web_page_preview
      const sent = await tgSend(env, body.chat_id, body.text, extra)
      return json({ ok: sent.ok === true, telegram: sent }, sent.ok ? 200 : 502)
    }

    return new Response('not found', { status: 404 })
  },
}
