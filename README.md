# JobPilot

Marketing site and resume autopilot demo. Upload a resume in the browser, create an account, and watch simulated applications move from match to applied.

```bash
npm install
npm run dev
```

Open the local URL Vite prints. Production build:

```bash
npm run build
npm run preview
```

Resume files stay in this browser. Applications are a preview and are not sent to employers.

## Lightsail

The site is published from Git on the server. The app is on branch `cursor/jobpilot-landing-63b6` until that pull request is merged.

1. In the Lightsail console, open the instance, then Networking, and allow HTTP (TCP 80). SSH (TCP 22) should already be allowed.
2. Connect as `ubuntu`.
3. Clone and start the site:

```bash
git clone --branch cursor/jobpilot-landing-63b6 --single-branch https://github.com/getnuevetech/airesume.git
cd airesume
bash deploy/bootstrap.sh
```

4. Open `http://<public-ip>/` in a browser. Use `http`, not `https`.

`main` does not contain the app. If a clone of `main` is already on the server, switch branches and rebuild:

```bash
cd ~/airesume
git fetch origin
git checkout cursor/jobpilot-landing-63b6
git pull origin cursor/jobpilot-landing-63b6
bash deploy/bootstrap.sh
```

If the script says JobPilot is being served but the browser never connects, allow TCP port 80 in the Lightsail Networking firewall.

Later updates, from `~/airesume` on the server:

```bash
git pull
bash deploy/bootstrap.sh
```
