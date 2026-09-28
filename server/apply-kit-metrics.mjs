/** Browser apply kit event recording and completion metrics. */

import { db, id } from "./db.mjs";

export const APPLY_KIT_EVENTS = new Set(["opened", "copied", "completed"]);

/**
 * Record an apply-kit funnel event.
 * @returns {{ id: string, event: string, createdAt: number }}
 */
export function recordApplyKitEvent(userId, applicationId, event, detail = "") {
  const name = String(event || "").toLowerCase();
  if (!APPLY_KIT_EVENTS.has(name)) {
    throw new Error("Unknown apply kit event.");
  }
  const createdAt = Date.now();
  const eventId = id("ake");
  db.prepare(
    `INSERT INTO apply_kit_events (id, user_id, application_id, event, detail, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(eventId, userId, applicationId, name, String(detail || "").slice(0, 120), createdAt);
  return { id: eventId, event: name, createdAt };
}

/**
 * Aggregate apply-kit funnel metrics for a user (or one application).
 */
export function applyKitMetrics({ userId, applicationId = null } = {}) {
  let rows;
  if (applicationId) {
    rows = db
      .prepare(
        `SELECT event, COUNT(*) AS count FROM apply_kit_events
         WHERE user_id = ? AND application_id = ?
         GROUP BY event`,
      )
      .all(userId, applicationId);
  } else {
    rows = db
      .prepare(`SELECT event, COUNT(*) AS count FROM apply_kit_events WHERE user_id = ? GROUP BY event`)
      .all(userId);
  }
  const counts = Object.fromEntries(rows.map((row) => [row.event, Number(row.count) || 0]));
  const opened = counts.opened || 0;
  const copied = counts.copied || 0;
  const completed = counts.completed || 0;
  const distinctOpened = applicationId
    ? opened > 0
      ? 1
      : 0
    : db
        .prepare(
          `SELECT COUNT(DISTINCT application_id) AS count FROM apply_kit_events
           WHERE user_id = ? AND event = 'opened'`,
        )
        .get(userId).count;
  const distinctCompleted = applicationId
    ? completed > 0
      ? 1
      : 0
    : db
        .prepare(
          `SELECT COUNT(DISTINCT application_id) AS count FROM apply_kit_events
           WHERE user_id = ? AND event = 'completed'`,
        )
        .get(userId).count;
  const completionRate = distinctOpened
    ? Math.round((distinctCompleted / distinctOpened) * 100)
    : 0;
  return {
    opened,
    copied,
    completed,
    kitsOpened: distinctOpened,
    kitsCompleted: distinctCompleted,
    completionRate,
  };
}
