#!/usr/bin/env bash
# Run on the Lightsail instance from a clone of this repo, as the ubuntu user.
# Installs Git, Node.js 22, and Nginx, builds the site, and serves the API on port 80.
set -euo pipefail

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Run this as the ubuntu user, not root." >&2
  exit 1
fi

sudo apt-get update
sudo apt-get install -y ca-certificates curl git nginx rsync xz-utils python3

if ! command -v node >/dev/null 2>&1 || [[ "$(node -p 'Number(process.versions.node.split(".")[0])')" -lt 22 ]]; then
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

NODE_BIN="$(command -v node)"
sudo tee /etc/systemd/system/jobpilot.service >/dev/null <<EOF
[Unit]
Description=JobPilot
After=network.target

[Service]
Type=simple
User=$(id -un)
WorkingDirectory=${ROOT}
Environment=NODE_ENV=production
Environment=PORT=3000
ExecStart=${NODE_BIN} server/index.mjs
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable jobpilot
sudo systemctl restart jobpilot

sudo cp "$ROOT/deploy/nginx.jobpilot.conf" /etc/nginx/sites-available/jobpilot
sudo ln -sfn /etc/nginx/sites-available/jobpilot /etc/nginx/sites-enabled/jobpilot
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl restart nginx

for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS http://127.0.0.1:3000/api/health | grep -q '"ok":true'; then
    break
  fi
  sleep 1
done

if ! curl -fsS http://127.0.0.1/ | grep -q "JobPilot"; then
  echo "Nginx is running, but it is not serving JobPilot." >&2
  sudo systemctl status jobpilot --no-pager >&2 || true
  sudo journalctl -u jobpilot -n 40 --no-pager >&2 || true
  sudo tail -n 40 /var/log/nginx/error.log >&2 || true
  exit 1
fi

public_ip="$(curl -fsS --max-time 3 http://checkip.amazonaws.com || true)"
echo "JobPilot is being served on this server."
if [[ -f "$ROOT/server/data/admin-bootstrap.txt" ]]; then
  echo "First admin login is in server/data/admin-bootstrap.txt"
fi
if [[ -n "$public_ip" ]]; then
  echo "First boot: open http://${public_ip}/"
  echo "If that page does not load, allow TCP port 80 in the Lightsail Networking firewall."
  echo "Public launch uses HTTPS. Follow deploy/HTTPS.md and set COOKIE_SECURE=1 before sending real users to this host."
fi
