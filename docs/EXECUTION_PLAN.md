# JobPilot execution plan

JobPilot is an AI job application manager. Quality of applications comes before volume. The fact ledger is the source of truth: AI may rewrite wording, never invent employers, dates, credentials, skills, or numbers.

Spec source of truth for recommendations: `docs/SPEC_REVIEW_AND_PLAN.md` (v1.2 gap review).

## As-built (this repository)

Already live beyond early Phase 1:

- Homepage CMS, email/Google auth, password reset, admin users
- Resume-first onboarding with extraction + claim review + confirm
- Account shell: profile, resume review/upscale/versions, templates, jobs, applications, plan, settings
- Job catalog + JSON/RSS/HTML feeds, verification labels, hybrid match score with explanations
- Requirements JSON on jobs (mandatory/preferred skills, education, years)
- Job-specific resume shaping that reorders existing facts only
- Review-first application tracker + Assisted Apply kit + readiness gates
- Autopilot queues Ready or Review required with daily cap, exclusions, preference checks, and separate Auto-Apply authorization
- Paste-a-job + browser extension capture (MV3 unpacked)
- Application question drafts; salary, sponsorship, authorization, disability, veteran stay blank for the user
- Weekly match explanation / resume review quotas + AI cost audit
- Career insights tied to outcomes; interview prep + voice practice; follow-up reminders
- Employer accounts, pipeline, postings, rooms, analytics, WebRTC signaling + TURN/STUN env config
- Terms + Privacy pack; security headers; rate limits; no AI vendor/model names in customer UI

Default admin on first boot uses `ADMIN_EMAIL` / `ADMIN_PASSWORD` when set. Session cookies set `Secure` when the request is HTTPS (`x-forwarded-proto`) or `COOKIE_SECURE=1`.

## Architecture locked for every later phase

```
Browser (+ optional extension)
  → Express API
      → Candidate, job, and application services
          → Orchestrator
              → Task route (admin AI assignment, not hard-coded vendor)
                  → Producer model
                  → Reviewer model
                  → Rules engine against the fact ledger
```

## Next build sequence (post Slice F)

### Slice G — Conversion landing & activation
1. Spec §53 homepage structure (hero upload, trust strip, how-it-works, match demo, upscale, pricing, final CTA) — **shipped**
2. Activation screen: profile summary + strong-match teaser + missing prefs only — **shipped**

### Slice H — Launch legal & consent
1. Cookie Settings control — **shipped**
2. Billing disclosure versioning — **shipped**
3. Auto-Apply authorization audit surface — **shipped**
4. Internal retention / AI governance / consent checklists — **shipped**

### Slice I — Fact provenance & match depth
1. Confidence + source fact ids on claims — **shipped**
2. User correction flows that affect matching — **shipped**
3. Optional embeddings behind a flag (deterministic gates remain authoritative) — **shipped** (`MATCH_EMBEDDINGS=1`)

### Slice J — Extension autofill assist
1. Field detection + user-triggered fill from apply kit — **shipped**
2. Mark Applied + metrics (no CAPTCHA bypass) — **shipped**

### Slice K — AI Job Coach
1. Outcome-grounded Q&A and next actions (not a generic chatbot) — **shipped**

### Slice L — Production hardening
1. Admin MFA, HTTPS/deploy checks, TURN readiness warnings, deletion fan-out, log hygiene — **shipped**

### Slice M — Launch readiness
1. Consolidated launch checklist (`docs/LAUNCH_CHECKLIST.md`) — **shipped**
2. Admin → Launch live ops panel (`/api/admin/launch-readiness`) — **shipped**
3. Production env example + Chrome Web Store packaging notes (deferred listing) — **shipped**

### Slice N — Tracker outcome statuses
1. Add Employer viewed, Recruiter contact, and Hired to the application tracker — **shipped**
2. Wire follow-up reminders, career insights, interview/voice prep eligibility — **shipped**

### Slice O — Upscale clarification → Fact Ledger
1. Diagnostic clarifications for missing metrics/skills — **shipped**
2. `POST /api/resume/clarify` stores verified ledger facts and unlocks Upscale claims checks — **shipped**
3. Resume UI answer → Save to Fact Ledger loop — **shipped**

### Slice P — Producer/reviewer disagreement reconciliation
1. Rules-based reconciliation when career extraction and career review disagree — **shipped**
2. Keep only resume-supported claims; drop or confirm the rest; attach decision report on extraction — **shipped**

### Done (Slices A–P) — do not reopen unless regressing

Resume extraction/terms upload, OTP/privacy, job intel/readiness, Assisted Apply quality loop, outcomes/interview/follow-ups, extension capture MVP, Auto-Apply auth, TURN env, security headers/rate limits, hide model names, launch readiness panel, richer tracker outcomes, Upscale clarification → Fact Ledger loop, producer/reviewer reconciliation.

### Deferred unless explicitly requested

- Chrome Web Store submission (packaging notes ready in `extension/STORE.md`)
- Managed TURN hosting
- Employer feature expansion
- Salary negotiation / recruiter outreach agents
- SFU media stack

### Shipped on request (post A–P)

- Versioned admin prompt registry with publish/rollback + Admin on/off switch
- Silent Auto-Apply transmit when rules/readiness clear + Admin kill switch (default off)

## Pricing gates (implemented in admin plan matrix)

| Plan | Price | Intent |
| --- | --- | --- |
| Free | $0 | Profile, review, short job list |
| Starter | $7.99/month | Upscale + manual apply |
| Pro | $14.99/month | Full list + more templates |
| Autopilot | $24.99/month | Auto apply when rules clear |

## Local run

```bash
npm install
npm run api
npm run dev
npm test
```

API `:3000`, Vite `:5173`. Production: `npm run build && npm start` behind Nginx (`deploy/bootstrap.sh`).

Optional: `STUN_URIS`, `TURN_URIS`, `TURN_USERNAME`, `TURN_CREDENTIAL` (see `deploy/turn.env.example`). Extension: `extension/README.md`.
