# Implementation plan (post review, 2026-09-30)

Status: slices Q–AZ are implemented (AO is schema 33). Job listings are readable, imported links stay at the top of that candidate’s list, and pages that are not jobs wait in admin for add or discard. Slice Y opens the rest of this week in the tracker. Slice AA shows a match as skills that fit the resume and skills that are missing, without Fact Ledger ids. Slice AB reads required skills from the role text when a saved list is only a pasted title or company line. Slice AC lets a candidate confirm one of those missing skills into the Fact Ledger. Slice AD writes that skill into the resume already prepared for the same job. Slice AE writes it into every resume already prepared for that candidate. Slice AF lists those skills on the profile without Fact Ledger ids. Slice AG lets a candidate confirm a high-demand insight gap into that same ledger. Slice AH draws account stats as charts and colors category scores so the account is easier to scan. Slice AI shows each tracked role on a colored stage rail. Slice AJ saves a one-tap check-in on each application. Slice AK saves that check-in on the role itself, with one sentence the candidate heard. Slice AL saves a status-menu change on that same card and closes the reminder that no longer matches. Slice AM saves the moment a prepared role is submitted. Slice AN counts only this week's roles in the tracker charts. Slice AO keeps an account activity log the candidate and an admin can both read, and an operations log an admin uses to record a checkout whose payment return never finished. Slice AP puts every on-disk Node test into `npm test` so CI cannot skip them. Slice AQ fails Admin → Launch when Terms or Privacy still contain unfinished company or counsel placeholders. Slice AR fails Admin → Launch when the published default admin password is still active or the bootstrap file still stores a plaintext password. Slice AS fails Admin → Launch when Silent Auto-Apply is on or live card billing is unlocked. Slice AT requires `COOKIE_SECURE=1` in production for `opsReady` and adds `deploy/smoke.sh` for post-deploy health. Slice AU lets an operator save company legal entity fields under Admin → Launch so Terms/Privacy brackets clear without editing source; draft/arbitration markers stay on the counsel gate. Slice AV fails Admin → Launch when live AI providers lack API keys, and recommends assigning a live model for career extraction. Slice AW fails Admin → Launch until Admin → Email has delivered a successful SMTP test against the current host and from address. Slice AX records backup and restore-drill markers from `deploy/backup.sh` / `deploy/restore.sh` and shows them as a recommended Admin → Launch check. Slice AY records an account-deletion fan-out drill from `deploy/deletion-drill.sh` as a recommended Admin → Launch check. Slice AZ records an Admin → AI attestation that training on customer data is disabled where vendors allow, as a recommended Admin → Launch check. Admin MFA stays disabled for now and is not a beta blocker.

Source of truth for the next build. Slices A–P and the post-plan add-ons (prompt registry, silent Auto-Apply kill switch, resume OCR, signup resume persistence, public board API fallbacks) are on `main`. Do not reopen them unless a regression shows up.

`docs/SPEC_REVIEW_AND_PLAN.md` is a historical gap review through PR #32. Its “next” list (landing, legal, provenance, autofill, coach, tracker) is already shipped. Follow this document instead.

## Verdict

The product surface is wide enough for a private beta. It is not ready to call publicly launched. Slices AN–AZ are on `main` once this lands. The next work is remaining operator launch checklist items (HTTPS, counsel) — not new product surface.

## Out of scope until this plan is done

- Employer feature expansion
- Chrome Web Store submission (`extension/STORE.md` stays the packaging note)
- Silent Auto-Apply left on by default (admin kill switch stays off)
- Salary negotiation or recruiter outreach agents
- Managed TURN / SFU
- Postgres, a second app server, or a shared rate-limit store
- Splitting `src/account/pages.tsx`, `src/employer/pages.tsx`, `server/index.mjs`, or `src/pages/admin/Controls.tsx` as a dedicated project

