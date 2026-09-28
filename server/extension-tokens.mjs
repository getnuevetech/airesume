/** Browser extension token helpers and capture normalization. */

import { randomBytes } from "node:crypto";
import { db, id, sha256 } from "./db.mjs";

function text(value, max = 4000) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function mintExtensionToken() {
  const raw = `jpxt_${randomBytes(24).toString("hex")}`;
  return { raw, hash: sha256(raw), prefix: raw.slice(0, 12) };
}

export function createExtensionToken(userId, label = "Browser extension") {
  const minted = mintExtensionToken();
  const tokenId = id("ext");
  const now = Date.now();
  db.prepare(
    `INSERT INTO extension_tokens (id, user_id, token_hash, token_prefix, label, created_at, last_used_at, revoked_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)`,
  ).run(tokenId, userId, minted.hash, minted.prefix, text(label, 80) || "Browser extension", now);
  return {
    id: tokenId,
    token: minted.raw,
    prefix: minted.prefix,
    label: text(label, 80) || "Browser extension",
    createdAt: now,
  };
}

export function listExtensionTokens(userId) {
  return db
    .prepare(
      `SELECT id, token_prefix AS prefix, label, created_at AS createdAt, last_used_at AS lastUsedAt, revoked_at AS revokedAt
       FROM extension_tokens WHERE user_id = ? ORDER BY created_at DESC`,
    )
    .all(userId)
    .map((row) => ({
      ...row,
      active: !row.revokedAt,
    }));
}

export function revokeExtensionToken(userId, tokenId) {
  const result = db
    .prepare(
      `UPDATE extension_tokens SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at IS NULL`,
    )
    .run(Date.now(), tokenId, userId);
  return result.changes > 0;
}

export function resolveExtensionUser(rawToken) {
  const token = String(rawToken || "").trim();
  if (!token.startsWith("jpxt_") || token.length < 20) return null;
  const row = db
    .prepare(
      `SELECT users.*, extension_tokens.id AS extension_token_id
       FROM extension_tokens
       JOIN users ON users.id = extension_tokens.user_id
       WHERE extension_tokens.token_hash = ?
         AND extension_tokens.revoked_at IS NULL
         AND users.status = 'active'`,
    )
    .get(sha256(token));
  if (!row) return null;
  db.prepare("UPDATE extension_tokens SET last_used_at = ? WHERE id = ?").run(Date.now(), row.extension_token_id);
  return row;
}

/**
 * Normalize a page capture from the browser extension into a paste-ready job draft.
 */
export function normalizeExtensionCapture(body = {}) {
  const sourceUrl = text(body.sourceUrl || body.url || body.href, 500);
  const title = text(body.title || body.jobTitle, 160);
  const company = text(body.company || body.employer, 160);
  const location = text(body.location, 160);
  const description = text(body.description || body.text || body.content, 12000);
  if (!title && !description && !sourceUrl) {
    throw new Error("Capture a job title, description, or listing URL.");
  }
  return {
    sourceUrl,
    title: title || "Captured role",
    company: company || "Unknown company",
    location,
    description:
      description ||
      [title, company, location, sourceUrl].filter(Boolean).join("\n"),
    pageTitle: text(body.pageTitle, 200),
    capturedAt: Date.now(),
  };
}
