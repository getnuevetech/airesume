/** Aggregate production launch readiness signals for Admin (no secrets). */

import { mfaRequiredForRole, getMfaPolicy } from "./mfa-policy.mjs";
import { publicMailSettings } from "./mail.mjs";
import { iceConfigSummary, resolveIceServers } from "./webrtc-signaling.mjs";
import { db } from "./db.mjs";
import { repoRootFromHere, scanLegalPlaceholders } from "./legal-placeholders.mjs";
import { defaultAdminPasswordStatus } from "./default-admin-password.mjs";
import { betaSafetyStatus } from "./beta-safety.mjs";

function cookieSecureMode(env = process.env) {
  if (String(env.COOKIE_SECURE || "") === "1") return "forced_on";
  if (String(env.COOKIE_SECURE || "") === "0") return "forced_off";
  return "auto_forwarded_proto";
}

function check(id, label, ok, detail, severity = "required") {
  return { id, label, ok: Boolean(ok), detail, severity };
}

/**
 * @param {object} [options]
 * @param {NodeJS.ProcessEnv} [options.env]
 * @param {{ host?: string, configured?: boolean, fromEmail?: string } | null} [options.mail]
 * @param {ReturnType<typeof iceConfigSummary> | null} [options.ice]
 * @param {boolean} [options.adminMfaEnrolled]
 * @param {ReturnType<typeof scanLegalPlaceholders> | null} [options.legal]
 * @param {ReturnType<typeof defaultAdminPasswordStatus> | null} [options.defaultAdmin]
 * @param {ReturnType<typeof betaSafetyStatus> | null} [options.betaSafety]
 * @param {string} [options.rootDir]
 */
export function computeLaunchReadiness(options = {}) {
  const env = options.env || process.env;
  const mail = options.mail || publicMailSettings();
  const ice = options.ice || iceConfigSummary(resolveIceServers(env));
  const legal =
    options.legal ||
    scanLegalPlaceholders(options.rootDir || repoRootFromHere());
  const defaultAdmin = options.defaultAdmin || defaultAdminPasswordStatus();
  const betaSafety = options.betaSafety || betaSafetyStatus({ env });
  const nodeEnv = String(env.NODE_ENV || "development");
  const production = nodeEnv === "production";
  const mfaRequired = mfaRequiredForRole("admin", env);
  const policy = (() => {
    try {
      return getMfaPolicy(env);
    } catch {
      return null;
    }
  })();
  const adminWhen = policy?.roles?.admin?.when || "session";
  const adminMfaEnrolled =
    typeof options.adminMfaEnrolled === "boolean"
      ? options.adminMfaEnrolled
      : Boolean(
          db
            .prepare("SELECT 1 AS ok FROM users WHERE role = 'admin' AND totp_secret != '' AND totp_enabled_at IS NOT NULL LIMIT 1")
            .get()?.ok,
        );

  const checks = [
    check(
      "node_env",
      "NODE_ENV=production",
      production,
      production ? "Running in production mode." : `Currently "${nodeEnv || "development"}". Set NODE_ENV=production for launch.`,
      "required",
    ),
    check(
      "cookie_secure",
      "Secure session cookies",
      production ? cookieSecureMode(env) === "forced_on" : cookieSecureMode(env) !== "forced_off",
      cookieSecureMode(env) === "forced_on"
        ? "COOKIE_SECURE=1 is set."
        : cookieSecureMode(env) === "forced_off"
          ? "COOKIE_SECURE=0 disables Secure cookies — turn this off before HTTPS launch."
          : production
            ? "Production launch requires COOKIE_SECURE=1 after HTTPS is terminated at nginx."
            : "Cookies use Secure when X-Forwarded-Proto is https (or set COOKIE_SECURE=1).",
      "required",
    ),
    check(
      "admin_mfa_policy",
      "Admin MFA policy",
      true,
      mfaRequired
        ? `Admin MFA is required (${adminWhen === "session" ? "re-verify every 12 hours" : "at every sign-in"}). It is disabled by default for now.`
        : "Admin MFA is disabled for now. Leave it off until you choose to require it under Admin → Security.",
      "info",
    ),
    check(
      "admin_mfa_enrolled",
      "Admin MFA enrollment",
      true,
      adminMfaEnrolled
        ? "An admin account has TOTP enabled."
        : "No admin has enrolled TOTP. Enrollment stays optional while MFA is disabled.",
      "info",
    ),
    check(
      "default_admin_password",
      "Default admin password rotated",
      defaultAdmin.ok,
      defaultAdmin.detail,
      "required",
    ),
    check(
      "silent_auto_apply",
      "Silent Auto-Apply stays off",
      betaSafety.silent.ok,
      betaSafety.silent.detail,
      "required",
    ),
    check(
      "billing_live",
      "Live card billing stays off",
      betaSafety.billing.ok,
      betaSafety.billing.detail,
      "required",
    ),
    check(
      "smtp",
      "SMTP configured",
      Boolean(mail.configured),
      mail.configured
        ? `Outbound mail ready via ${mail.host || "saved host"} (${mail.fromEmail || "from address set"}).`
        : "SMTP host + from address missing. Password resets and notices will stay queued.",
      "required",
    ),
    check(
      "turn",
      "TURN for interview rooms",
      Boolean(ice.productionReady),
      ice.productionReady
        ? "TURN credentials present — room RTC reports productionReady."
        : ice.warning || "TURN missing. Interview audio may fail on restrictive NATs.",
      "recommended",
    ),
    check(
      "https_docs",
      "HTTPS termination plan",
      true,
      "Terminate TLS at nginx/load balancer per deploy/HTTPS.md. Do not expose Node :3000 publicly.",
      "info",
    ),
    check(
      "legal_placeholders",
      "Legal copy placeholders",
      legal.ok,
      legal.detail,
      "required",
    ),
    check(
      "counsel",
      "Counsel review of legal copy",
      false,
      "Outside counsel must sign off Terms, Privacy, billing disclosure, and Auto-Apply authorization text (process gate).",
      "required",
    ),
    check(
      "extension_store",
      "Chrome Web Store packaging",
      false,
      "Keep unpacked until autofill is proven; follow extension/STORE.md before listing.",
      "recommended",
    ),
  ];

  const required = checks.filter((item) => item.severity === "required");
  const blocking = required.filter(
    (item) => !item.ok && item.id !== "counsel" && item.id !== "https_docs",
  );
  const counselOpen = required.some((item) => item.id === "counsel" && !item.ok);

  return {
    generatedAt: Date.now(),
    nodeEnv,
    production,
    cookieSecure: cookieSecureMode(env),
    launchReady: blocking.length === 0 && !counselOpen,
    opsReady: blocking.length === 0,
    checks,
    summary: {
      requiredTotal: required.length,
      requiredPassing: required.filter((item) => item.ok).length,
      blockingCount: blocking.length + (counselOpen ? 1 : 0),
      recommendedFailing: checks.filter((item) => item.severity === "recommended" && !item.ok).length,
    },
  };
}
