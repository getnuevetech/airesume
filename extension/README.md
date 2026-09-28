# JobPilot browser extension

Chrome / Edge Manifest V3 extension that captures job listings and assists Assisted Apply autofill.

## Install (unpacked)

1. Sign in to JobPilot → **Settings** → create an **extension token** and copy it.
2. Chrome → `chrome://extensions` → enable Developer mode → **Load unpacked** → choose this `extension/` folder.
3. Open the extension popup, paste your API base (for local: `http://localhost:3000`) and token.
4. On an employer listing page, click **Track** or **Assisted Apply**.

## Autofill assist

1. Run **Assisted Apply** so JobPilot creates/prepares an application (application id is stored in the popup).
2. Open the employer application form.
3. Click **Detect fields**, then **Fill from kit** (explicit click required).
4. Review every field. Sensitive answers (authorization, EEO, salary, CAPTCHA, passwords) stay blank.
5. Submit on the employer site yourself, then click **Mark Applied** to update your JobPilot tracker.

Autofill never bypasses CAPTCHA, SSO, or login walls and never auto-submits forms.

## Notes

- The token is shown once; JobPilot stores only a hash.
- Capture never submits applications for you — it imports the listing and optionally prepares Assisted Apply.
- Host permissions include `https://*/*` so content scripts can read public career pages. Restrict this for production packaging if you ship a store build.
