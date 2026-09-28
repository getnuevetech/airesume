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

### Finish the review-first apply loop

1. Measure AI costs from `ai_audit` and tune Free quotas

### Later

- Browser apply assistant, career intelligence, interview prep
- Employer accounts, candidate search, voice interviews

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