PRs #44 (admin access levels) and #48 (reject aggregator URLs) are already on `main`. Do not reimplement them.

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
                  → Z  Show the tailored resume after Assisted Apply
                  → AA  Show a readable match on the job
                    → AB  Read requirements from the role text
                      → AC  Confirm a missing skill
                        → AD  Put that skill on the prepared resume
                          → AE  Put that skill on every prepared resume
                            → AF  Show confirmed skills without ledger ids
                              → AG  Confirm a high-demand insight gap
                                → AH  Chart the account stats and color the scores
                                  → AI  Show each application on a stage rail
                                    → AJ  Save a one-tap check-in on each application
                                      → AK  Save a note with the check-in on the role
                                        → AL  Save a status-menu change on the application
                                          → AM  Save the submit moment on the application
                                            → AN  Count this week's roles in the tracker charts
                                              → AO  Keep two activity histories and finish a stuck checkout on the ledger
                                                → AP  Run every on-disk Node test in CI
                                                  → AQ  Fail launch readiness on unfinished legal placeholders
                                                    → AR  Fail launch readiness on the published default admin password
                                                      → AS  Fail launch readiness when Silent Auto-Apply or live billing is on
                                                        → AT  Require COOKIE_SECURE=1 in production and add deploy smoke
                                                          → AU  Admin legal entity fields for Terms/Privacy brackets
                                                            → AV  Fail launch readiness on blank live AI keys
                                                              → AW  Fail launch readiness until SMTP delivers a test
                                                                → AX  Recommend Backup and restore drill on Launch
                                                                  → AY  Recommend account deletion fan-out drill on Launch
                                                                    → AZ  Recommend AI training attestation on Launch
