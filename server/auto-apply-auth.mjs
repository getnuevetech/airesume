/** Controlled Auto-Apply authorization text and validation. */

export const AUTO_APPLY_AUTH_VERSION = "2026-09-28";

export const AUTO_APPLY_AUTH_TEXT = `I separately authorize JobPilot Auto-Apply to prepare and electronically transmit job applications in my name only within the rules, preferences, verified profile information, application limits, and exclusions I configure. This is a limited electronic authorization for those application actions — not a general power of attorney. JobPilot will pause automation for sensitive, contractual, or unsupported fields and require my review. I can revoke Auto-Apply at any time in Account settings. Disabling stops future automated submissions; applications already transmitted before revocation may still complete.`;

export function autoApplyAuthorizationPayload(user = {}) {
  const authorizedAt = Number(user.auto_apply_authorized_at || 0) || null;
  const version = String(user.auto_apply_auth_version || "");
  const authorized = Boolean(authorizedAt) && version === AUTO_APPLY_AUTH_VERSION;
  return {
    version: AUTO_APPLY_AUTH_VERSION,
    text: AUTO_APPLY_AUTH_TEXT,
    authorized,
    authorizedAt,
    currentVersion: version || null,
  };
}

/**
 * Decide whether enabling Auto-Apply is allowed given the request body and stored auth.
 */
export function validateAutoApplyEnable({ enabled, acceptAuthorization, user }) {
  if (!enabled) {
    return { ok: true, clear: false };
  }
  const existing = autoApplyAuthorizationPayload(user);
  if (existing.authorized) {
    return { ok: true, renew: false };
  }
  if (!acceptAuthorization) {
    return {
      ok: false,
      error: "Accept the Auto-Apply authorization before enabling Autopilot.",
    };
  }
  return { ok: true, renew: true };
}
