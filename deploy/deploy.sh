#!/usr/bin/env bash
# Build JobPilot and copy it to a Lightsail instance that already ran lightsail-setup.sh.
# Usage: LIGHTSAIL_HOST=1.2.3.4 ./deploy/deploy.sh
# Optional: LIGHTSAIL_USER (default ubuntu), LIGHTSAIL_KEY (path to the .pem)
set -euo pipefail

HOST="${LIGHTSAIL_HOST:-}"
USER_NAME="${LIGHTSAIL_USER:-ubuntu}"
KEY="${LIGHTSAIL_KEY:-}"

if [[ -z "$HOST" ]]; then
  echo "Set LIGHTSAIL_HOST to the instance static IP." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

npm ci
npm run build

SSH=(ssh -o StrictHostKeyChecking=accept-new)
RSYNC=(rsync -az --delete)
if [[ -n "$KEY" ]]; then
  SSH+=(-i "$KEY")
  RSYNC+=(-e "ssh -i $KEY -o StrictHostKeyChecking=accept-new")
fi

"${RSYNC[@]}" "$ROOT/dist/" "${USER_NAME}@${HOST}:/var/www/jobpilot/"
"${SSH[@]}" "${USER_NAME}@${HOST}" "sudo nginx -t && sudo systemctl reload nginx"

echo "Published to http://${HOST}/"
