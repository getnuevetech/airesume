# Implementation plan (post review, 2026-09-30)

Status: slices Q–X are implemented (V is schema 29). Slice Y opens the rest of this week in the tracker. Admin MFA stays disabled for now and is not a beta blocker.

Source of truth for the next build. Slices A–P and the post-plan add-ons (prompt registry, silent Auto-Apply kill switch, resume OCR, signup resume persistence, public board API fallbacks) are on `main`. Do not reopen them unless a regression shows up.

`docs/SPEC_REVIEW_AND_PLAN.md` is a historical gap review through PR #32. Its “next” list (landing, legal, provenance, autofill, coach, tracker) is already shipped. Follow this document instead.

## Verdict

The product surface is wide enough for a private beta. It is not ready to call publicly launched. Recent merges are defect fixes (feeds, Upscale, MFA layout, signup resume files), so the next work is stabilization and the launch gate, not new product surface.

## Out of scope until this plan is done

- Employer feature expansion
- Chrome Web Store submission (`extension/STORE.md` stays the packaging note)
- Silent Auto-Apply left on by default (admin kill switch stays off)
- Salary negotiation or recruiter outreach agents
- Managed TURN / SFU
- Postgres, a second app server, or a shared rate-limit store
- Re-merging draft PR #44 (this branch carries the schema 29 port)
- Splitting `src/account/pages.tsx`, `src/employer/pages.tsx`, `server/index.mjs`, or `src/pages/admin/Controls.tsx` as a dedicated project

Draft PR #48 (reject Indeed and other aggregator URLs) is already on `main`: `unsupportedJobSiteMessage` in `server/feeds.mjs` and coverage in `server/feeds-parse.test.mjs`. Close that draft. Do not reimplement it.

## Definitions

**Private beta** — one operator, HTTPS, SMTP that delivers, backups restored once, manual billing only, a rehearsed candidate path (upload → confirm claims → live feed match → Assisted Apply). Admin MFA stays off.

**Public launch** — private beta plus outside-counsel sign-off recorded against Terms, Privacy, billing disclosure, and Auto-Apply authorization text. Admin → Launch stays `launchReady: false` until that sign-off exists outside the app. Do not add a self-serve checkbox that an operator can tick without counsel.

## Build order

```
Q  CI on every pull request
  → R  Doc and env truth (MFA, HTTPS, bootstrap password)
    → S  Backup and restore
      → T  Candidate-path regression test
        → U  Payments stay manual until signed webhooks exist
          → V  Admin RBAC on schema 29 (MFA stays off)
            → W  Weekly efficiency on the account overview
              → X  Name the roles behind this week's counts
                → Y  Open the rest of this week in the tracker
```

Q–U are the beta gate. V is admin access levels. W is the weekly overview. X lists up to five roles. Y lets the tracker show every role that counted this week.

---

### Slice Q — CI

**Goal:** `npm test` and `npm run build` run on every pull request. The suite already exists (23 Node test files plus `tsc --noEmit` inside `build`). Nothing in `.github/` runs it.

**Change**

- Add `.github/workflows/ci.yml`.
- Trigger on pull request and push to `main`.
- Use Node 22, matching `deploy/bootstrap.sh` (`v22.14.0`).
- Steps: `npm ci`, `npm test`, `npm run build`.
- No deploy job.

**Acceptance**

- A pull request cannot merge green if tests or the typecheck fail.
- Workflow does not need secrets.

---

### Slice R — Doc and env truth

**Goal:** Operators following the README, bootstrap output, or launch checklist get the same rules the code enforces.

MFA is opt-in. `defaultMfaPolicy` in `server/mfa-policy.mjs` leaves every role off. `REQUIRE_ADMIN_MFA=1` forces admin MFA on. `REQUIRE_ADMIN_MFA=0` forces it off. Production does **not** turn MFA on by itself. These docs still say the opposite:

- `docs/LAUNCH_CHECKLIST.md` (“default when `NODE_ENV=production`”)
- `deploy/HTTPS.md` (same sentence)
- `deploy/env.production.example` comment (“also default when `NODE_ENV=production`”)

