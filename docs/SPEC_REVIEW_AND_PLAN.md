# Spec review, recommendations, and implementation plan

Source: JobPilot Development Specification v1.2 (uploaded September 2026) plus the Terms / Privacy drafts dated September 28, 2026.

This plan is candidate-product focused. Employer-side work is Phase 3 in the spec and is **not** in the active build queue unless explicitly requested.

## Spec alignment recommendations

1. **Keep resume-first onboarding as the conversion core.** The homepage upload card must keep the selected resume when Terms are unchecked, then process only after consent. Draft account ≠ activated account.
2. **Treat extraction quality as a release gate.** Garbled PDF text, wrong identity fields, and contradictory warnings destroy trust on the first screen. Deterministic cleaning + fact rebuild must always win over raw model text.
3. **Fact Ledger before presentation.** Every confirm-screen fact must come from cleaned profile fields, never from unsanitized AI prose (no marital status / DOB dumps unless product explicitly asks).
4. **Public job ingestion without login.** Admin sources should prefer public careers HTML, JSON, and RSS/Atom. Optional tokens only for documented public APIs — not personal job-board passwords.
5. **Legal pack is product behavior, not footer copy.** Publish Terms + Privacy & Data Use as the two public documents; keep resume-upload, billing, and Auto-Apply notices in-product.
6. **Do not expand into employer accounts next.** Spec Phase 3 lists employer search/posting after candidate Assisted Apply, interview prep, and outcome learning are solid.
7. **Activation moment = first strong match, not password create.** After confirm, route users toward matches with missing-preference questions only.
8. **Landing page sections should demo product UI** (match card, readiness, upscale before/after), not brochure grids.

## Implementation plan (ordered)

### Slice A — Trust & onboarding quality (this branch)

- Harden resume text cleaning / corruption detection
- Keep selected resume file until Terms are checked; gate Continue
- Publish Terms + Privacy from the counsel draft pack (with PDF download)
- Admin public HTML/JSON/RSS job sources without requiring login
- Confirm-screen warnings synced to cleaned profile fields

### Slice B — Spec Phase 1 completion (candidate) — in progress / shipping

- Email OTP / magic-link activation (reduce password-first friction)
- Dynamic missing-data interview only for absent preferences
- Stronger Career Fact Reviewer (second model) for extraction
- Draft retention: delete unactivated drafts within ~30 days
- Account > Privacy controls: correct, export, delete resume/account

### Slice C — Job intelligence — shipping

- Normalize all ingested jobs to the shared schema
- Dedicated requirement-extraction AI before matching
- Match labels from thresholds (Strong / Good / Possible / Weak)
- Job authenticity / duplicate flags on ingest
- Application readiness engine gates

### Slice D — Application quality loop

- Review-first Assisted Apply as default
- Application readiness engine gates
- Browser apply kit completion metrics
- Resume version pinned per application

### Slice E — Intelligence & interview (Phase 2)

- Career insights tied to outcomes
- Interview prep + voice practice hardening
- Follow-up reminders
- Browser extension capture (later)

### Explicitly deferred

- Controlled Auto Apply (needs separate authorization UX)
- Employer accounts, candidate search, employer postings
- Voice interview rooms / WebRTC production hardening beyond current experiments

## Acceptance checks for Slice A

- Uploading a resume with Terms unchecked keeps the filename visible and does not clear the file
- Continue stays disabled until Terms are checked
- Garbled PDF tokens never appear as Name / Location facts
- Email found in resume populates the email field when present in cleaned text
- `/terms` and `/privacy` show the uploaded draft content and PDF links
- Admin can add a public HTML careers URL with Access: None and pull listings
