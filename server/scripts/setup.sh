#!/usr/bin/env bash
# Run once on a fresh Hetzner Ubuntu 24.04 server.
# Usage: ssh root@YOUR_IP 'bash -s' < scripts/setup.sh
set -euo pipefail

echo "==> Installing Docker"
curl -fsSL https://get.docker.com | sh

echo "==> Configuring firewall"
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP  (Caddy redirects to HTTPS)
ufw allow 443/tcp   # HTTPS
ufw allow 443/udp   # HTTP/3
ufw --force enable

echo "==> Creating app directory"
mkdir -p /opt/translator-api

echo ""
echo "Server ready. Now point your domain's A record to this IP, then run:"
echo "  HETZNER_HOST=YOUR_IP DOMAIN=api.yourdomain.com ./scripts/deploy.sh"
