import assert from "node:assert/strict";
import test from "node:test";
import { AUTO_APPLY_AUTH_VERSION, autoApplyAuthorizationPayload, validateAutoApplyEnable } from "./auto-apply-auth.mjs";
import { mintExtensionToken, normalizeExtensionCapture } from "./extension-tokens.mjs";
import { iceConfigSummary, resolveIceServers } from "./webrtc-signaling.mjs";
import { applySecurityHeaders, rateLimit, pruneRateLimitBuckets } from "./security.mjs";
import { migrate, SCHEMA_VERSION } from "./schema.mjs";
import { db } from "./db.mjs";

test("schema version is 21+ with billing disclosure and MFA columns available after migrate", () => {
  assert.ok(SCHEMA_VERSION >= 21);
  migrate();
  assert.ok(db.prepare("PRAGMA table_info(extension_tokens)").all().some((column) => column.name === "token_hash"));
  assert.ok(db.prepare("PRAGMA table_info(users)").all().some((column) => column.name === "auto_apply_authorized_at"));
  assert.ok(db.prepare("PRAGMA table_info(users)").all().some((column) => column.name === "billing_disclosure_accepted_at"));
  assert.ok(db.prepare("PRAGMA table_info(checkouts)").all().some((column) => column.name === "disclosure_version"));
});

test("auto-apply enable requires separate authorization acceptance", () => {
  const blocked = validateAutoApplyEnable({ enabled: true, acceptAuthorization: false, user: {} });
  assert.equal(blocked.ok, false);
  const accepted = validateAutoApplyEnable({ enabled: true, acceptAuthorization: true, user: {} });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.renew, true);
  const already = validateAutoApplyEnable({
    enabled: true,
    acceptAuthorization: false,
    user: { auto_apply_authorized_at: Date.now(), auto_apply_auth_version: AUTO_APPLY_AUTH_VERSION },
  });
  assert.equal(already.ok, true);
  assert.equal(autoApplyAuthorizationPayload({}).authorized, false);
});

test("extension capture normalizes page fields", () => {
  const draft = normalizeExtensionCapture({
    url: "https://jobs.example/pm",
    title: "Product Manager",
    company: "Acme",
    description: "Own activation.",
  });
  assert.equal(draft.sourceUrl, "https://jobs.example/pm");
  assert.equal(draft.title, "Product Manager");
  assert.ok(mintExtensionToken().raw.startsWith("jpxt_"));
  assert.throws(() => normalizeExtensionCapture({}), /title|description|URL/i);
});

test("resolveIceServers includes TURN when configured", () => {
  const stunOnly = resolveIceServers({});
  assert.ok(stunOnly.some((item) => String(item.urls).includes("stun:")));
  assert.equal(iceConfigSummary(stunOnly).productionReady, false);
  const withTurn = resolveIceServers({
    TURN_URIS: "turn:turn.example.com:3478",
    TURN_USERNAME: "jobpilot",
    TURN_CREDENTIAL: "secret",
  });
  assert.ok(withTurn.some((item) => String(item.urls).includes("turn:")));
  assert.equal(iceConfigSummary(withTurn).productionReady, true);
});

test("rate limit and security headers protect the API surface", () => {
  const req = { headers: {}, socket: { remoteAddress: "203.0.113.9" } };
  pruneRateLimitBuckets(Date.now() + 10_000_000);
  for (let i = 0; i < 5; i += 1) {
    assert.equal(rateLimit(req, { key: "unit-test", limit: 5, windowMs: 60_000 }).limited, false);
  }
  assert.equal(rateLimit(req, { key: "unit-test", limit: 5, windowMs: 60_000 }).limited, true);
  const headers = {};
  applySecurityHeaders(req, { setHeader: (key, value) => { headers[key] = value; } }, () => undefined);
  assert.equal(headers["X-Content-Type-Options"], "nosniff");
  assert.equal(headers["X-Frame-Options"], "SAMEORIGIN");
});
