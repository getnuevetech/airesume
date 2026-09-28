/** Weekly match-explanation quotas by plan. */

import { db } from "./db.mjs";

export function startOfUtcWeek(now = Date.now()) {
  const date = new Date(now);
  const day = date.getUTCDay(); // 0 Sun
  const diff = (day + 6) % 7; // Monday-start week
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - diff);
}

export function matchExplainLimit(features = {}) {
  if (!Object.prototype.hasOwnProperty.call(features, "match_explain_limit")) return 5;
  const value = Number(features.match_explain_limit);
  if (!Number.isFinite(value)) return 5;
  return Math.max(0, Math.round(value));
}

export function explanationQuota(userId, features, now = Date.now()) {
  const limit = matchExplainLimit(features);
  const weekStart = startOfUtcWeek(now);
  const used = db
    .prepare("SELECT COUNT(*) AS count FROM match_explanation_views WHERE user_id = ? AND week_start = ?")
    .get(userId, weekStart).count;
  return {
    limit,
    used,
    remaining: limit === 0 ? Number.POSITIVE_INFINITY : Math.max(0, limit - used),
    unlimited: limit === 0,
    weekStart,
    resetsAt: weekStart + 7 * 24 * 60 * 60 * 1000,
  };
}

export function hasExplanationView(userId, jobId, weekStart) {
  return Boolean(
    db.prepare("SELECT 1 FROM match_explanation_views WHERE user_id = ? AND job_id = ? AND week_start = ?").get(userId, jobId, weekStart),
  );
}

export function recordExplanationView(userId, jobId, weekStart) {
  db.prepare(
    "INSERT OR IGNORE INTO match_explanation_views (user_id, job_id, week_start, created_at) VALUES (?, ?, ?, ?)",
  ).run(userId, jobId, weekStart, Date.now());
}

/**
 * Decide whether a ranked job may include its explanation this week.
 * Mutates quota.remaining when a new view is recorded.
 */
export function allowExplanation(userId, jobId, quota) {
  if (quota.unlimited) return true;
  if (hasExplanationView(userId, jobId, quota.weekStart)) return true;
  if (quota.remaining <= 0) return false;
  recordExplanationView(userId, jobId, quota.weekStart);
  quota.used += 1;
  quota.remaining = Math.max(0, quota.limit - quota.used);
  return true;
}

export function redactMatch(match) {
  return {
    ...match,
    explanation: "",
    matched: [],
    missing: [],
    preferredMatched: [],
    explanationLocked: true,
  };
}
