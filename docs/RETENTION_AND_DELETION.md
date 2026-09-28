# Data Retention & Deletion Standard (internal)

Operational checklist for JobPilot personal-data retention. Not a public policy.

## Retention targets

| Data | Target | Notes |
| --- | --- | --- |
| Unactivated resume drafts | ≤ 30 days | Purge or de-identify; keep limited fraud logs only |
| Active account profile / Fact Ledger | While account active + short grace | User can export or delete anytime |
| Application tracker / resume versions | While account active | Tied to deletion fan-out |
| Extension tokens | Until revoked or account delete | Hash-only storage |
| AI audit rows | Operational window (cost/debug) | No raw resume bodies in logs |
| Billing events / disclosure acceptances | Legal/accounting retention | Keep version + timestamp |

## Deletion fan-out (account delete)

Confirm these clear on `POST /api/account/delete`:

- [x] `users`, sessions, password resets
- [x] profiles, facts, resume versions
- [x] profile photo files under `/uploads`
- [x] applications, checkouts, subscriptions, billing events
- [x] extension tokens, email activations / drafts
- [x] employer-linked candidate artifacts if any
- [ ] Object storage / future vector indexes when introduced

## Launch gate

Counsel must confirm retention windows and deletion fan-out before public personal-data scale.
