import assert from "node:assert/strict";
import test from "node:test";
import { computeLaunchReadiness } from "./launch-readiness.mjs";

test("launch readiness fails closed without SMTP and production env; MFA stays informational", () => {
  const report = computeLaunchReadiness({
    env: { NODE_ENV: "development", COOKIE_SECURE: "0", REQUIRE_ADMIN_MFA: "0" },
    mail: { configured: false, host: "", fromEmail: "" },
    ice: { productionReady: false, warning: "TURN missing" },
    adminMfaEnrolled: false,
  });
  assert.equal(report.opsReady, false);
  assert.equal(report.launchReady, false);
  assert.ok(report.checks.some((item) => item.id === "smtp" && !item.ok));
  assert.ok(report.checks.some((item) => item.id === "admin_mfa_policy" && item.ok && item.severity === "info"));
  assert.ok(report.checks.some((item) => item.id === "counsel" && !item.ok));
});

test("launch readiness opsReady when production signals are green (counsel still open)", () => {
  const report = computeLaunchReadiness({
    env: { NODE_ENV: "production", COOKIE_SECURE: "1", REQUIRE_ADMIN_MFA: "1" },
    mail: { configured: true, host: "smtp.example.com", fromEmail: "hello@example.com" },
    ice: { productionReady: true, warning: "" },
    adminMfaEnrolled: true,
  });
  assert.equal(report.opsReady, true);
  assert.equal(report.launchReady, false);
  assert.ok(report.checks.some((item) => item.id === "turn" && item.ok));
  assert.ok(report.checks.some((item) => item.id === "counsel" && !item.ok));
});
