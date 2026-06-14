#!/usr/bin/env bash
# Re-point the Supabase relay at the current n8n quick-tunnel URL. Run after `npm run n8n`
# (quick-tunnel URLs change on every restart). No-op guidance if you're on a named tunnel.
set -euo pipefail

URL=$(docker logs n8n-cloudflared-1 2>&1 | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1 || true)
if [ -z "${URL:-}" ]; then
  echo "No quick-tunnel URL found in cloudflared logs."
  echo "If you're using a NAMED tunnel, set N8N_WEBHOOK_BASE to its hostname instead:"
  echo "  npx supabase secrets set N8N_WEBHOOK_BASE=https://n8n.yourdomain.com/webhook"
  exit 1
fi

npx supabase secrets set "N8N_WEBHOOK_BASE=$URL/webhook"
echo "Wired N8N_WEBHOOK_BASE -> $URL/webhook"
