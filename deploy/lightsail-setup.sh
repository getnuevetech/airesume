#!/usr/bin/env bash
# Run once on a fresh Ubuntu Lightsail instance, as the default user (ubuntu).
# In the Lightsail networking tab, allow TCP 80 before opening the site.
set -euo pipefail

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Run this as the ubuntu user, not root." >&2
  exit 1
fi

sudo apt-get update
sudo apt-get install -y nginx
sudo mkdir -p /var/www/jobpilot
sudo chown -R "$(id -un):$(id -gn)" /var/www/jobpilot

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
sudo cp "$SCRIPT_DIR/nginx.jobpilot.conf" /etc/nginx/sites-available/jobpilot
sudo ln -sfn /etc/nginx/sites-available/jobpilot /etc/nginx/sites-enabled/jobpilot
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl reload nginx

echo "Nginx is serving /var/www/jobpilot on port 80."
echo "From your computer: LIGHTSAIL_HOST=<static-ip> ./deploy/deploy.sh"
