# HTTPS production notes

Terminate TLS at nginx (or a load balancer) and keep Node on localhost `:3000`.

## Quick path (certbot)

1. Point DNS at the host.
2. Install certbot nginx plugin.
3. Issue a certificate for your hostname.
4. Ensure the HTTPS server block proxies to `http://127.0.0.1:3000` and forwards:
   - `X-Forwarded-Proto $scheme`
   - `X-Forwarded-For`
   - `Host`
5. Keep `client_max_body_size` ≥ `12m` so resume uploads succeed.

See `nginx.jobpilot.conf` for the HTTP proxy skeleton. After certbot, prefer a `listen 443 ssl` server and redirect `:80` → HTTPS.

## App env

- Set `COOKIE_SECURE=1` when the public site is HTTPS (or rely on `X-Forwarded-Proto: https`).
- Set `REQUIRE_ADMIN_MFA=1` (default in `NODE_ENV=production`) so `/admin` requires TOTP.
- Configure TURN via `deploy/turn.env.example` before relying on interview rooms across NATs.
- Full pre-launch gate: `docs/LAUNCH_CHECKLIST.md` and Admin → Launch.
- Env template: `deploy/env.production.example`.

## Upload path

Resume upload must go through the same HTTPS host as the app (`/api/onboarding/extract`). Do not expose the Node port publicly.
