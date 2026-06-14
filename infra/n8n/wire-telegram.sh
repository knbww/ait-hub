#!/usr/bin/env bash
# Point the Telegram bot's webhook at the n8n `telegram-connect` workflow through the
# current Cloudflare tunnel. Re-run whenever the quick-tunnel URL changes (it rotates on
# restart). Reads TELEGRAM_BOT_TOKEN from infra/n8n/.env; the token never leaves the host.
#
#   ./wire-telegram.sh                                   # auto-detect tunnel from cloudflared logs
#   ./wire-telegram.sh https://xxxx.trycloudflare.com    # or pass the tunnel base explicitly
set -euo pipefail
cd "$(dirname "$0")"

TOK=$(grep -E '^TELEGRAM_BOT_TOKEN=' .env | cut -d= -f2- | tr -d "\"' \r")
[ -n "$TOK" ] || { echo "TELEGRAM_BOT_TOKEN not set in infra/n8n/.env"; exit 1; }

URL="${1:-$(docker logs n8n-cloudflared-1 2>&1 | grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' | tail -1)}"
[ -n "$URL" ] || { echo "Tunnel URL not found. Pass it: ./wire-telegram.sh https://xxxx.trycloudflare.com"; exit 1; }

HOOK="${URL%/}/webhook/tg-connect"
echo "Setting bot webhook -> $HOOK"
curl -s "https://api.telegram.org/bot${TOK}/setWebhook" --data-urlencode "url=${HOOK}" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print('ok:',d.get('ok'),'|',d.get('description'))"
echo "Then make sure the 'AIT Hub — Telegram connect' workflow is imported and Active in n8n."
