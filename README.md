# JobPilot

AI job application manager. The homepage is editable in admin, accounts are created by uploading a resume, and the extracted career facts are stored only after the user confirms them.

```bash
npm install
npm run api
npm run dev
```

The API listens on port 3000. Vite on port 5173 proxies `/api` and `/uploads`.

Production, from a built `dist` folder:

```bash
npm run build
npm start
```

The first admin account is created on the first API boot. Local development uses `admin@jobpilot.app` / `JobPilot-Admin-2026` when `ADMIN_EMAIL` and `ADMIN_PASSWORD` are unset. A production host must set both variables before the database is created. When the built-in default password is used, the admin must change it on first sign-in before opening `/admin`. The bootstrap note is written to `server/data/admin-bootstrap.txt` as owner-read/write only. If a host already booted with the published default, change that password before the host is reachable and remove the bootstrap file from any shared disk.

After sign-in, the dashboard shows resume rating, tailored jobs, applications, and plan controls. Admins assign each AI function to a provider, edit the plan matrix, add Stripe, PayPal, or a manual ledger, and pull jobs from configured sources. A public resume is served at `/resume/<slug>`. The product plan is in `docs/EXECUTION_PLAN.md`.

Optional environment:

- `ADMIN_EMAIL`, `ADMIN_PASSWORD` before the first database create
- `COOKIE_SECURE=1` to force Secure session cookies (also set automatically when `x-forwarded-proto` is `https`)
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `SMTP_*` for password-reset email
- `STUN_URIS`, `TURN_URIS`, `TURN_USERNAME`, `TURN_CREDENTIAL` for interview-room WebRTC (see `deploy/turn.env.example`)
- AI providers are configured in Admin → AI Pipelines (not only via `OPENAI_API_KEY`)

Browser extension (unpacked): see `extension/README.md`. Create a token under Account → Settings.

```bash
npm test
```

runs the Node smoke tests (migrate, match, claim checks).

## Lightsail

The site is published from `main` on the server.

1. In the Lightsail console, open the instance, then Networking, and allow HTTP (TCP 80). SSH (TCP 22) should already be allowed.
2. Connect as `ubuntu`.
3. Clone and start the site:

```bash
git clone https://github.com/getnuevetech/airesume.git
cd airesume
bash deploy/bootstrap.sh
```

4. First boot is HTTP: open `http://<public-ip>/` after TCP port 80 is allowed. Public launch is HTTPS. Follow `deploy/HTTPS.md` and set `COOKIE_SECURE=1` before sending real users to the host.
5. Sign in at `http://<public-ip>/signin` with the admin email and password printed at the end of bootstrap, also stored in `server/data/admin-bootstrap.txt` (owner-read/write only). Homepage, users, admins, and password reset links are under `/admin`. After sign-in, the account side menu is at `/account`. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` before the first boot on a production host.

If the checkout is already on the server, update it and rebuild:

```bash
cd ~/airesume
git checkout main
git pull origin main
bash deploy/bootstrap.sh
```

If the script says JobPilot is being served but the browser never connects, allow TCP port 80 in the Lightsail Networking firewall.

Later updates, from `~/airesume` on the server:

```bash
git pull origin main
bash deploy/bootstrap.sh
```
