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

The first admin account is created on the first API boot. Defaults are `admin@jobpilot.app` / `JobPilot-Admin-2026` unless `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set first. The values are written to `server/data/admin-bootstrap.txt`.

After sign-in, the dashboard shows resume rating, tailored jobs, applications, and plan controls. Admins assign each AI function to a provider, edit the plan matrix, add Stripe, PayPal, or a manual ledger, and pull jobs from configured sources. A public resume is served at `/resume/<slug>`.

Google sign-in needs `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`. Resume extraction uses a rules parser unless `OPENAI_API_KEY` is set. The product plan is in `docs/EXECUTION_PLAN.md`.

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

4. Open `http://<public-ip>/` in a browser. Use `http`, not `https`.
5. Sign in at `http://<public-ip>/signin` with the admin email and password printed at the end of bootstrap, also stored in `server/data/admin-bootstrap.txt`. Homepage, users, admins, and password reset links are under `/admin`. After sign-in, the account side menu is at `/account`.

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
