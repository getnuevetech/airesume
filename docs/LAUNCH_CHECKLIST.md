# Launch checklist (Slice M)

Pre-public launch gate for JobPilot. Ops signals are also visible in **Admin → Launch**.

## Blockers (must be green)

- [ ] `NODE_ENV=production`
- [ ] HTTPS terminated at nginx/LB (`deploy/HTTPS.md`); Node stays on localhost `:3000`
- [ ] `COOKIE_SECURE=1` (required for production launch; Admin → Launch fails `opsReady` without it)
- [ ] SMTP host + from address configured, then **Send a test** succeeds (Admin → Email). Admin → Launch fails `opsReady` until that test is recorded for the current SMTP settings.
- [ ] Legal entity saved under Admin → Launch (company name, mailing address, privacy email, legal/support email). Public Terms/Privacy use these fields. Admin → Launch fails `opsReady` until company brackets are cleared.
- [ ] Published default admin password rotated (`admin@jobpilot.app` must not accept `JobPilot-Admin-2026`; `admin-bootstrap.txt` must not store a plaintext password). Admin → Launch fails `opsReady` until this is clean.
- [ ] Silent Auto-Apply kill switch stays off (Admin → AI). Admin → Launch fails `opsReady` if it is on.
- [ ] Live card billing stays off (`BILLING_LIVE` unset; no enabled live Stripe/PayPal gateway). Use the manual ledger. Admin → Launch fails `opsReady` if live billing is unlocked.
- [ ] Live AI providers have API keys (Admin → AI). Admin → Launch fails `opsReady` if an enabled OpenAI/Anthropic/Google provider has a blank key.
- [ ] Outside counsel review of Terms, Privacy, billing disclosure, and Auto-Apply authorization text
- [ ] Confirm U.S.-first / 18+ positioning still accurate in legal copy
- [ ] Confirm no advertising/cross-site cookies without updating Privacy + Cookie Settings

## Strongly recommended

- [ ] TURN credentials set (`deploy/turn.env.example`) so interview rooms report `productionReady`
- [ ] Career extraction assigned to a live AI provider (not Built-in rules only). Admin → Launch shows this as recommended.
- [ ] AI providers: training-on-customer-data disabled where the vendor allows (`docs/AI_GOVERNANCE_CHECKLIST.md`)
- [ ] Retention / deletion drill once on staging: run `deploy/deletion-drill.sh` (creates a throwaway account, deletes it via production fan-out, records a marker). Admin → Launch shows this as recommended. See `docs/RETENTION_AND_DELETION.md`.
- [ ] Backup strategy for `server/data/` (SQLite + uploads). Take a copy with `deploy/backup.sh /path/outside/the/repo`, then restore that copy once onto a non-production directory with `deploy/restore.sh <backup> <target> --yes` and confirm `/api/health` after a real restore drill. Admin → Launch shows this as recommended once both markers are recorded.
- [ ] Extension remains **unpacked** until autofill quality is proven; then follow `extension/STORE.md`

## Explicitly deferred

- Admin MFA. It stays off. Do not set `REQUIRE_ADMIN_MFA=1` until you decide to require authenticator codes. Optional enrollment remains under Admin → Security.
- Silent Auto-Apply submit (keep review-first)
- Employer feature expansion
- Managed TURN SaaS / SFU media stack
- Salary negotiation / outreach agents

## Smoke after deploy

```bash
bash deploy/smoke.sh https://YOUR_HOST
# Expect: health ok · https://YOUR_HOST/api/health
```

Or manually:

```bash
curl -fsS https://YOUR_HOST/api/health
# Expect { "ok": true }
```

Sign in as admin → **Launch** tab → confirm ops checks. Complete counsel review externally before calling the product publicly launched.