```

Q–U are the beta gate. V is admin access levels. W is the weekly overview. X lists the roles in those counts and opens the matching tracker card. Z shows the fact-checked resume prepared for a job. AA shows which resume skills fit a listing and which required skills are missing. AB uses the role text when the saved requirements are only paste headers. AC saves a confirmed gap onto the Fact Ledger and the active resume. AD updates the resume already prepared for that job so the confirmed skill is on it. AE updates every prepared resume for that candidate. AF shows those skills on the profile by name. AG confirms one insight gap into the Fact Ledger. AH replaces plain stat numbers with rings and bars, and shows category scores in color. AI shows where each tracked role sits from prepare through offer. AJ asks what happened on a due application and keeps that answer on the card. AK asks the same question on the role and keeps one sentence the candidate heard. AL saves a move from the status menu on that card and closes the reminder for the previous stage. Y lets the tracker show every role that counted this week. AM saves the moment a prepared role is submitted so the card history starts there. AN makes the tracker glance and stage chart follow that same week. AO keeps the candidate's activity where they and an admin can read it, and lets an admin record an unfinished payment return on the manual ledger. AP adds the five on-disk Node tests that were missing from `npm test` so CI runs the full suite. AQ fails Admin → Launch when Terms or Privacy still show unfinished company or counsel placeholders. AR fails Admin → Launch when `admin@jobpilot.app` still accepts the published default password or `admin-bootstrap.txt` still stores a plaintext password. AS fails Admin → Launch when Silent Auto-Apply is on or live card billing is unlocked. AT requires `COOKIE_SECURE=1` when `NODE_ENV=production` and adds `deploy/smoke.sh` for `/api/health`. AU lets an operator save company legal entity fields under Admin → Launch so Terms/Privacy brackets clear without editing source; draft/arbitration markers stay on the counsel gate. AV fails Admin → Launch when an enabled OpenAI/Anthropic/Google provider has a blank API key, and recommends assigning a live model for career extraction. AW fails Admin → Launch until Admin → Email has delivered a successful SMTP test for the current host and from address. AX records markers from `deploy/backup.sh` and a non-production `deploy/restore.sh` drill and shows them as a recommended Admin → Launch check. AY runs `deploy/deletion-drill.sh` to exercise account-deletion fan-out and shows that as a recommended Admin → Launch check. AZ lets an operator attest under Admin → AI that training on customer data is disabled where vendors allow, and shows that as a recommended Admin → Launch check.

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

### Slice Z — Show the tailored resume

**Goal:** Assisted Apply already builds a job-specific resume by reordering skills, roles, and bullets that are already on the resume. The candidate could not see that resume, what moved, or that it was saved separately.

**Change**

- `describeTailoring` explains only reorders of existing skills, roles, and bullets. A new skill or employer is not described as a change.
- Preparing an application stores that resume as its own version and returns the rendered text plus the reorder notes.
- The job card and the tracker show the saved resume. Profile and Resume label it “Tailored for a job” and keep the public resume unchanged.

**Acceptance**

- A match that moves SQL or the matching role to the front says so, and the full resume is visible.
- A proposed skill that was not on the source resume is not listed as a change.
- The public resume stays the previous version.

---

### Slice AA — Readable match

**Goal:** A job card tells the candidate which resume skills fit and which required skills are missing. Fact Ledger ids stay on the match record.

**Change**

- `presentMatch` builds that view from the existing match. It does not print fact ids or semantic-overlap notes.
- The job card shows “Fits your resume” and “Missing”. The overview uses the same summary on recommended roles.
- A locked explanation stays hidden when the weekly quota is used up.

**Acceptance**

- A match that cites `SKILL-001` does not show that id to the candidate.
- Missing required skills are listed separately from skills that fit.
- The stored explanation still cites ledger ids for the audit path.

---

### Slice AB — Requirements from the role

**Goal:** A pasted title or company line is not a required skill. The match uses the role’s requirement section, including “What you bring” and “Was du mitbringen solltest”.

**Change**

- Field labels are dropped from requirement lists.
- A saved list that is only those labels is rebuilt from the description.
- A catalog list of real skills stays as saved.

**Acceptance**

- “Was du mitbringen solltest” yields Recruiting and Active Sourcing, not “Title:”.
- A product role whose saved skills are Product management and SQL still matches on those skills.

---

### Slice AC — Confirm a missing skill

**Goal:** A missing skill on a job card is only useful if the candidate can confirm it from real experience. That exact skill is saved to the Fact Ledger and the active resume, and the next match counts it.

**Change**

- `confirmListedSkill` accepts a skill only when it is one of this listing’s gaps. The stored spelling is the listing’s spelling.
- `POST /api/jobs/:id/confirm-skill` recomputes the match for the signed-in user and writes the profile, the verified skill fact, and the active resume. Confirming a skill is profile editing, so it stays on every plan.
- The job card shows “I have {skill}” under each shown gap. A locked explanation does not show those buttons.

**Acceptance**

- A skill that is not a gap on that listing is rejected.
- Confirming Roadmapping adds a verified skill fact and the resume skill.
- Confirming the same skill again does not add a second fact.

---

### Slice AD — Put a confirmed skill on the prepared resume

**Goal:** Confirming a missing skill updates the match. If Assisted Apply already saved a resume for that job, that resume still omitted the skill. The prepared resume should include it.

**Change**

- After a skill is confirmed, the application resume for that same job is rebuilt from the updated resume.
- The rebuild only reorders skills, roles, and bullets already on the resume. It does not add a skill the candidate did not confirm.
- The job card keeps showing that saved resume. A job with no prepared resume is unchanged beyond the Fact Ledger and the active resume.

**Acceptance**

- A prepared resume that lacked Data analysis includes it after that skill is confirmed on the job.
- The tailor note does not describe an invented skill.
- A skill that is not on the updated resume is not added.

---

### Slice AE — Put a confirmed skill on every prepared resume

**Goal:** Confirming a skill updates the resume prepared for that job. Other jobs already in the tracker still show the older resume, without the skill.

**Change**

- After a skill is confirmed, every Assisted Apply resume for that candidate is rebuilt from the updated resume.
- Each copy is ordered for its own job. The rebuild does not add a skill the candidate did not confirm.
- A candidate with no prepared resume still only updates the Fact Ledger and the active resume.

**Acceptance**

- Confirming Communication on one listing adds it to every prepared resume for that candidate.
- A skill that is not on the updated resume is not added.
- The public resume stays the active version.

---

### Slice AF — Show confirmed skills without ledger ids

**Goal:** A confirmed skill is stored with a Fact Ledger id. The profile listed that id next to the skill. The candidate should see the skill name.

**Change**

- `presentSkillFacts` builds the profile list from skill facts. It keeps the name, whether the candidate verified it, and confidence. It does not include the ledger id.
- The profile renders that list. A verified skill says Verified. An unverified skill shows its confidence. Employment facts stay off this list.
- Stored facts still keep their ids for matching and audit.

**Acceptance**

- A Communication fact stored as `SKILL-001` appears as Communication · Verified.
- The profile view does not include `SKILL-001`.
- An unverified skill still shows its confidence.

---

### Slice AG — Confirm a high-demand insight gap

**Goal:** Career insights lists skills the catalog asks for and the resume does not have. The note says to add one only if it is true. The candidate could not confirm it from that page.

**Change**

- Each insight gap has “I have {skill}”. The skill must already be one of those gaps. A listing label such as “Title:” is not a gap.
- Confirming it uses the same Fact Ledger write as a job card: the active resume and every prepared resume pick up that skill.
- A skill that insights does not list is rejected.

**Acceptance**

- Confirming Python from the insight gaps stores Python as a verified skill.
- Kubernetes, when it is not a listed gap, is rejected.
- “Title: Recruiter” is not a confirmable gap.

---

### Slice AH — Chart the account and color the scores

**Goal:** Account stats were numbers in boxes, and category outlook scores sat in black pills that were hard to read. The account pages looked flat.

**Change**

- Overview, this week, insights, jobs, and the tracker draw counts as bars and rates as rings. The number stays next to each mark.
- Category outlook is a colored bar plus a tinted score. Green, teal, amber, orange, and rose follow the same bands as match labels.
- Job scores in the account use that same tint. The account background, page header, and active nav item pick up the green and teal already used on the marketing site.

**Acceptance**

- Insights category percentages are colored text on a light tint, with a bar in the same color.
- Overview and insights show a ring or a bar for each stat, with the number still visible.
- The account header and active section are visibly colored.

---

### Slice AI — Show each application on a stage rail

**Goal:** The tracker named the company, the match, and the status in one line. A candidate could not see how far a role had moved.

**Change**

- Each application shows Prepare, Applied, Response, Interview, and Offer. The current stage is marked. Earlier stages are filled. Later stages stay quiet.
- Rejected, Withdrawn, and Skipped show that word on a rose tint. The rail does not pretend those roles reached a later stage.
- A bar chart counts how many roles sit in each stage. The status menu stays, so the candidate can still move a role.

**Acceptance**

- A role in Review required highlights Prepare.
- Moving that role to Interview highlights Interview and fills the earlier stages.
- A rejected role shows Rejected and does not highlight Offer.

---

### Slice AJ — Save a one-tap check-in on each application

**Goal:** After Applied, the employer does not write back. The candidate can say what happened, and that answer stays on the role.

**Change**

- A follow-up reminder offers Still waiting, They replied, Interview, and Rejected.
- Still waiting keeps the stage and asks again in 3 days. The other answers move the stage and are saved in order on the application.
- Rejected closes the reminder. They replied and Interview schedule the next reminder for that role.

**Acceptance**

- Still waiting on an Applied role leaves the status Applied and records “Still waiting”.
- Interview records “Interview” and highlights that stage.
- An answer that is not one of those four is rejected.

---

### Slice AK — Save a note with the check-in on the role

**Goal:** The four answers sit on the follow-up. The candidate looking at the role cannot record what they heard. One sentence they actually heard should stay with the answer.

**Change**

- After a role is applied, the application card offers Still waiting, They replied, Interview, and Rejected.
- An optional note, one sentence, is saved with that answer and shown in the history on the card.
- The same stage and reminder rules apply. A role that is still being prepared does not accept a check-in.

**Acceptance**

- They replied on an Applied role saves the sentence and moves the stage to Responded.
- A note longer than one short sentence is rejected.
- Review required does not accept a check-in.

---

### Slice AL — Save a status-menu change on the application

**Goal:** The four answers stay on the card. Choosing Offer, Hired, Withdrawn, or another stage from the menu does not. That move should stay on the role, and the reminder for the previous stage should close.

**Change**

- Choosing a new status from the tracker menu saves “Moved to {status}” on the application.
- Open reminders that do not match the new stage are marked done. The reminder for the new stage is created when that stage has one.
- Choosing the status the role already has does not add another line.

**Acceptance**

- Moving an Applied role to Interview records “Moved to Interview” and replaces the application follow-up with the interview reminder.
- Moving that role to Withdrawn records the move and leaves no open reminder.
- Choosing Interview again does not add a second line.

---

### Slice AM — Save the submit moment on the application

**Goal:** The card history starts when the candidate later checks in or uses the menu. Marking a prepared role submitted should be the first line.

**Change**

- Assisted Apply, email submit, the extension, and an authorized silent submit save “Submitted” on the application and move the stage to Applied.
- The Applied follow-up is created. Submitting a role that is already Applied does not add another line.
- The delivery sentence already stored on the card stays with that role.

**Acceptance**

- Marking a Review required role submitted records “Submitted” and the status is Applied.
- The application follow-up is open.
- Submitting again does not add a second Submitted line.

---

### Slice AN — Count this week's roles in the tracker charts

**Goal:** The tracker can show only this week's roles, while the glance and stage chart still count every role. Those charts should follow the same filter.

**Change**

- All still counts every role, including kit completion.
- This week counts the roles on the week list: how many moved, and how many are Submitted, Prepared, or Tracked.
- Where your roles are uses those same roles. An empty week says “Nothing moved this week.” and the stage counts are zero.
- The active All or This week tab uses the account green.

**Acceptance**

- All still shows lifetime tracker counts and kit completion.
- This week shows This week, Submitted, Prepared, and Tracked, and the stage chart matches only those roles.
- A week with no roles shows “Nothing moved this week.” and zero stage counts.

---

### Slice AO — Two activity histories

**Goal:** The candidate can see what they have done. An admin can read that same list, and a second list that is detailed enough to finish a step that stopped. A checkout whose payment return never lands is the example: support records it on the manual ledger so the plan still changes.

**Change**

- Account activity records sign-in, profile saves, confirmed skills, tracker moves, submissions, and plan changes. The candidate sees it on Activity. Admin → Users shows the same sentences.
- Operations activity records waiting checkouts and what support did. It is not shown on the candidate page.
- A pending checkout can be recorded on the manual ledger. That applies the plan and writes both histories. It does not mark a card charge as paid. Live card gateways stay off unless `BILLING_LIVE=1`.

**Acceptance**

- The candidate's Activity page and the admin account list show the same sentences.
- Operations rows stay off the candidate page.
- Recording a pending checkout sets the plan, marks the checkout finished on the ledger, and a second record is rejected.

---

### Slice AP — Run every on-disk Node test in CI

**Goal:** Five test files lived under `server/` but were omitted from the `npm test` script, so CI never ran them.

**Change**

- Add `homepage-admin-coverage`, `launch-readiness`, `mfa-policy`, `tracker-statuses`, and `upscale-clarify` to the `test` script in `package.json`.
- Do not change the test bodies. Do not add a frontend suite in this slice.

**Acceptance**

- Every `server/*.test.mjs` file is listed in `npm test`.
- `npm test` and `npm run build` still pass.

---

### Slice AQ — Fail launch readiness on unfinished legal placeholders

**Goal:** Terms and Privacy still ship with `[COMPANY LEGAL NAME]`, privacy/support email blanks, and counsel-draft markers. Admin → Launch did not call that out, so an operator could miss it.

**Change**

- Scan `src/content/terms.ts` and `src/content/privacy.ts` for unfinished bracket fields and counsel-draft markers.
- Add a required `legal_placeholders` check to Admin → Launch. It blocks `opsReady` until those fields are filled.
- Keep the separate counsel process gate. Filling placeholders is not counsel sign-off.
- Document the check on `docs/LAUNCH_CHECKLIST.md`.

**Acceptance**

- With the current draft copy, Admin → Launch shows Legal copy placeholders as Open and `opsReady` is false.
- After those markers are removed from both files, the check passes.
- Counsel review stays Open.

---

### Slice AR — Fail launch readiness on the published default admin password

**Goal:** A production host that first-booted without `ADMIN_PASSWORD` can leave `admin@jobpilot.app` on the published default password. Admin → Launch did not call that out.

**Change**

- Detect when `admin@jobpilot.app` still verifies with the published default password.
- Detect when `server/data/admin-bootstrap.txt` still stores a plaintext password line.
- Add a required `default_admin_password` check to Admin → Launch. It blocks `opsReady` until both are clean.
- Do not print the password in the check detail. Document the check on `docs/LAUNCH_CHECKLIST.md`.

**Acceptance**

- With the default password still active, Admin → Launch shows Default admin password rotated as Open and `opsReady` is false.
- After the password is changed and the bootstrap file no longer stores a plaintext password, the check passes.
- Counsel review stays Open.

---

### Slice AS — Fail launch readiness when Silent Auto-Apply or live billing is on

**Goal:** Beta stays review-first and manual-ledger-only. Admin → Launch did not fail when the Silent Auto-Apply kill switch was on or when `BILLING_LIVE=1` / an enabled live card gateway unlocked live charges.

**Change**

- Add required checks for Silent Auto-Apply off and live card billing off.
- Live billing fails when `BILLING_LIVE=1` or an enabled non-manual gateway is in `live` mode.
- Document both on `docs/LAUNCH_CHECKLIST.md`.

**Acceptance**

- Silent Auto-Apply on → `opsReady` false.
- `BILLING_LIVE=1` or an enabled live Stripe/PayPal gateway → `opsReady` false.
- Defaults (kill switch off, no live env, no live gateways) → both checks Pass.

---

### Slice AT — Require COOKIE_SECURE=1 in production and add deploy smoke

**Goal:** Production could report Secure cookies as OK while relying only on auto `X-Forwarded-Proto`. Public launch should force `COOKIE_SECURE=1`. Operators also needed a one-command post-deploy health check.

**Change**

- When `NODE_ENV=production`, Admin → Launch requires `COOKIE_SECURE=1` for `opsReady`.
- Development still allows auto forwarded-proto cookie mode.
- Add `deploy/smoke.sh` that curls `/api/health` and checks `"ok": true`.
- Point HTTPS notes and the launch checklist at the smoke script.

**Acceptance**

- Production without `COOKIE_SECURE=1` → `opsReady` false.
- Production with `COOKIE_SECURE=1` and other ops green → cookie check Passes.
- `bash deploy/smoke.sh http://127.0.0.1:3000` prints health ok against a running API.

---

### Slice AU — Admin legal entity fields for Terms/Privacy brackets

**Goal:** Operators had to edit `src/content/terms.ts` and `privacy.ts` to clear `[COMPANY LEGAL NAME]` and related brackets. That blocked `opsReady` without a code deploy.

**Change**

- Store company legal name, mailing address, privacy email, and support email in settings.
- Admin → Launch can save them (`admin.launch.write`). Public Terms/Privacy pages apply the fields when rendering.
- Launch `legal_placeholders` scans the resolved copy (source + saved entity). Draft/arbitration markers move to the counsel check detail and no longer block `opsReady` by themselves.
- Operations access level receives `admin.launch.write`.

**Acceptance**

- Empty entity + draft source → company placeholder check Open.
- Saving a complete legal entity → company placeholder check Passes while counsel stays Open and still mentions draft markers.
- `/terms` and `/privacy` show the saved company name and emails.

---

### Slice AV — Fail launch readiness on blank live AI keys

**Goal:** An enabled OpenAI / Anthropic / Google provider with an empty API key fails quietly into deterministic mode. Admin → Launch did not call that out. Career extraction on Built-in rules only is fine for smoke tests but weak for a real beta.

**Change**

- Required check: enabled live providers (and core function assignments to them) must have API keys.
- Recommended check: career extraction should use a live model, not Built-in rules only.
- Document both on `docs/LAUNCH_CHECKLIST.md`.

**Acceptance**

- Enabled OpenAI provider with blank key → `opsReady` false.
- Career extraction on deterministic only → recommended check Open; `opsReady` can still be true.
- Live career extraction with a key → both checks Pass.

---

### Slice AW — Fail launch readiness until SMTP delivers a test

**Goal:** Admin → Launch treated SMTP as ready when a host and from address were saved. Misconfigured credentials still queued resets. Private beta needs proof that outbound mail delivers.

**Change**

- Record the last successful Admin → Email test against the current host, port, and from address.
- Clear that proof when SMTP settings change.
- Required `smtp` check blocks `opsReady` until a successful test exists for the current settings.
- Admin → Email shows whether delivery is proven.

**Acceptance**

- Host + from saved, no test → `opsReady` false; SMTP check mentions Send a test.
- Successful test → SMTP check Passes.
- Changing the SMTP host after a test → proof clears and `opsReady` fails again until retested.

---

### Slice AX — Recommend Backup and restore drill on Launch

**Goal:** Private beta expects a backup restored once onto a non-production directory. Admin → Launch had no signal that the operator ran `deploy/backup.sh` and `deploy/restore.sh`.

**Change**

- `deploy/backup.sh` writes `ops-last-backup.json` into the live data directory (paths and timestamps only).
- `deploy/restore.sh` to a directory other than the live data dir writes `ops-last-restore-drill.json` into the live data directory.
- Recommended Admin → Launch check `backup_drill` Passes when a restore drill is recorded at or after the latest backup.
- Document the markers on `docs/LAUNCH_CHECKLIST.md`.

**Acceptance**

- No markers → recommended check Open; `opsReady` can still be true.
- Backup only → still Open, detail asks for restore onto a non-prod dir.
- Backup then restore to a copy → recommended check Passes.
- Restoring onto the live data dir does not count as a drill.

---

### Slice AY — Recommend account deletion fan-out drill on Launch

**Goal:** The launch checklist asks for a retention / deletion drill on staging. Admin → Launch had no signal that `deleteAccountData` fan-out was exercised.

**Change**

- Add `deploy/deletion-drill.sh`. It creates a throwaway candidate, runs the production deletion fan-out, verifies core tables are empty for that user, and writes `ops-last-deletion-drill.json`.
- Recommended Admin → Launch check `deletion_drill` Passes when that marker exists.
- Document on `docs/LAUNCH_CHECKLIST.md` and `docs/RETENTION_AND_DELETION.md`.

**Acceptance**

- No marker → recommended check Open; `opsReady` can still be true.
- After `deploy/deletion-drill.sh` → recommended check Passes.
- Drill leaves no throwaway user rows behind.

---

### Slice AZ — Recommend AI training attestation on Launch

**Goal:** The launch checklist asks operators to disable training-on-customer-data where vendors allow. Admin → Launch had no place to record that check.

**Change**

- Admin → AI platform switch: attest that training on customer data is disabled where each live vendor allows it.
- Store the attestation timestamp in settings.
- Recommended Admin → Launch check `ai_training` Passes when attested.
- Document on `docs/LAUNCH_CHECKLIST.md` and `docs/AI_GOVERNANCE_CHECKLIST.md`.

**Acceptance**

- No attestation → recommended check Open; `opsReady` can still be true.
- Attest under Admin → AI → recommended check Passes.
- Clearing the attestation reopens the check.

---

## Ops the repo cannot finish

These stay on `docs/LAUNCH_CHECKLIST.md`. Code in slices R and S only makes them executable.

| Gate | Who |
| --- | --- |
| DNS, certbot, port 443, `COOKIE_SECURE=1` | Operator, using `deploy/HTTPS.md` and `deploy/smoke.sh` |
| Admin MFA | Disabled for now. Do not enroll or set `REQUIRE_ADMIN_MFA` until that decision changes |
| SMTP host and from address, then a real test email from Admin → Email | Operator (Slice AW records delivery for `opsReady`) |
| Fill Terms/Privacy company name, address, and contact emails | Operator via Admin → Launch legal entity (Slice AU); draft markers stay for counsel |
| Rotate published default admin password / clear bootstrap secret | Operator (Slice AR detects the default still active) |
| Keep Silent Auto-Apply off and live card billing unlocked only after webhooks | Operator (Slice AS detects unsafe switches) |
| Add live AI API keys / assign career extraction off Built-in rules | Operator, Admin → AI (Slice AV) |
| Backup copy outside the repo, then restore drill onto a non-prod directory | Operator, `deploy/backup.sh` / `deploy/restore.sh` (Slice AX shows the drill on Admin → Launch) |
| Counsel review of legal and Auto-Apply text | Outside counsel |
| Confirm U.S.-first / 18+ copy and no ad cookies | Operator plus counsel |
| TURN only if interview rooms are in the beta | Operator, `deploy/turn.env.example` |
| AI provider training-on-customer-data setting | Operator attests under Admin → AI (Slice AZ); see `docs/AI_GOVERNANCE_CHECKLIST.md` |
| Deletion drill | Operator, `deploy/deletion-drill.sh` (Slice AY shows the drill on Admin → Launch) |

## Done when

Private beta is ready when Q, R, S, T, and U are merged, CI is green, and the operator rows above that apply to this host are checked. Public launch waits on counsel. Admin MFA stays off. Slices V, W, X, Y, Z, AA, AB, AC, AD, AE, AF, AG, AH, AI, AJ, AK, AL, AM, AN, AO, AP, AQ, AR, AS, AT, AU, AV, AW, AX, AY, and AZ are in the product and are not launch gates.
