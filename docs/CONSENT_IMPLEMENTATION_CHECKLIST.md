# Consent Implementation Checklist (internal)

Maps Spec §54 consent events to product surfaces.

## Public documents (keep lean)

- [x] Terms of Service — `/terms`
- [x] Privacy & Data Use Policy — `/privacy`
- [x] Cookie Settings control — footer + preference storage (essential always on; analytics opt-in)
- [ ] Counsel sign-off that additional public notices (if any) stay in-product / JIT rather than footer sprawl

## Just-in-time consents

- [x] Resume upload TermsAgreement before extract (`UploadPanel`, `GetStarted`)
- [x] Draft ≠ active until identity confirmation + Terms/Privacy accept
- [x] Auto-Apply separate authorization (`AUTO_APPLY_AUTH_VERSION`)
- [x] Billing disclosure before paid checkout (`BILLING_DISCLOSURE_VERSION`)

## Account controls

- [x] Export my data
- [x] Delete my account
- [x] Correct profile data (Profile)
- [x] Cookie Settings link from Settings → Privacy
- [x] Auto-Apply authorization audit (version + accepted date) in Settings

## Launch gate

- [ ] Outside counsel review of Terms, Privacy, billing, and Auto-Apply text
- [ ] Confirm U.S.-first, 18+ positioning still accurate
- [ ] Confirm no advertising/cross-site cookies enabled without updating Privacy + Cookie Settings
