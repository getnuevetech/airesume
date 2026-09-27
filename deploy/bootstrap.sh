#!/usr/bin/env bash
# Run on the Lightsail instance from a clone of this repo, as the ubuntu user.
# Installs Git, Node.js 22, and Nginx, builds the site, and serves it on port 80.
set -euo pipefail

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Run this as the ubuntu user, not root." >&2
  exit 1
fi

sudo apt-get update
sudo apt-get install -y ca-certificates curl git nginx rsync xz-utils

if ! command -v node >/dev/null 2>&1 || [[ "$(node -p 'Number(process.versions.node.split(".")[0])')" -lt 20 ]]; then
  case "$(uname -m)" in
    x86_64) node_arch=x64 ;;
    aarch64 | arm64) node_arch=arm64 ;;
    *)
      echo "Unsupported CPU: $(uname -m)" >&2
      exit 1
      ;;
  esac
  node_version=v22.14.0
  curl -fsSL "https://nodejs.org/dist/${node_version}/node-${node_version}-linux-${node_arch}.tar.xz" -o /tmp/node.tar.xz
  sudo tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1
  hash -r
fi

echo "Using Node $(node -v)"

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
sudo systemctl restart nginx

if ! curl -fsS http://127.0.0.1/ | grep -q "JobPilot"; then
  echo "Nginx is running, but it is not serving JobPilot." >&2
  sudo tail -n 40 /var/log/nginx/error.log >&2 || true
  exit 1
fi

public_ip="$(curl -fsS --max-time 3 http://checkip.amazonaws.com || true)"
echo "JobPilot is being served on this server."
if [[ -n "$public_ip" ]]; then
  echo "Open http://${public_ip}/"
  echo "Use http, not https. If that page does not load, allow TCP port 80 in the Lightsail Networking firewall."
fi
