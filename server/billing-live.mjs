/** Live card gateways stay off until signed webhooks exist and BILLING_LIVE=1 is set. */

export const LIVE_BILLING_ERROR =
  "Live card gateways stay off during beta. Use the manual ledger, or set BILLING_LIVE=1 after signed webhooks exist.";

export function liveBillingAllowed(env = process.env) {
  return String(env.BILLING_LIVE || "") === "1";
}

export function normalizeGatewayMode(mode, fallback = "test") {
  if (mode === "live") return "live";
  if (mode === "test") return "test";
  return fallback === "live" ? "live" : "test";
}

/**
 * Reject creating a live gateway, switching a gateway to live, or enabling one
 * that is already live. Disabling a live gateway is allowed so it can be turned off.
 */
export function liveGatewayWriteError({ nextMode, prevMode = "test", nextEnabled = false }, env = process.env) {
  if (liveBillingAllowed(env)) return "";
  if (nextMode !== "live") return "";
  const turningLive = prevMode !== "live";
  if (turningLive || nextEnabled) return LIVE_BILLING_ERROR;
  return "";
}
