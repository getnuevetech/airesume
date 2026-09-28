# Launch checklist (Slice M)

Pre-public launch gate for JobPilot. Ops signals are also visible in **Admin → Launch**.

## Blockers (must be green)

- [ ] `NODE_ENV=production`
- [ ] HTTPS terminated at nginx/LB (`deploy/HTTPS.md`); Node stays on localhost `:3000`
- [ ] `COOKIE_SECURE=1` (or verified `X-Forwarded-Proto: https`)
- [ ] `REQUIRE_ADMIN_MFA=1` (default when `NODE_ENV=production`) and at least one admin enrolled in TOTP
- [ ] SMTP host + from address configured (Admin → Email) so resets/notices deliver
- [ ] Outside counsel review of Terms, Privacy, billing disclosure, and Auto-Apply authorization text
- [ ] Confirm U.S.-first / 18+ positioning still accurate in legal copy
- [ ] Confirm no advertising/cross-site cookies without updating Privacy + Cookie Settings

## Strongly recommended

- [ ] TURN credentials set (`deploy/turn.env.example`) so interview rooms report `productionReady`
- [ ] AI providers: training-on-customer-data disabled where the vendor allows (`docs/AI_GOVERNANCE_CHECKLIST.md`)
- [ ] Retention / deletion drill once on staging (`docs/RETENTION_AND_DELETION.md`)
- [ ] Backup strategy for `server/data/` (SQLite + uploads)
- [ ] Extension remains **unpacked** until autofill quality is proven; then follow `extension/STORE.md`

## Explicitly deferred

- Silent Auto-Apply submit (keep review-first)
- Employer feature expansion
- Managed TURN SaaS / SFU media stack
- Salary negotiation / outreach agents

## Smoke after deploy

```bash
curl -fsS https://YOUR_HOST/api/health
# Expect { "ok": true }
```

Sign in as admin → **Launch** tab → confirm ops checks. Complete counsel checkbox externally before calling the product publicly launched.
