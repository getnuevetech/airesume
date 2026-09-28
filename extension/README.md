# JobPilot browser extension

Chrome / Edge Manifest V3 extension that captures the current job listing into your JobPilot tracker.

## Install (unpacked)

1. Sign in to JobPilot → **Settings** → create an **extension token** and copy it.
2. Chrome → `chrome://extensions` → enable Developer mode → **Load unpacked** → choose this `extension/` folder.
3. Open the extension popup, paste your API base (for local: `http://localhost:3000`) and token.
4. On an employer listing page, click **Track** or **Assisted Apply**.

## Notes

- The token is shown once; JobPilot stores only a hash.
- Capture never submits applications for you — it imports the listing and optionally prepares Assisted Apply.
- Host permissions include `https://*/*` so content scripts can read public career pages. Restrict this for production packaging if you ship a store build.
