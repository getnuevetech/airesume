#!/usr/bin/env bash
# Prefer deploy/bootstrap.sh from a git clone. This script only prepares Nginx
# to proxy the Node app and does not publish the site by itself.
set -euo pipefail

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Run this as the ubuntu user, not root." >&2
  exit 1
fi

sudo apt-get update
sudo apt-get install -y nginx

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
sudo cp "$SCRIPT_DIR/nginx.jobpilot.conf" /etc/nginx/sites-available/jobpilot
sudo ln -sfn /etc/nginx/sites-available/jobpilot /etc/nginx/sites-enabled/jobpilot
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl reload nginx

echo "Nginx proxies port 80 to the JobPilot API on port 3000."
echo "From a clone of this repo, run: bash deploy/bootstrap.sh"
