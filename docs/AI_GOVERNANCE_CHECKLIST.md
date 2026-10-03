# AI Governance Checklist (internal)

Pre-launch and ongoing checks for JobPilot multi-AI use.

## Non-fabrication

- [ ] Fact Ledger remains source of truth for high-impact claims
- [ ] Resume Upscale / tailor paths reject unsupported numbers and employers
- [ ] Sensitive fields (authorization, sponsorship, disability, veteran, salary when unset) stay blank unless user-provided
- [ ] Customer UI never shows AI vendor or model names

## Pipeline controls

- [ ] Admin AI routing assigns provider by function (not hard-coded in UI copy)
- [ ] Produce → review used for extraction and resume verify
- [ ] Cost audit rows capture function, provider, model, status (admin-only)
- [ ] Prompt/model version changes are logged or config-versioned when possible

## Provider contracts

- [ ] Training-on-customer-data disabled where the provider allows — attest under Admin → AI (recorded for Admin → Launch)
- [ ] No sale of resume/application data for advertising
- [ ] Failover path documented when a provider is unavailable

## Human control

- [ ] Assisted Apply is review-first by default
- [ ] Auto-Apply requires separate authorization version + timestamp
- [ ] Disabling Auto-Apply stops future automated queueing promptly
