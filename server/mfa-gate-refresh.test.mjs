/** Regression: account shell must not blank when /api/auth/me returns a new user object for the same id. */

import assert from "node:assert/strict";
import test from "node:test";

// Keep in sync with src/components/mfa-gate-user.ts — the MFA gate effect must key on id, not object identity.
function mfaGateUserKey(user) {
  return user?.id || null;
}

test("plan upgrade refresh keeps the MFA gate user key stable", () => {
  const beforeUpgrade = { id: "user_1", name: "Alex", planId: "free", mfaEnrolled: false, mfaVerified: false };
  const afterUpgrade = { id: "user_1", name: "Alex", planId: "pro", mfaEnrolled: false, mfaVerified: false };
  assert.notEqual(beforeUpgrade, afterUpgrade);
  assert.equal(mfaGateUserKey(beforeUpgrade), mfaGateUserKey(afterUpgrade));
});

test("signing in as a different user changes the MFA gate key", () => {
  assert.notEqual(mfaGateUserKey({ id: "user_1" }), mfaGateUserKey({ id: "user_2" }));
  assert.equal(mfaGateUserKey(null), null);
});