Bootstrap and the README tell operators to open `http://<ip>/` and “use http, not https.” That is correct for a first boot with only port 80 open. It must not be the public-launch instruction.

**Change**

- Launch checklist, HTTPS notes, and the env example: admin MFA is required for public launch by setting `REQUIRE_ADMIN_MFA=1` and enrolling at least one admin. It is not implied by `NODE_ENV`.
- README Lightsail section: first boot may be HTTP. Public launch follows `deploy/HTTPS.md` and sets `COOKIE_SECURE=1`.
- `deploy/bootstrap.sh`: stop printing “use http, not https” as the lasting instruction. Print the HTTP URL for first boot, then point at `deploy/HTTPS.md`.
- Write `server/data/admin-bootstrap.txt` with mode `0o600` in `server/index.mjs` (the `writeFileSync` call today uses the default mode).
- README: production first boot must set `ADMIN_EMAIL` and `ADMIN_PASSWORD` before the database is created. The in-repo default exists only for local dev. If a host already booted with `admin@jobpilot.app` / the published default, change that password before the host is reachable and remove the bootstrap file from any shared disk.

**Acceptance**

- A reader of the launch checklist, HTTPS notes, and env example cannot conclude that production enables MFA automatically.
- New bootstrap files are owner-read/write only.
- No change to MFA policy behavior.

---

### Slice S — Backup and restore

**Goal:** A single Lightsail disk is the database. `deploy/bootstrap.sh` rebuilds the app and does not copy `server/data/`.

**Change**

- Add `deploy/backup.sh`. It copies `jobpilot.sqlite` with SQLite’s online backup (or `.backup` via the `sqlite3` CLI if present) plus `server/data/uploads/` into a timestamped directory the operator chooses. Refuse to run if the destination is inside the repo.
- Add `deploy/restore.sh` that stops `jobpilot.service` if it is active, replaces the database and uploads, and starts the service again. Document that restore is destructive.
- Document both scripts in `docs/LAUNCH_CHECKLIST.md` under the backup item, including a one-time restore drill on a copy (not production).
- Do not add backup objects to git. `server/data/` stays ignored.

**Acceptance**

- Backup of a running dev database restores to an empty data dir and `npm test` schema checks still see the restored tables.
- Script prints the path it wrote and does not print admin passwords or session tokens.

---

### Slice T — Candidate-path regression

**Goal:** One automated path covers the loop recent bugs broke: resume file kept on the user, claims confirmed, a supported feed parsed, a match explanation produced, an Assisted Apply kit returned. No live network and no model call in the test.

**Change**

- Add `server/candidate-path.test.mjs` using the same in-memory or temp-dir database style as `server/smoke.test.mjs`.
- Steps, all in-process:
  1. Create a user from a small fixture resume text (reuse extraction helpers that do not call a provider, or insert a confirmed profile the way onboarding tests do).
  2. Assert the stored profile has resume text and at least one confirmed fact.
  3. Parse a checked-in Greenhouse or Remotive JSON fixture through the feed parser (no HTTP).
  4. Run the deterministic matcher and assert a score plus an explanation that cites ledger facts.
  5. Build an apply kit and assert sensitive fields (sponsorship, disability, veteran, salary when unset) are blank.
- Fixture file lives next to the test, not as a new production feed.

**Acceptance**

- `npm test` includes the new file (add it to the `test` script in `package.json`).
- The test fails if signup drops the resume text, if an Indeed URL is accepted as a feed, or if the kit fills a sensitive field from inference.

---

### Slice U — Payments stay manual

**Goal:** Stripe and PayPal checkout in `server/routes-billing.mjs` confirm payment by calling the provider with the stored secret and then applying the plan. There is no webhook signature check. A caller who can hit confirm must not be able to mark a live charge paid incorrectly, and operators must not flip a gateway to live by accident during beta.

**Change**

