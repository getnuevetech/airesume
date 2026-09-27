# JobPilot execution plan

JobPilot is an AI job application manager. The product finds fitting roles, tailors truthful applications from a verified career profile, and tracks outcomes. Quality of applications comes before volume.

This plan is the build sequence. Phase 1 is in the application now. Later phases stay behind the same API, fact ledger, and provider-independent orchestrator.

## What is live in this build

- Public homepage rendered from a CMS record. Admins edit menu labels, hero copy, hero image, stats, steps, checklist, story portraits and quotes, closing banner, and footer.
- Email accounts, cookie sessions, Google sign-in when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set, and password reset links that last one hour.
- Admin accounts can create users and admins, enable or disable accounts, and issue reset links. An admin cannot demote or disable themselves.
- Resume-first signup. The user uploads a PDF, DOCX, or TXT resume. A career extraction pipeline returns name, email, phone, address, city, summary, skills, employment, and education. A reviewer drops any claim that does not appear in the source text. The user confirms the draft, sets a password, and the account plus fact ledger are stored.
- Dashboard shows the confirmed profile, fact ledger, and a password change form for email accounts.
- AI calls go through `server/ai.mjs` routing and `server/extract.mjs`. Without `OPENAI_API_KEY`, extraction is deterministic. With a key, OpenAI extracts and the same reviewer still rejects unsupported facts. Every extraction is written to `ai_audit`.

Default admin on first boot: `admin@jobpilot.app` / `JobPilot-Admin-2026`, unless `ADMIN_EMAIL` and `ADMIN_PASSWORD` are set before the database is created. The values are written once to `server/data/admin-bootstrap.txt`.

## Architecture locked for every later phase

```
Browser
  → Express API
      → Candidate, job, and application services
          → Orchestrator
              → Task route (config, not hard-coded vendor)
                  → Producer model
                  → Reviewer model
                  → Rules engine against the fact ledger
```

Rules:

1. The fact ledger is the source of truth. Generated resumes are presentations of that ledger.
2. AI may rewrite wording. It may not invent employers, dates, credentials, skills, or numbers.
3. Sensitive answers (work authorization, salary, disability, veteran status, sponsorship) are entered by the user.
4. Prompts are versioned names such as `CAREER_EXTRACTION_V1`, not strings scattered through handlers.
5. Structured JSON moves between pipeline stages. Free text is for the user, not for the next model.
6. Deterministic code handles salary, dates, eligibility, location, and score math. Models handle interpretation and writing.

Provider routing lives in environment configuration (`AI_EXTRACT_PROVIDER`, `AI_REVIEW_PROVIDER`, `OPENAI_API_KEY`, `OPENAI_EXTRACT_MODEL`). Adding Anthropic or Gemini means a new provider module and a config change, not a rewrite of the product.

## Phase 1 — accounts, CMS, career profile

Done in this repository.

| Area | Delivered |
| --- | --- |
| Homepage CMS | `settings.homepage`, public `GET /api/content/homepage`, admin `PUT /api/admin/homepage`, image upload |
| Identity | Login, logout, Google OAuth, forgot/reset password, admin user and admin management |
| Onboarding | `POST /api/onboarding/extract`, confirm screen, `POST /api/onboarding/activate` |
| Profile | `profiles` table, fact ledger JSON, `GET /api/profile` |
| Audit | `ai_audit` for extraction runs |

## Phase 2 — jobs, match score, job-specific resume

Build next. No auto-apply.

1. Job schema: company, title, location, remote type, employment type, salary range, description, requirements, source URL, source type, detected and verified dates.
2. Ingestion from licensed APIs, public ATS feeds, and user-pasted job URLs. Do not make unrestricted scraping the foundation.
3. Requirement extractor returns mandatory skills, preferred skills, education, and years as JSON.
4. Match score is hybrid: deterministic weights (core experience 25, required skills 25, role similarity 15, industry 10, education 10, location 5, salary 5, preferred skills 5) plus a reasoning model that explains the score. Labels come from thresholds: strong, good, possible, weak, not recommended.
5. Resume strategy, writer, and validator. The validator fails any sentence that is not supported by a fact id. The user reviews before anything is saved as a version.
6. Application question drafts, with legal and salary fields left blank for the user.
7. Application tracker statuses: found, reviewed, skipped, resume preparing, ready, applied, and the later interview and offer states.

## Phase 3 — assisted apply and intelligence

- Browser assistant that detects a posting, imports it, and fills fields the user confirms.
- Career intelligence over viewed, applied, and response history.
- Interview preparation once a tracker row reaches interview.
- Job quality labels: employer verified, possible duplicate, staffing repost, listing may be expired.

## Phase 4 — controlled autopilot

Only after the review-first path is solid. A job is eligible when every user rule passes: minimum match, salary, locations, employment type, exclusions, and a daily cap. Any validator uncertainty moves the row to review required. It is never submitted on a guess.

Employer accounts, candidate search, and voice interviews stay after the candidate product is working.

## Pricing to implement with Phase 2 limits

| Plan | Price | Gate |
| --- | --- | --- |
| Free | $0 | Profile, basic resume, 5 match explanations per week |
| Starter | $7.99/month | Resume upscale and a higher match allowance |
| Pro | $14.99/month | Job-specific resumes and application tracking |
| Autopilot | $24.99/month | Assisted apply rules and interview prep |

Annual Pro at $99 is the planned yearly offer. Exact AI quotas should be set after extraction and writing costs are measured from `ai_audit`.

## API contracts already in use

- `GET /api/health`
- `GET /api/content/homepage`
- `GET /api/auth/me`
- `POST /api/auth/login` `{ email, password }`
- `POST /api/auth/logout`
- `POST /api/auth/forgot-password` `{ email }` → `{ ok, message, devLink }`
- `POST /api/auth/reset-password` `{ token, password }`
- `GET /api/auth/google` and `GET /api/auth/google/callback`
- `POST /api/onboarding/extract` multipart field `resume`
- `POST /api/onboarding/activate` `{ draftId, name, email, phone, address, city, summary, password, salary, workArrangement, locations, workAuthorization, consent }`
- `GET /api/profile`
- `POST /api/account/password` `{ current, password }`
- Admin: homepage get/put, upload, users list/create/patch, reset link, outbox, audit

## Local and Lightsail run

Development needs two processes: `npm run api` on port 3000 and `npm run dev` on port 5173. Vite proxies `/api` and `/uploads`.

Production is one Node process (`NODE_ENV=production`) behind Nginx. `deploy/bootstrap.sh` installs Node 22, builds the client, writes a systemd unit, and proxies port 80 to port 3000. Resume uploads need the 12 MB Nginx body limit already in `deploy/nginx.jobpilot.conf`.

Optional environment:

- `ADMIN_EMAIL`, `ADMIN_PASSWORD` before the first database create
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `OPENAI_API_KEY`, `OPENAI_EXTRACT_MODEL`
- `SMTP_HOST` when reset links should be emailed instead of shown to the requester and stored in the admin outbox
