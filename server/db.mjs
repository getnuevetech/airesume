import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";

const root = process.env.JOBPILOT_DATA_DIR
  ? process.env.JOBPILOT_DATA_DIR
  : join(dirname(fileURLToPath(import.meta.url)), "data");
mkdirSync(root, { recursive: true });

export const dataDir = root;
export const uploadsDir = join(root, "uploads");
mkdirSync(uploadsDir, { recursive: true });

export const db = new DatabaseSync(join(root, "jobpilot.sqlite"));
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA busy_timeout = 5000");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    phone TEXT DEFAULT '',
    address TEXT DEFAULT '',
    city TEXT DEFAULT '',
    password_hash TEXT,
    provider TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL,
    consent_at INTEGER,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    used_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS mail_outbox (
    id TEXT PRIMARY KEY,
    to_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS drafts (
    id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS profiles (
    user_id TEXT PRIMARY KEY,
    summary TEXT DEFAULT '',
    skills TEXT DEFAULT '[]',
    employment TEXT DEFAULT '[]',
    education TEXT DEFAULT '[]',
    facts TEXT DEFAULT '[]',
    preferences TEXT DEFAULT '{}',
    raw_text TEXT DEFAULT '',
    resume_name TEXT DEFAULT '',
    updated_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS ai_audit (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    function_name TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    status TEXT NOT NULL,
    detail TEXT DEFAULT '',
    created_at INTEGER NOT NULL
  );
`);

export function id(prefix) {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const next = scryptSync(password, salt, 32);
  const prev = Buffer.from(hash, "hex");
  return next.length === prev.length && timingSafeEqual(next, prev);
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || "",
    role: row.role,
    provider: row.provider,
    status: row.status,
    planId: row.plan_id || "free",
    mustChangePassword: Boolean(row.password_must_change),
    hasPassword: Boolean(row.password_hash),
    mfaEnrolled: Boolean(row.totp_secret && row.totp_enabled_at),
    mfaVerified: Boolean(row.__session?.mfa_at),
    accessLevelId: row.admin_access_level_id || null,
  };
}
