# Spec review, recommendations, and execution plan

Source: JobPilot Development Specification v1.2 (uploaded September 2026) reviewed against the as-built repository on `main` (through PR #32).

## Verdict

JobPilot already implements most of **Phase 1**, large parts of **Phase 2**, and several **Phase 3** surfaces (Auto-Apply auth, employer accounts, voice rooms). The remaining gap is not “build the product from scratch” — it is **product depth, conversion UX, AI maturity, and launch-grade legal/ops**.

Positioning remains correct: **AI Job Application Manager**, not a resume writer or job board.

## Spec vs as-built (summary)

| Spec area | Status | Notes |
| --- | --- | --- |
| Resume-first onboarding + draft ≠ active | **Done** | Terms-gated upload, OTP/magic-link, missing prefs, 30-day draft purge |
| Fact Ledger + non-fabrication | **Mostly done** | Extraction review + claim checks; provenance/confidence JSON incomplete |
| Multi-AI provider abstraction | **Done** | Admin AI pipelines by function; cost audit |
| Produce → review → rules | **Partial** | Extraction + resume verify exist; disagreement reconciliation missing |
| Job ingest / normalize / requirements | **Done** | Schema normalize, requirements AI, authenticity/duplicates |
| Hybrid match + threshold labels | **Partial** | Deterministic + hybrid weights; embeddings / reasoning layer thin |
| Assisted Apply + readiness | **Done** | Kit, readiness gates, pinned versions, metrics |
| Browser extension | **MVP done** | Capture/import; autofill assist still light |
| Controlled Auto Apply | **Auth + queue done** | Queues for review; does not silently submit (correct) |
| Career intelligence + coach | **Partial** | Outcome insights shipped; conversational Job Coach missing |
| Interview prep + voice | **Done (MVP)** | Prep packs + voice practice; company-context depth limited |
| Tracker statuses | **Partial** | Core statuses live; Employer Viewed / Recruiter Contact / Hired thinner |
| Landing conversion UX (§53) | **Gap** | Homepage exists; product-demo sections and activation copy need rebuild |
| Legal pack (§54 + Legal Doc Arch v2) | **Partial** | Terms + Privacy published; several required notices/pages still missing |
| Employer Phase 3 | **Shipped early** | Search, pipeline, postings, rooms — keep maintenance-only unless asked |

## Recommendations (priority order)

1. **Treat landing + activation as the next conversion gate.** Spec §53 says the homepage is the first product step. Current site is closer to brochure + upload. Rebuild hero, trust strip, How it works, match demo, upscale before/after, and final CTA around real UI.
2. **Close the legal/compliance product gaps before public launch.** Keep two public docs (Terms, Privacy). Add just-in-time notices already partially present, plus Cookie Settings, billing disclosure hardening, Auto-Apply acknowledgment surface, and internal retention/AI governance checklists as docs+code hooks.
3. **Deepen Fact Ledger provenance.** Spec requires confidence + `source_fact_ids` on high-impact claims. Today facts exist; wire provenance into match explanations, tailored bullets, and user correction flows.
4. **Finish Assisted Apply → autofill loop.** Extension captures jobs; next is field detection + fill assist + record Applied, without bypassing CAPTCHA/auth walls (per Terms).
5. **Add AI Job Coach as outcome-aware Q&A.** Spec §25 — not a generic chatbot. Ground answers in profile, applications, outcomes, and gaps already computed by career insights.
6. **Do not prioritize employer expansion.** Spec Phase 3 employer work is already ahead of many candidate gaps. Freeze employer features unless explicitly requested; invest in candidate conversion and quality.
7. **Keep Auto Apply review-first.** Spec safety gate says SUBMIT or REVIEW REQUIRED. Current queue-to-review behavior matches quality-over-volume. Only add true silent submit after counsel + stronger logs.
8. **Production ops checklist is part of the plan.** HTTPS, MFA for admin, TURN credentials, SMTP, `COOKIE_SECURE`, no raw resumes in logs, deletion fan-out.

## Gap detail (what still hurts)

### Conversion & UX
- Activation screen still undersells “we found matches — finish prefs to unlock strongest fits.”
- Landing lacks product panels for match card, readiness, and upscale before/after.
- Dashboard tiles are useful but not yet the “weekly efficiency” story from the spec.

### AI maturity
- No embeddings-based semantic match layer.
- No reconciliation model when producer/reviewer disagree.
- Prompt registry is code-embedded, not a versioned admin registry with rollback.
- Resume Upscale diagnostic → clarification question → Fact Ledger update loop is incomplete.

### Application loop
- Extension does not yet detect form fields or assist fill.
- Tracker lacks richer employer-side signals (viewed / recruiter contact / hired).
- Auto Apply logs exist via applications/delivery but need an explicit authorization+submission audit view for the user.

### Legal / privacy / security (launch)
- Missing or incomplete public/JIT surfaces: Cookie Settings control, dedicated Resume Data & AI Processing notice (may be covered inside Privacy — verify counsel), Subscription & Billing Terms disclosure versioning, Acceptable Use / Job Listings disclaimer as needed by Legal Doc Arch v2.
- Admin MFA not enforced.
- Encryption-at-rest / deletion fan-out to object storage & vector stores not fully specified in code (SQLite-first today).

## Execution plan (next)

### Slice G — Conversion landing & activation (candidate)

**Goal:** Homepage and post-upload activation match spec §5 / §53.

- Rebuild hero: 55/45 message + upload card; trust strip under hero
- How it works (4 steps), Right Job Fit demo card, Upscale before/after, Efficiency/results, Pricing, final upload CTA
- Post-confirm activation: profile summary + “strong matches waiting” + missing-prefs only
- Keep Terms gate on upload; no AI vendor/model names in customer copy

**Acceptance**
- First viewport reads as JobPilot (brand + upload), not a generic SaaS brochure
- Mobile shows upload card immediately under headline
- After confirm, user sees match teaser before password-style friction

### Slice H — Launch legal & consent completeness

**Goal:** Spec §54 + Legal Document Architecture v2.

- Cookie Settings control (footer) + preference storage
- Harden recurring-billing disclosure (price, frequency, renewal, cancel path) with accepted-version timestamp
- Surface Auto-Apply authorization text/version in Settings for audit
- Account > Privacy: confirm correct / export / delete / cookie link
- Add internal docs: retention standard, AI governance checklist, consent implementation checklist
- Counsel-review gate before public launch (process, not code)

**Acceptance**
- Footer: Terms | Privacy | Cookie Settings only (no policy sprawl)
- Enabling Auto-Apply without authorization fails; accepted version stored
- Billing checkout shows renewal/cancel disclosure before charge

### Slice I — Fact provenance & match depth

**Goal:** Spec §§7, 16–17, 32.

- Attach `confidence` + `source_fact_ids` to extracted skills/achievements where available
- User correction of facts that affect matching
- Stronger match explanation using ledger sources (still no invented claims)
- Optional lightweight embeddings similarity behind feature flag (deterministic remains source of truth for gates)

**Acceptance**
- Match “why” cites resume facts/ids, not free prose
- Editing a skill updates subsequent match explanations
- Low-confidence inferred skills never appear as verified

### Slice J — Extension autofill assist

**Goal:** Spec §§21, 41.

- Detect common application fields on supported hosts
- Propose fills from apply kit (contact, answers, resume text)
- Explicit user click to fill; never bypass CAPTCHA/login
- Mark Applied + store capture metrics

**Acceptance**
- On a sample public form, extension fills name/email from kit after user action
- Sensitive fields stay blank unless user typed them
- Capture → prepare → fill → mark Applied works end-to-end

### Slice K — AI Job Coach + outcome loop

**Goal:** Spec §§24–25.

- Coach answers grounded in profile, tracker, readiness, and outcome insights
- Suggested next actions (follow-up due, prep coverage, gaps)
- No generic career advice disconnected from ledger

**Acceptance**
- “Why am I not getting interviews?” returns tracker/outcome-based answer
- Coach never invents employers, metrics, or skills

### Slice L — Production hardening (ops)

**Goal:** Spec §54 production security + Appendix A ops.

- Enforce HTTPS upload path in deploy docs/nginx
- Admin MFA (TOTP) for privileged accounts
- TURN credentials required warning when rooms used without TURN
- Audit that resumes/tokens/passwords are not logged
- Deletion checklist covering DB + uploads

**Acceptance**
- Admin without MFA cannot reach `/admin` in production mode
- Room RTC config reports `productionReady` when TURN set
- Account delete removes uploads and extension tokens

## Explicitly out of next queue

- Employer feature expansion
- Silent Auto Apply submit without review
- Chrome Web Store distribution (keep unpacked until autofill quality is proven)
- Salary negotiation assistant / recruiter outreach agent
- Full SFU media stack

## Suggested build order

```
G Conversion landing/activation
  → H Legal/consent launch pack
    → I Fact provenance + match depth
      → J Extension autofill
        → K Job Coach
          → L Production hardening
```

Ship G+H before major acquisition spend. Ship I before promising “verified intelligence” in marketing. Ship L before production personal-data scale.

## Pricing (unchanged hypothesis)

| Plan | Price | Role |
| --- | --- | --- |
| Free | $0 | Profile, review, limited matches |
| Starter | $7.99/mo | Upscale + manual/Assisted Apply |
| Pro | $14.99/mo | Full list, templates, analytics |
| Autopilot | $24.99/mo | Controlled Auto-Apply + advanced intel |

Validate against real AI + job-data cost after Slice I/J usage metrics exist.

## Appendix — already shipped (do not rebuild)

Slices A–F on `main`: extraction quality, legal Terms/Privacy, OTP/privacy controls, job schema/authenticity/requirements, readiness, Assisted Apply defaults, kit metrics, pinned resumes, outcome insights, interview/voice hardening, follow-ups, extension capture MVP, Auto-Apply authorization UX, TURN env wiring, security headers/rate limits, hide AI model names from customers.
