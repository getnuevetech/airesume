/** Lightweight in-memory rate limiting and security headers. */

const buckets = new Map();

function clientKey(req, suffix = "") {
  const forwarded = String(req.headers["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  const ip = forwarded || req.socket?.remoteAddress || "unknown";
  return `${ip}:${suffix}`;
}

/**
 * Simple fixed-window rate limiter.
 * @returns {{ limited: boolean, remaining: number, retryAfterSec: number }}
 */
export function rateLimit(req, { key = "global", limit = 60, windowMs = 60_000 } = {}) {
  const id = clientKey(req, key);
  const now = Date.now();
  let bucket = buckets.get(id);
  if (!bucket || now - bucket.startedAt >= windowMs) {
    bucket = { startedAt: now, count: 0 };
    buckets.set(id, bucket);
  }
  bucket.count += 1;
  const remaining = Math.max(0, limit - bucket.count);
  if (bucket.count > limit) {
    return {
      limited: true,
      remaining: 0,
      retryAfterSec: Math.ceil((windowMs - (now - bucket.startedAt)) / 1000),
    };
  }
  return { limited: false, remaining, retryAfterSec: 0 };
}

export function applySecurityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), geolocation=(), interest-cohort=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  if (typeof next === "function") next();
}

/** Clear expired rate-limit buckets (tests / long-running process hygiene). */
export function pruneRateLimitBuckets(now = Date.now(), maxAgeMs = 5 * 60_000) {
  for (const [key, bucket] of buckets.entries()) {
    if (now - bucket.startedAt > maxAgeMs) buckets.delete(key);
  }
}
