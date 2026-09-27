#!/usr/bin/env bash
# Run on the Lightsail instance from a clone of this repo, as the ubuntu user.
# Installs Git, Node.js 22, and Nginx, builds the site, and serves it on port 80.
set -euo pipefail

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Run this as the ubuntu user, not root." >&2
  exit 1
fi

sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg git nginx rsync

if ! command -v node >/dev/null 2>&1 || [[ "$(node -p 'Number(process.versions.node.split(".")[0])')" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

npm ci
npm run build

sudo mkdir -p /var/www/jobpilot
sudo rsync -a --delete "$ROOT/dist/" /var/www/jobpilot/
sudo chown -R www-data:www-data /var/www/jobpilot

sudo cp "$ROOT/deploy/nginx.jobpilot.conf" /etc/nginx/sites-available/jobpilot
sudo ln -sfn /etc/nginx/sites-available/jobpilot /etc/nginx/sites-enabled/jobpilot
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl reload nginx

echo "JobPilot is being served on port 80."
echo "Open http://$(curl -fsS --max-time 2 http://checkip.amazonaws.com || echo '<this-server-public-ip>')/"
