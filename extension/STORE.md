# Chrome Web Store packaging (deferred until autofill proven)

JobPilot ships as an **unpacked** MV3 extension today (`extension/`). Do not list on the Chrome Web Store until Assisted Apply autofill is stable on target career sites.

## Before packaging

1. Replace localhost host permissions with your production API origin only.
2. Narrow `content_scripts.matches` / `host_permissions` away from blanket `https://*/*` if store review requires it — prefer explicit career-site patterns you support.
3. Add 128×128 and 48×48 icons; set `action.default_icon`.
4. Privacy practices: declare that the extension reads page content only to capture listings / assist fill, stores the API token locally, and does not sell data.
5. Link Privacy Policy (`/privacy`) and support email in the store listing.
6. Single-purpose description: “Capture jobs and assist Assisted Apply for JobPilot accounts.”

## Suggested production `host_permissions` sketch

```json
"host_permissions": [
  "https://YOUR_PRODUCTION_HOST/*"
]
```

Keep content-script matches limited to sites you actively support, or keep activeTab + scripting without broad content_scripts if you inject on demand only.

## Build zip

```bash
cd extension
zip -r ../jobpilot-extension.zip . -x '*.md' -x '.*'
```

Upload the zip in Chrome Developer Dashboard. Roll version in `manifest.json` for each store submission.

## Policy reminders

- Never auto-submit employer forms.
- Never bypass CAPTCHA / SSO.
- Sensitive fields stay blank unless the user typed them in JobPilot.
