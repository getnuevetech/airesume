import assert from "node:assert/strict";
import test from "node:test";
import {
  defaultMfaPolicy,
  disableAllMfaPolicy,
  getMfaPolicy,
  mfaRequiredForRole,
  mfaVerifiedFresh,
  mfaWhenForRole,
  normalizeMfaPolicy,
  saveMfaPolicy,
  seedMfaPolicy,
} from "./mfa-policy.mjs";
import { adminMfaRequired } from "./admin-mfa.mjs";
import { migrate, SCHEMA_VERSION } from "./schema.mjs";
import { db } from "./db.mjs";

test("schema 26+ seeds MFA policy settings off by default", () => {
  assert.ok(SCHEMA_VERSION >= 26);
  migrate();
  disableAllMfaPolicy();
  seedMfaPolicy({ NODE_ENV: "production" });
  const policy = getMfaPolicy();
  assert.equal(policy.roles.admin.enabled, false);
  assert.equal(policy.roles.employer.enabled, false);
  assert.equal(policy.roles.user.enabled, false);
  assert.ok(["login", "session"].includes(policy.roles.admin.when));
});

test("MFA policy enable/disable by account type and when", () => {
  migrate();
  saveMfaPolicy({
    roles: {
      admin: { enabled: true, when: "session" },
      employer: { enabled: true, when: "login" },
      user: { enabled: false, when: "login" },
    },
  });
  assert.equal(mfaRequiredForRole("admin", { NODE_ENV: "development" }), true);
  assert.equal(mfaWhenForRole("admin"), "session");
  assert.equal(mfaRequiredForRole("employer"), true);
  assert.equal(mfaWhenForRole("employer"), "login");
  assert.equal(mfaRequiredForRole("user"), false);

  saveMfaPolicy({
    roles: {
      admin: { enabled: false, when: "session" },
      employer: { enabled: false, when: "login" },
      user: { enabled: true, when: "session" },
    },
  });
  assert.equal(mfaRequiredForRole("admin", { NODE_ENV: "production" }), false);
  assert.equal(mfaRequiredForRole("user"), true);
  assert.equal(mfaWhenForRole("user"), "session");
});

test("REQUIRE_ADMIN_MFA env overrides admin policy only", () => {
  migrate();
  saveMfaPolicy({
    roles: {
      admin: { enabled: false, when: "session" },
      employer: { enabled: false, when: "login" },
      user: { enabled: false, when: "login" },
    },
  });
  assert.equal(adminMfaRequired({ REQUIRE_ADMIN_MFA: "1", NODE_ENV: "development" }), true);
  assert.equal(adminMfaRequired({ REQUIRE_ADMIN_MFA: "0", NODE_ENV: "production" }), false);
  assert.equal(mfaRequiredForRole("employer", { REQUIRE_ADMIN_MFA: "1" }), false);
});

test("mfaVerifiedFresh respects login vs session when", () => {
  const now = Date.now();
  assert.equal(mfaVerifiedFresh({ mfa_at: now }, "login"), true);
  assert.equal(mfaVerifiedFresh({ mfa_at: now - 1000 * 60 * 60 * 20 }, "login"), true);
  assert.equal(mfaVerifiedFresh({ mfa_at: now - 1000 * 60 * 60 * 20 }, "session"), false);
  assert.equal(mfaVerifiedFresh({ mfa_at: now - 1000 * 60 * 60 }, "session"), true);
  assert.equal(mfaVerifiedFresh({}, "login"), false);
});

test("normalizeMfaPolicy rejects unknown when values", () => {
  const policy = normalizeMfaPolicy({
    roles: { admin: { enabled: 1, when: "always" }, employer: {}, user: { enabled: true, when: "session" } },
  });
  assert.equal(policy.roles.admin.when, "login");
  assert.equal(policy.roles.admin.enabled, true);
  assert.equal(policy.roles.user.when, "session");
});

test("default MFA policy keeps all roles off until Admin enables them", () => {
  assert.equal(defaultMfaPolicy({ NODE_ENV: "production" }).roles.admin.enabled, false);
  assert.equal(defaultMfaPolicy({ NODE_ENV: "development" }).roles.admin.enabled, false);
  assert.equal(defaultMfaPolicy({ NODE_ENV: "production" }).roles.employer.enabled, false);
  assert.equal(defaultMfaPolicy({ NODE_ENV: "production" }).roles.user.enabled, false);
});
