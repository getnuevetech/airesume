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

The production build is a static site. On a new Ubuntu Lightsail instance, open port 80 in the networking firewall, copy this repo over, and run:

```bash
bash deploy/lightsail-setup.sh
```

From a machine that can SSH to that instance:

```bash
LIGHTSAIL_HOST=<static-ip> LIGHTSAIL_KEY=~/LightsailDefaultKey.pem ./deploy/deploy.sh
```
