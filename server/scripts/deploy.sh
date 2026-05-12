#!/usr/bin/env bash
# Deploy the translation server to Hetzner.
#
# Required env vars:
#   HETZNER_HOST   server IP or hostname
#   DOMAIN         your API domain, e.g. api.yourdomain.com
#
# Optional:
#   HETZNER_USER   SSH user (default: root)
#
# Usage:
#   HETZNER_HOST=1.2.3.4 DOMAIN=api.yourdomain.com ./scripts/deploy.sh
set -euo pipefail

HOST="${HETZNER_HOST:?Set HETZNER_HOST to your server IP}"
DOMAIN="${DOMAIN:?Set DOMAIN to your API domain, e.g. api.yourdomain.com}"
USER="${HETZNER_USER:-root}"
REMOTE="/opt/translator-api"

echo "==> Syncing files to $USER@$HOST:$REMOTE"
rsync -az --progress \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.git' \
  --exclude 'scripts' \
  "$(dirname "$0")/../" "$USER@$HOST:$REMOTE/"

echo "==> Writing .env on server"
ssh "$USER@$HOST" "echo 'DOMAIN=$DOMAIN' > $REMOTE/.env"

echo "==> Building and starting containers"
ssh "$USER@$HOST" "
  cd $REMOTE
  docker compose pull caddy
  docker compose up -d --build
  docker compose ps
"

echo ""
echo "Done."
echo "  API    → https://$DOMAIN/translate"
echo "  Status → https://$DOMAIN/"
echo "  Logs   → ssh $USER@$HOST 'docker compose -C $REMOTE logs -f api'"
