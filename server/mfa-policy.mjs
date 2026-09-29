/** Settings-backed MFA policy by account type (admin / employer / user). */

import { db } from "./db.mjs";

export const MFA_POLICY_SETTING = "mfa_policy";

export const MFA_ROLES = ["admin", "employer", "user"];

/** How often enrolled users must re-verify while signed in. */
export const MFA_WHEN_OPTIONS = [
  { id: "login", label: "At every sign-in", detail: "Ask for a code once when the session starts." },
  { id: "session", label: "Every 12 hours", detail: "Re-verify during long sessions (admin console default)." },
];

const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 12;

function parse(value, fallback) {
  try {
    return JSON.parse(value || "");
  } catch {
    return fallback;
  }
}

export function defaultMfaPolicy(env = process.env) {
  const production = String(env.NODE_ENV || "") === "production";
  return {
    roles: {
      admin: { enabled: production, when: "session" },
      employer: { enabled: false, when: "login" },
      user: { enabled: false, when: "login" },
    },
  };
}

function normalizeRolePolicy(input, fallback) {
  const raw = input && typeof input === "object" ? input : {};
  const when = String(raw.when || fallback.when || "login");
  const safeWhen = when === "session" ? "session" : "login";
  return {
    enabled: Boolean(raw.enabled),
    when: safeWhen,
  };
}

export function normalizeMfaPolicy(input, env = process.env) {
  const defaults = defaultMfaPolicy(env);
  const roles = input?.roles && typeof input.roles === "object" ? input.roles : {};
  return {
    roles: {
      admin: normalizeRolePolicy(roles.admin, defaults.roles.admin),
      employer: normalizeRolePolicy(roles.employer, defaults.roles.employer),
      user: normalizeRolePolicy(roles.user, defaults.roles.user),
    },
  };
}

export function getMfaPolicy(env = process.env) {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(MFA_POLICY_SETTING);
  if (!row?.value) return defaultMfaPolicy(env);
  return normalizeMfaPolicy(parse(row.value, null), env);
}

export function saveMfaPolicy(input, env = process.env) {
  const next = normalizeMfaPolicy(input, env);
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(MFA_POLICY_SETTING, JSON.stringify(next));
  return next;
}

export function seedMfaPolicy(env = process.env) {
  if (db.prepare("SELECT value FROM settings WHERE key = ?").get(MFA_POLICY_SETTING)) return getMfaPolicy(env);
  return saveMfaPolicy(defaultMfaPolicy(env), env);
}

/**
 * Whether MFA is required for a role.
 * Env override applies only to admin: REQUIRE_ADMIN_MFA=1|0.
 */
export function mfaRequiredForRole(role, env = process.env) {
  const key = MFA_ROLES.includes(role) ? role : "user";
  if (key === "admin") {
    if (String(env.REQUIRE_ADMIN_MFA || "") === "1") return true;
    if (String(env.REQUIRE_ADMIN_MFA || "") === "0") return false;
  }
  const policy = getMfaPolicy(env);
  return Boolean(policy.roles[key]?.enabled);
}

export function mfaWhenForRole(role, env = process.env) {
  const key = MFA_ROLES.includes(role) ? role : "user";
  const policy = getMfaPolicy(env);
  return policy.roles[key]?.when === "session" ? "session" : "login";
}

export function mfaMaxAgeMs(when) {
  return when === "session" ? SESSION_MAX_AGE_MS : Number.POSITIVE_INFINITY;
}

export function mfaVerifiedFresh(session, when = "login") {
  const mfaAt = Number(session?.mfa_at || 0) || 0;
  if (!mfaAt) return false;
  const maxAge = mfaMaxAgeMs(when);
  if (!Number.isFinite(maxAge)) return true;
  return Date.now() - mfaAt <= maxAge;
}

export function publicMfaPolicy(env = process.env) {
  const policy = getMfaPolicy(env);
  return {
    roles: MFA_ROLES.map((role) => ({
      role,
      label: role === "user" ? "Candidates" : role === "employer" ? "Employers" : "Admins",
      enabled: Boolean(policy.roles[role].enabled),
      when: policy.roles[role].when,
      envOverride:
        role === "admin"
          ? String(env.REQUIRE_ADMIN_MFA || "") === "1"
            ? "forced_on"
            : String(env.REQUIRE_ADMIN_MFA || "") === "0"
              ? "forced_off"
              : null
          : null,
    })),
    whenOptions: MFA_WHEN_OPTIONS,
  };
}