- Reject creating or enabling a gateway with `mode: "live"` unless `BILLING_LIVE=1` is set in the environment. Default is unset, so live mode returns 400 with a message that beta billing is the manual ledger.
- Test mode and `kind: "manual"` keep working.
- Admin plan copy already explains manual ledger. Add one line on the payments admin panel: live card gateways stay off until signed webhooks exist.
- Do not implement Stripe or PayPal webhooks in this slice.

**Acceptance**

- `POST /api/admin/gateways` with `mode: "live"` fails when `BILLING_LIVE` is unset.
- The same request succeeds when `BILLING_LIVE=1`.
- Existing test-mode checkout behavior is unchanged.
- A unit test covers the rejection.

---

### Slice V — Admin RBAC

**Goal:** Super Admins assign access levels. Admin MFA stays disabled while this ships.

**Change**

- Schema 29 adds `admin_access_level_id` and seeds Super Admin, Content Editor, Support, Operations, AI Ops, and Billing.
- Existing admins stay Super Admin. Scoped admins only see allowed tabs, and the same keys are enforced on the API.
- Do not add permissions beyond that catalog. Close draft PR #44 once this lands; do not merge that branch.

**Acceptance**

- A homepage-only level can open Homepage and cannot save plans.
- An admin with no level assigned is treated as Super Admin.

---

### Slice W — Weekly efficiency

**Goal:** The account overview is a weekly story, not only lifetime tiles. Counts use the same Monday-UTC week as match and review quotas.

**Change**

- `weeklyEfficiency` counts applications submitted, prepared (Ready or Review required), and tracked this week.
- The next action is follow-ups, then Assisted Apply, then recommended jobs, then the resume.
- `GET /api/dashboard` returns `week`. The overview shows it in the existing account card.

**Acceptance**

- Activity before Monday UTC is excluded.
- Follow-ups due outrank ready applications.
- Unlimited and limited quota lines both render.

---

### Slice X — Name this week's roles

**Goal:** The overview counts are not enough. The candidate can see which roles were submitted, prepared, or tracked this week and open that card.

**Change**

- `weeklyEfficiency` returns up to five roles, newest activity first, plus how many more there are.
- A submitted role is not also listed as tracked.
- Follow-ups open `#follow-ups`. Assisted Apply opens the newest prepared application.
- The tracker scrolls to that card.

**Acceptance**

- Activity before Monday UTC stays off the list.
- Six in-week roles show five rows and a remainder of one.
- The follow-up action targets the reminders section.

---

### Slice Y — This week in the tracker

**Goal:** The overview keeps five roles. The tracker can show every role that counted this week, in the same order.

**Change**

- `weeklyEfficiency` returns `roles` for the full week, not only the five overview rows.
- "N more this week" opens `/account/applications?week=1`.
- The tracker has All and This week. In-week cards say Submitted, Prepared, or Tracked.

**Acceptance**

- Six in-week roles produce six `roles` and a remainder of one.
- A role submitted this week appears once.
- The This week tracker view is empty when nothing moved.

---

## Ops the repo cannot finish

These stay on `docs/LAUNCH_CHECKLIST.md`. Code in slices R and S only makes them executable.

| Gate | Who |
| --- | --- |
| DNS, certbot, port 443, `COOKIE_SECURE=1` | Operator, using `deploy/HTTPS.md` |
| Admin MFA | Disabled for now. Do not enroll or set `REQUIRE_ADMIN_MFA` until that decision changes |
| SMTP host and from address, then a real reset email | Operator, Admin → Email |
| Counsel review of legal and Auto-Apply text | Outside counsel |
| Confirm U.S.-first / 18+ copy and no ad cookies | Operator plus counsel |
| TURN only if interview rooms are in the beta | Operator, `deploy/turn.env.example` |
| AI provider training-on-customer-data setting | Operator, `docs/AI_GOVERNANCE_CHECKLIST.md` |
| Deletion drill | Operator, `docs/RETENTION_AND_DELETION.md` |

## Done when

Private beta is ready when Q, R, S, T, and U are merged, CI is green, and the operator rows above that apply to this host are checked. Public launch waits on counsel. Admin MFA stays off. Slices V through Y are in the product and are not launch gates.
