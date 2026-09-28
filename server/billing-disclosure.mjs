/** Recurring billing disclosure text and acceptance helpers. */

export const BILLING_DISCLOSURE_VERSION = "2026-09-28";

export const BILLING_DISCLOSURE_TEXT = `By continuing, you authorize JobPilot to charge the selected plan price in USD on the chosen billing frequency (monthly or yearly). Paid plans renew automatically at the then-current price until you cancel. Cancel anytime in Account → Plan; cancellation stops future renewals and takes effect at the end of the current paid period. Trials, if offered, convert to paid billing unless canceled before the trial ends. You will see the exact amount before payment is collected.`;

export function billingDisclosurePayload(user = {}) {
  const acceptedAt = Number(user.billing_disclosure_accepted_at || 0) || null;
  const version = String(user.billing_disclosure_version || "");
  const accepted = Boolean(acceptedAt) && version === BILLING_DISCLOSURE_VERSION;
  return {
    version: BILLING_DISCLOSURE_VERSION,
    text: BILLING_DISCLOSURE_TEXT,
    accepted,
    acceptedAt,
    currentVersion: version || null,
  };
}

export function validateBillingDisclosure({ acceptDisclosure, user, amountCents = 0, planMonthlyCents = 0 }) {
  const paid = Number(amountCents) > 0 || Number(planMonthlyCents) > 0;
  if (!paid) return { ok: true, record: false };
  const existing = billingDisclosurePayload(user);
  if (existing.accepted) return { ok: true, record: false };
  if (!acceptDisclosure) {
    return {
      ok: false,
      error: "Accept the subscription and billing terms before checkout.",
    };
  }
  return { ok: true, record: true };
}

export function recordBillingDisclosure(db, userId, now = Date.now()) {
  db.prepare(
    "UPDATE users SET billing_disclosure_accepted_at = ?, billing_disclosure_version = ? WHERE id = ?",
  ).run(now, BILLING_DISCLOSURE_VERSION, userId);
}
