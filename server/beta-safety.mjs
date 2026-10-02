/** Beta safety switches that should stay off until public launch decisions land. */

import { liveBillingAllowed } from "./billing-live.mjs";
import { db } from "./db.mjs";
import { isSilentAutoApplyEnabled } from "./prompt-registry.mjs";

/**
 * @param {object} [options]
 * @param {NodeJS.ProcessEnv} [options.env]
 * @param {() => boolean} [options.isSilentAutoApplyEnabled]
 * @param {typeof db} [options.db]
 */
export function betaSafetyStatus(options = {}) {
  const env = options.env || process.env;
  const silentEnabled = options.isSilentAutoApplyEnabled
    ? Boolean(options.isSilentAutoApplyEnabled())
    : isSilentAutoApplyEnabled();
  const liveEnv = liveBillingAllowed(env);

  let liveGatewayCount = 0;
  try {
    const database = options.db || db;
    liveGatewayCount = Number(
      database
        .prepare(
          "SELECT COUNT(*) AS count FROM payment_gateways WHERE mode = 'live' AND enabled = 1 AND kind != 'manual'",
        )
        .get()?.count || 0,
    );
  } catch {
    liveGatewayCount = 0;
  }

  const silent = silentEnabled
    ? {
        ok: false,
        detail:
          "Silent Auto-Apply is on. Keep the admin kill switch off during beta so Autopilot stays review-first.",
      }
    : {
        ok: true,
        detail: "Silent Auto-Apply kill switch is off. Autopilot queues Ready or Review required only.",
      };

  const billing =
    liveEnv || liveGatewayCount > 0
      ? {
          ok: false,
          detail: liveEnv
            ? "BILLING_LIVE=1 unlocks live card gateways. Leave it unset during beta and use the manual ledger until signed webhooks exist."
            : `${liveGatewayCount} enabled live card gateway${liveGatewayCount === 1 ? "" : "s"} still active. Disable them or keep billing on the manual ledger during beta.`,
        }
      : {
          ok: true,
          detail: "Live card billing stays off. Manual ledger / test mode only.",
        };

  return { silent, billing };
}
