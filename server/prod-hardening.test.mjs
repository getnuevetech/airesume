import assert from "node:assert/strict";
import test from "node:test";
import {
  adminMfaRequired,
  generateTotpCode,
  generateTotpSecret,
  verifyTotpCode,
} from "./admin-mfa.mjs";
import { assertNoSecrets, redactSensitive } from "./security-redact.mjs";
import { iceConfigSummary, resolveIceServers } from "./webrtc-signaling.mjs";
import { migrate, SCHEMA_VERSION } from "./schema.mjs";
import { db } from "./db.mjs";

test("schema version includes admin MFA and homepage CTA patches", () => {
  assert.ok(SCHEMA_VERSION >= 24);
  migrate();
  assert.ok(db.prepare("PRAGMA table_info(users)").all().some((column) => column.name === "totp_secret"));
  assert.ok(db.prepare("PRAGMA table_info(sessions)").all().some((column) => column.name === "mfa_at"));
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ai_prompt_versions'").get());
});

test("admin MFA required in production unless explicitly disabled", () => {
  assert.equal(adminMfaRequired({ NODE_ENV: "production" }), true);
  assert.equal(adminMfaRequired({ NODE_ENV: "production", REQUIRE_ADMIN_MFA: "0" }), false);
  assert.equal(adminMfaRequired({ NODE_ENV: "development", REQUIRE_ADMIN_MFA: "1" }), true);
  assert.equal(adminMfaRequired({ NODE_ENV: "development" }), false);
});

test("totp generate and verify round-trip", () => {
  const secret = generateTotpSecret();
  const code = generateTotpCode(secret);
  assert.equal(verifyTotpCode(secret, code), true);
  assert.equal(verifyTotpCode(secret, "000000"), false);
});

test("redactSensitive strips passwords tokens and long resumes", () => {
  const redacted = redactSensitive("password=hunter2 token=jpxt_abc123 Authorization: Bearer xyz");
  assert.match(redacted, /\[REDACTED\]/);
  assert.doesNotThrow(() => assertNoSecrets(redacted));
  assert.throws(() => assertNoSecrets("password=hunter2"));
});

test("TURN warning surfaces when productionReady is false", () => {
  const summary = iceConfigSummary(resolveIceServers({}));
  assert.equal(summary.productionReady, false);
  assert.match(summary.warning || "", /TURN/i);
});
