import assert from "node:assert/strict";
import test from "node:test";
import {
  BILLING_DISCLOSURE_VERSION,
  billingDisclosurePayload,
  validateBillingDisclosure,
} from "./billing-disclosure.mjs";
import { AUTO_APPLY_AUTH_VERSION, validateAutoApplyEnable } from "./auto-apply-auth.mjs";

test("billing disclosure blocks paid checkout without acceptance", () => {
  const blocked = validateBillingDisclosure({
    acceptDisclosure: false,
    user: {},
    amountCents: 1499,
    planMonthlyCents: 1499,
  });
  assert.equal(blocked.ok, false);
  const accepted = validateBillingDisclosure({
    acceptDisclosure: true,
    user: {},
    amountCents: 1499,
    planMonthlyCents: 1499,
  });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.record, true);
  const free = validateBillingDisclosure({
    acceptDisclosure: false,
    user: {},
    amountCents: 0,
    planMonthlyCents: 0,
  });
  assert.equal(free.ok, true);
  assert.equal(free.record, false);
});

test("billing disclosure payload requires current version", () => {
  const stale = billingDisclosurePayload({
    billing_disclosure_accepted_at: Date.now(),
    billing_disclosure_version: "old",
  });
  assert.equal(stale.accepted, false);
  assert.equal(stale.version, BILLING_DISCLOSURE_VERSION);
  const current = billingDisclosurePayload({
    billing_disclosure_accepted_at: Date.now(),
    billing_disclosure_version: BILLING_DISCLOSURE_VERSION,
  });
  assert.equal(current.accepted, true);
});

test("auto-apply still requires separate authorization", () => {
  const blocked = validateAutoApplyEnable({ enabled: true, acceptAuthorization: false, user: {} });
  assert.equal(blocked.ok, false);
  const ok = validateAutoApplyEnable({
    enabled: true,
    acceptAuthorization: true,
    user: {},
  });
  assert.equal(ok.ok, true);
  assert.equal(AUTO_APPLY_AUTH_VERSION.length > 0, true);
});
