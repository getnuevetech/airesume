/** Detect the published default admin password still being usable. */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir, db, verifyPassword } from "./db.mjs";

export const PUBLISHED_DEFAULT_ADMIN_EMAIL = "admin@jobpilot.app";
export const PUBLISHED_DEFAULT_ADMIN_PASSWORD = "JobPilot-Admin-2026";

/**
 * @param {object} [options]
 * @param {typeof db} [options.db]
 * @param {typeof verifyPassword} [options.verifyPassword]
 * @param {string} [options.dataDir]
 * @param {string} [options.email]
 * @param {string} [options.password]
 */
export function defaultAdminPasswordStatus(options = {}) {
  const database = options.db || db;
  const verify = options.verifyPassword || verifyPassword;
  const dir = options.dataDir || dataDir;
  const email = options.email || PUBLISHED_DEFAULT_ADMIN_EMAIL;
  const password = options.password || PUBLISHED_DEFAULT_ADMIN_PASSWORD;

  const reasons = [];

  let row = null;
  try {
    row = database
      .prepare("SELECT id, password_hash FROM users WHERE email = ? AND role = 'admin'")
      .get(email);
  } catch {
    row = null;
  }

  if (row?.password_hash && verify(password, row.password_hash)) {
    reasons.push(`${email} still accepts the published default password`);
  }

  const bootstrapPath = join(dir, "admin-bootstrap.txt");
  if (existsSync(bootstrapPath)) {
    try {
      const text = readFileSync(bootstrapPath, "utf8");
      const match = text.match(/^password:\s*(.+)\s*$/m);
      const value = match?.[1]?.trim() || "";
      if (value && !value.startsWith("(")) {
        reasons.push("admin-bootstrap.txt still stores a plaintext password");
      }
    } catch {
      // Unreadable bootstrap is not a default-password leak.
    }
  }

  if (reasons.length) {
    return {
      ok: false,
      detail: `${reasons.join(". ")}. Change the admin password before the host is reachable, and remove the bootstrap file from any shared disk.`,
    };
  }

  return {
    ok: true,
    detail: row
      ? "Published default admin password is not active, and the bootstrap file does not store a plaintext password."
      : "Published default admin account is not present, and the bootstrap file does not store a plaintext password.",
  };
}
