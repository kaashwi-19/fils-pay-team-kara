#!/usr/bin/env bash
# One-command deploy of the whole FilsPay stack on a single Linux server.
# Safe to re-run after pulling new code: it never wipes data.
#
#   bash ops/deploy.sh
#
set -euo pipefail
cd "$(dirname "$0")/.."

SUDO=""
if [ "$(id -u)" -ne 0 ]; then SUDO="sudo"; fi

echo "==> 1/6 Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | $SUDO sh
fi
$SUDO docker compose version >/dev/null

echo "==> 2/6 Swap (a 2 GB server needs headroom while building)"
if ! swapon --show | grep -q .; then
  $SUDO fallocate -l 2G /swapfile
  $SUDO chmod 600 /swapfile
  $SUDO mkswap /swapfile >/dev/null
  $SUDO swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | $SUDO tee -a /etc/fstab >/dev/null
fi

echo "==> 3/6 Secrets (ops/.env, created once, never committed)"
if [ ! -f ops/.env ]; then
  umask 077
  cat > ops/.env <<EOF
SETTLEMENT_INTERNAL_TOKEN=$(openssl rand -hex 32)
WEBHOOK_SECRET_ENCRYPTION_KEY=$(openssl rand -base64 32)
ACQUIRER_CALLBACK_SIGNING_SECRET=$(openssl rand -hex 32)
EOF
fi
# The address people use to reach this server (payment-link URLs use it).
if ! grep -q '^PUBLIC_BASE_URL=' ops/.env; then
  IP=$(curl -fsS https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
  echo "PUBLIC_BASE_URL=http://$IP" >> ops/.env
fi

echo "==> 4/6 Build and start (database, migrations, api, settlement, reporting, dashboard website)"
$SUDO docker compose -f ops/docker-compose.yml up -d --build

echo "==> 5/6 Demo data (only if the database is empty; the seed refuses otherwise)"
$SUDO docker compose -f ops/docker-compose.yml --profile seed run --rm seed || echo "   (skipped: database already has data)"

echo "==> 6/6 Health check"
for i in $(seq 1 30); do
  if curl -fsS http://localhost:3000/healthz >/dev/null 2>&1; then
    IP=$(curl -fsS https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
    echo "   API is up:        http://$IP:3000/healthz"
    echo "   Dashboard website: http://$IP/"
    $SUDO docker compose -f ops/docker-compose.yml ps
    exit 0
  fi
  sleep 2
done
echo "   API did not answer on port 3000. Logs:"
$SUDO docker compose -f ops/docker-compose.yml logs --tail=50 api
exit 1
