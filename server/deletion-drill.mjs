/** Account-deletion drill for Admin → Launch (recommended). */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { dataDir, db, id } from "./db.mjs";
import { deleteAccountData } from "./onboarding.mjs";

export const LAST_DELETION_DRILL_FILE = "ops-last-deletion-drill.json";

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

export function recordDeletionDrill({ dataDir: dir = dataDir, at = Date.now(), tablesCleared = [] } = {}) {
  const payload = {
    at: Number(at) || Date.now(),
    tablesCleared: Array.isArray(tablesCleared) ? tablesCleared : [],
  };
  writeJson(join(dir, LAST_DELETION_DRILL_FILE), payload);
  return payload;
}

export function deletionDrillStatus(dir = dataDir) {
  const last = readJson(join(dir, LAST_DELETION_DRILL_FILE));
  const lastAt = Number(last?.at || 0) || null;
  if (!lastAt) {
    return {
      ok: false,
      lastAt: null,
      detail:
        "No deletion drill recorded. Run deploy/deletion-drill.sh once on staging (creates a throwaway account, deletes it, and verifies fan-out).",
    };
  }
  return {
    ok: true,
    lastAt,
    detail: `Deletion fan-out drill recorded at ${new Date(lastAt).toISOString()}.`,
  };
}

/**
 * Seed a disposable candidate, delete via the production fan-out, verify rows are gone, record marker.
 */
export function runDeletionDrill({ now = Date.now(), dir = dataDir } = {}) {
  const userId = id("drill");
  const email = `deletion-drill-${now}@example.invalid`;
  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, provider, role, status, consent_at, created_at, plan_id)
     VALUES (?, 'Deletion Drill', ?, '', 'email', 'user', 'active', ?, ?, 'free')`,
  ).run(userId, email, now, now);
  db.prepare(
    `INSERT INTO profiles (user_id, summary, skills, employment, education, facts, preferences, raw_text, resume_name, resume_file_url, headline, photo_url, slug, template, updated_at)
     VALUES (?, '', '[]', '[]', '[]', '[]', '{}', '', '', '', 'Drill', '', ?, 'classic', ?)`,
  ).run(userId, `drill-${String(userId).slice(-6)}`, now);
  db.prepare(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)`,
  ).run(`drill_${userId}`, userId, now + 60_000);
  db.prepare(
    `INSERT INTO resume_versions (id, user_id, label, kind, document, rendered, active, created_at)
     VALUES (?, ?, 'Drill resume', 'original', '{}', '', 1, ?)`,
  ).run(id("ver"), userId, now);

  deleteAccountData(userId);

  const remaining = {
    users: db.prepare("SELECT COUNT(*) AS count FROM users WHERE id = ?").get(userId)?.count || 0,
    profiles: db.prepare("SELECT COUNT(*) AS count FROM profiles WHERE user_id = ?").get(userId)?.count || 0,
    sessions: db.prepare("SELECT COUNT(*) AS count FROM sessions WHERE user_id = ?").get(userId)?.count || 0,
    resume_versions: db.prepare("SELECT COUNT(*) AS count FROM resume_versions WHERE user_id = ?").get(userId)?.count || 0,
  };
  const leftovers = Object.entries(remaining).filter(([, count]) => Number(count) > 0).map(([name]) => name);
  if (leftovers.length) {
    throw new Error(`Deletion drill failed; rows remain in: ${leftovers.join(", ")}.`);
  }

  const tablesCleared = Object.keys(remaining);
  const recorded = recordDeletionDrill({ dataDir: dir, at: now, tablesCleared });
  return { ok: true, at: recorded.at, tablesCleared, userId };
}
