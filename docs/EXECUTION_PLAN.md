# JobPilot execution plan

JobPilot is an AI job application manager. Quality of applications comes before volume. The fact ledger is the source of truth: AI may rewrite wording, never invent employers, dates, credentials, skills, or numbers.

## As-built (this repository)

Already live beyond early Phase 1:

- Homepage CMS, email/Google auth, password reset, admin users
- Resume-first onboarding with extraction + claim review + confirm
- Account shell: profile, resume review/upscale/versions, templates, jobs, applications, plan, settings
- Job catalog + JSON/RSS feeds, verification labels, hybrid match score with explanations
- Requirements JSON on jobs (mandatory/preferred skills, education, years)
- Job-specific resume shaping that reorders existing facts only
- Review-first application tracker: Found → Reviewed → Skipped → Resume preparing → Ready → Review required → Applied…
- Manual Prepare/Track from Jobs; Submit only from Ready / Review required
- Autopilot queues Ready or Review required with daily cap, exclusions, and preference checks — never submits blindly
- Paste-a-job (URL or description) with stronger requirement extraction
- Application question drafts; salary, sponsorship, authorization, disability, veteran stay blank for the user
- Weekly match explanation quotas (`match_explain_limit`; Free=5/week)
- Weekly resume review quotas (`resume_review_limit`; Free=3/week)
- AI audit cost estimates (`cost_micros`) with admin rollups
- Browser apply assistant: copy-ready apply kit + mark Applied after employer-site submit
- Career insights: demand, gaps, category outlook, and focus tips from catalog + profile facts
- Interview prep: STAR drafts and talking points from resume bullets for tracked applications
- Voice practice: speak or type answers to prep prompts with fact-safe coaching
- Employer accounts with public-candidate search
- Employer hiring pipeline: save public candidates and move Saved → Hired/Passed
- Live employer voice interviews with join codes and fact-safe answer scoring
- Employer job postings into the catalog plus outbound invites to public candidates
- Multi-party interview rooms with host/interviewer/candidate links and shared live transcript
- Employer analytics funnel plus configurable SLA breach workflows
- Realtime WebRTC audio in interview rooms via HTTP-polled signaling
- Billing, resume, applications, jobs-admin, dashboard, profile, admin AI, and admin plans routes extracted from `platform.mjs`
- Plans, Stripe/PayPal/manual billing hooks, AI provider admin, public `/resume/:slug`

Default admin on first boot uses `ADMIN_EMAIL` / `ADMIN_PASSWORD` when set. Without `ADMIN_PASSWORD`, bootstrap credentials force a password change on first sign-in. Session cookies set `Secure` when the request is HTTPS (`x-forwarded-proto`) or `COOKIE_SECURE=1`.

## Architecture locked for every later phase

```
Browser
  → Express API
      → Candidate, job, and application services
          → Orchestrator
              → Task route (admin AI assignment, not hard-coded vendor)
                  → Producer model
                  → Reviewer model
                  → Rules engine against the fact ledger
```

## Next build sequence

### Done in recent slices

1. Schema migrate order + `schema_version` + smoke tests
2. Force bootstrap password change + Secure cookies
3. Hybrid match + requirements + fact-safe tailor
4. Review-first tracker + autopilot safety rules
5. Paste-a-job + application question drafts
6. Weekly match explanation quotas + billing/resume route split
7. Full `platform.mjs` route modularization (applications, jobs-admin, dashboard, profile, admin AI/plans)
8. AI cost measurement from `ai_audit` + Free resume-review weekly quota
9. Browser apply assistant (apply kit + employer-site complete)
10. Career intelligence insights (demand, gaps, focus)
11. Interview prep packs for tracked applications
12. Voice practice sessions with fact-safe answer coaching
13. Resume extraction cleaning + terms-gated upload without dismissing the file
14. Public HTML/JSON/RSS job ingest without source login
15. Published Terms + Privacy draft pack on `/terms` and `/privacy`

### Active next (candidate product — see `docs/SPEC_REVIEW_AND_PLAN.md`)

1. ~~Email OTP / magic-link activation~~ (done on `cursor/onboarding-otp-privacy-b068`)
2. ~~Missing-preference interview after resume confirm~~
3. ~~Draft retention / deletion for unactivated uploads~~
4. ~~Account privacy controls (export / delete)~~
5. ~~Stronger second-model career fact review~~
6. ~~Shared job schema + authenticity/duplicate flags~~ (done on `cursor/job-intel-readiness-b068`)
7. ~~Requirement-extraction AI before matching~~
8. ~~Threshold match labels (Strong / Good / Possible / Weak)~~
9. ~~Application readiness engine gates~~
10. ~~Review-first Assisted Apply as default~~ (done on `cursor/apply-quality-loop-b068`)
11. ~~Browser apply kit completion metrics~~
12. ~~Resume version pinned per application~~
13. ~~Career insights tied to outcomes~~ (done on `cursor/outcome-followups-b068`)
14. ~~Interview prep + voice practice hardening~~
15. ~~Follow-up reminders~~

Next after Slice E:
1. ~~Browser extension capture~~ (done on `cursor/extension-autoapply-webrtc-b068`)
2. ~~Controlled Auto Apply authorization UX~~
3. ~~Employer / WebRTC TURN production hardening~~
4. ~~End-to-end polish + security headers / rate limits~~

### Deferred unless explicitly requested

- Store-packaged browser extension distribution
- Managed hosted TURN provisioning beyond env configuration

### Later

- Additional media SFU options beyond peer WebRTC + TURN

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
