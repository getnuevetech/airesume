/** TOTP MFA helpers (RFC 6238) — no external OTP dependency. */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { mfaRequiredForRole } from "./mfa-policy.mjs";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** @deprecated Prefer mfaRequiredForRole("admin"); kept for launch readiness + tests. */
export function adminMfaRequired(env = process.env) {
  return mfaRequiredForRole("admin", env);
}

export function generateTotpSecret(bytes = 20) {
  const buf = randomBytes(bytes);
  let bits = "";
  for (const value of buf) bits += value.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5);
    if (chunk.length < 5) break;
    out += BASE32[parseInt(chunk, 2)];
  }
  return out;
}

export function otpauthUrl({ secret, email, issuer = "JobPilot Admin" }) {
  const label = encodeURIComponent(`${issuer}:${email}`);
  const iss = encodeURIComponent(issuer);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${iss}&digits=6&period=30`;
}

function base32ToBuffer(secret) {
  const cleaned = String(secret || "")
    .toUpperCase()
    .replace(/=+$/g, "")
    .replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const char of cleaned) {
    const idx = BASE32.indexOf(char);
    if (idx < 0) continue;
    bits += idx.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function generateTotpCode(secret, atMs = Date.now(), stepSec = 30) {
  const key = base32ToBuffer(secret);
  const counter = Math.floor(Math.floor(atMs / 1000) / stepSec);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24) | ((hmac[offset + 1] & 0xff) << 16) | ((hmac[offset + 2] & 0xff) << 8) | (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

export function verifyTotpCode(secret, code, { atMs = Date.now(), window = 1 } = {}) {
  const expected = String(code || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(expected) || !secret) return false;
  for (let offset = -window; offset <= window; offset += 1) {
    const candidate = generateTotpCode(secret, atMs + offset * 30_000);
    const a = Buffer.from(candidate);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

export function mfaStatus(user = {}, session = {}) {
  const enabled = Boolean(user.totp_enabled_at && user.totp_secret);
  const verifiedAt = Number(session.mfa_at || 0) || 0;
  const fresh = verifiedAt > 0 && Date.now() - verifiedAt < 1000 * 60 * 60 * 12;
  return {
    enabled,
    verified: enabled ? fresh : true,
    required: false,
  };
}
