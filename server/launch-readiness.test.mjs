import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { hashPassword, verifyPassword } from "./db.mjs";
import { computeLaunchReadiness } from "./launch-readiness.mjs";
import { scanLegalPlaceholders } from "./legal-placeholders.mjs";
import { betaSafetyStatus } from "./beta-safety.mjs";
import {
  PUBLISHED_DEFAULT_ADMIN_EMAIL,
  PUBLISHED_DEFAULT_ADMIN_PASSWORD,
  defaultAdminPasswordStatus,
} from "./default-admin-password.mjs";

const cleanLegal = {
  ok: true,
  hits: [],
  placeholderIds: [],
  detail: "Terms and Privacy have no unfinished company/counsel placeholders.",
};

const cleanDefaultAdmin = {
  ok: true,
  detail: "Published default admin password is not active, and the bootstrap file does not store a plaintext password.",
};

const cleanBetaSafety = {
  silent: {
    ok: true,
    detail: "Silent Auto-Apply kill switch is off. Autopilot queues Ready or Review required only.",
  },
  billing: {
    ok: true,
    detail: "Live card billing stays off. Manual ledger / test mode only.",
  },
};

const cleanAiHealth = {
  keys: { ok: true, detail: "Enabled OpenAI / Anthropic / Google providers have API keys set." },
  modelQuality: { ok: true, detail: "Career extraction is assigned to a live AI provider." },
  rulesOnly: [],
  missingKeys: [],
};

const cleanBackupDrill = {
  ok: true,
  lastBackupAt: 1_700_000_000_000,
  lastRestoreAt: 1_700_000_100_000,
  detail: "Backup and restore drill recorded.",
};

test("launch readiness fails closed without SMTP and production env; MFA stays informational", () => {
  const report = computeLaunchReadiness({
    env: { NODE_ENV: "development", COOKIE_SECURE: "0", REQUIRE_ADMIN_MFA: "0" },
    mail: { configured: false, deliveryProven: false, host: "", fromEmail: "" },
    ice: { productionReady: false, warning: "TURN missing" },
    adminMfaEnrolled: false,
    legal: cleanLegal,
    defaultAdmin: cleanDefaultAdmin,
    betaSafety: cleanBetaSafety,
    aiHealth: cleanAiHealth,
    backupDrill: cleanBackupDrill,
  });
  assert.equal(report.opsReady, false);
  assert.equal(report.launchReady, false);
  assert.ok(report.checks.some((item) => item.id === "smtp" && !item.ok));
  assert.ok(report.checks.some((item) => item.id === "admin_mfa_policy" && item.ok && item.severity === "info"));
  assert.ok(report.checks.some((item) => item.id === "counsel" && !item.ok));
  assert.ok(report.checks.some((item) => item.id === "legal_placeholders" && item.ok));
  assert.ok(report.checks.some((item) => item.id === "default_admin_password" && item.ok));
  assert.ok(report.checks.some((item) => item.id === "silent_auto_apply" && item.ok));
  assert.ok(report.checks.some((item) => item.id === "billing_live" && item.ok));
});

test("SMTP host alone without a successful test blocks opsReady", () => {
  const report = computeLaunchReadiness({
    env: { NODE_ENV: "production", COOKIE_SECURE: "1" },
    mail: { configured: true, deliveryProven: false, host: "smtp.example.com", fromEmail: "hello@example.com" },
    ice: { productionReady: true, warning: "" },
    adminMfaEnrolled: true,
    legal: cleanLegal,
    defaultAdmin: cleanDefaultAdmin,
    betaSafety: cleanBetaSafety,
    aiHealth: cleanAiHealth,
    backupDrill: cleanBackupDrill,
  });
  assert.equal(report.opsReady, false);
  const smtp = report.checks.find((item) => item.id === "smtp");
  assert.equal(smtp.ok, false);
  assert.match(smtp.detail, /test/i);
  assert.match(smtp.label, /test email/i);
});

test("launch readiness opsReady when production signals are green (counsel still open)", () => {
  const report = computeLaunchReadiness({
    env: { NODE_ENV: "production", COOKIE_SECURE: "1", REQUIRE_ADMIN_MFA: "1" },
    mail: { configured: true, deliveryProven: true, host: "smtp.example.com", fromEmail: "hello@example.com", lastTestAt: 1_700_000_000_000 },
    ice: { productionReady: true, warning: "" },
    adminMfaEnrolled: true,
    legal: cleanLegal,
    defaultAdmin: cleanDefaultAdmin,
    betaSafety: cleanBetaSafety,
    aiHealth: cleanAiHealth,
    backupDrill: cleanBackupDrill,
  });
  assert.equal(report.opsReady, true);
  assert.equal(report.launchReady, false);
  assert.ok(report.checks.some((item) => item.id === "turn" && item.ok));
  assert.ok(report.checks.some((item) => item.id === "backup_drill" && item.ok));
  assert.ok(report.checks.some((item) => item.id === "counsel" && !item.ok));
  assert.ok(report.checks.some((item) => item.id === "legal_placeholders" && item.ok));
  assert.ok(report.checks.some((item) => item.id === "default_admin_password" && item.ok));
  assert.ok(report.checks.some((item) => item.id === "cookie_secure" && item.ok));
});

test("production without COOKIE_SECURE=1 blocks opsReady", () => {
  const report = computeLaunchReadiness({
    env: { NODE_ENV: "production" },
    mail: { configured: true, deliveryProven: true, host: "smtp.example.com", fromEmail: "hello@example.com", lastTestAt: 1_700_000_000_000 },
    ice: { productionReady: true, warning: "" },
    adminMfaEnrolled: true,
    legal: cleanLegal,
    defaultAdmin: cleanDefaultAdmin,
    betaSafety: cleanBetaSafety,
    aiHealth: cleanAiHealth,
    backupDrill: cleanBackupDrill,
  });
  assert.equal(report.opsReady, false);
  assert.ok(report.checks.some((item) => item.id === "cookie_secure" && !item.ok));
  assert.match(
    report.checks.find((item) => item.id === "cookie_secure").detail,
    /COOKIE_SECURE=1/,
  );
});

test("unfinished legal placeholders block opsReady even when SMTP and production are green", () => {
  const report = computeLaunchReadiness({
    env: { NODE_ENV: "production", COOKIE_SECURE: "1" },
    mail: { configured: true, deliveryProven: true, host: "smtp.example.com", fromEmail: "hello@example.com", lastTestAt: 1_700_000_000_000 },
    ice: { productionReady: true, warning: "" },
    adminMfaEnrolled: true,
    legal: {
      ok: false,
      hits: [{ file: "src/content/terms.ts", label: "Terms", ids: ["COMPANY_LEGAL_NAME"] }],
      placeholderIds: ["COMPANY_LEGAL_NAME"],
      detail: "Unfinished legal copy in Terms: COMPANY_LEGAL_NAME.",
    },
    defaultAdmin: cleanDefaultAdmin,
    betaSafety: cleanBetaSafety,
    aiHealth: cleanAiHealth,
    backupDrill: cleanBackupDrill,
  });
  assert.equal(report.opsReady, false);
  assert.equal(report.launchReady, false);
  assert.ok(report.checks.some((item) => item.id === "legal_placeholders" && !item.ok));
});

test("published default admin password blocks opsReady", () => {
  const report = computeLaunchReadiness({
    env: { NODE_ENV: "production", COOKIE_SECURE: "1" },
    mail: { configured: true, deliveryProven: true, host: "smtp.example.com", fromEmail: "hello@example.com", lastTestAt: 1_700_000_000_000 },
    ice: { productionReady: true, warning: "" },
    adminMfaEnrolled: true,
    legal: cleanLegal,
    defaultAdmin: {
      ok: false,
      detail: "admin@jobpilot.app still accepts the published default password.",
    },
    betaSafety: cleanBetaSafety,
    aiHealth: cleanAiHealth,
    backupDrill: cleanBackupDrill,
  });
  assert.equal(report.opsReady, false);
  assert.ok(report.checks.some((item) => item.id === "default_admin_password" && !item.ok));
});

test("silent Auto-Apply on blocks opsReady", () => {
  const report = computeLaunchReadiness({
    env: { NODE_ENV: "production", COOKIE_SECURE: "1" },
    mail: { configured: true, deliveryProven: true, host: "smtp.example.com", fromEmail: "hello@example.com", lastTestAt: 1_700_000_000_000 },
    ice: { productionReady: true, warning: "" },
    adminMfaEnrolled: true,
    legal: cleanLegal,
    defaultAdmin: cleanDefaultAdmin,
    betaSafety: {
      silent: { ok: false, detail: "Silent Auto-Apply is on." },
      billing: cleanBetaSafety.billing,
    },
    aiHealth: cleanAiHealth,
    backupDrill: cleanBackupDrill,
  });
  assert.equal(report.opsReady, false);
  assert.ok(report.checks.some((item) => item.id === "silent_auto_apply" && !item.ok));
});

test("BILLING_LIVE unlocks block opsReady", () => {
  const report = computeLaunchReadiness({
    env: { NODE_ENV: "production", COOKIE_SECURE: "1", BILLING_LIVE: "1" },
    mail: { configured: true, deliveryProven: true, host: "smtp.example.com", fromEmail: "hello@example.com", lastTestAt: 1_700_000_000_000 },
    ice: { productionReady: true, warning: "" },
    adminMfaEnrolled: true,
    legal: cleanLegal,
    defaultAdmin: cleanDefaultAdmin,
    betaSafety: {
      silent: cleanBetaSafety.silent,
      billing: { ok: false, detail: "BILLING_LIVE=1 unlocks live card gateways." },
    },
    aiHealth: cleanAiHealth,
    backupDrill: cleanBackupDrill,
  });
  assert.equal(report.opsReady, false);
  assert.ok(report.checks.some((item) => item.id === "billing_live" && !item.ok));
});

test("missing live AI API keys block opsReady", () => {
  const report = computeLaunchReadiness({
    env: { NODE_ENV: "production", COOKIE_SECURE: "1" },
    mail: { configured: true, deliveryProven: true, host: "smtp.example.com", fromEmail: "hello@example.com", lastTestAt: 1_700_000_000_000 },
    ice: { productionReady: true, warning: "" },
    adminMfaEnrolled: true,
    legal: cleanLegal,
    defaultAdmin: cleanDefaultAdmin,
    betaSafety: cleanBetaSafety,
    aiHealth: {
      keys: { ok: false, detail: "Live AI providers are missing API keys: career_extraction (OpenAI)." },
      modelQuality: cleanAiHealth.modelQuality,
      rulesOnly: [],
      missingKeys: ["career_extraction (OpenAI)"],
    },
    backupDrill: cleanBackupDrill,
  });
  assert.equal(report.opsReady, false);
  assert.ok(report.checks.some((item) => item.id === "ai_provider_keys" && !item.ok));
});

test("rules-only career extraction is recommended, not ops blocking", () => {
  const report = computeLaunchReadiness({
    env: { NODE_ENV: "production", COOKIE_SECURE: "1" },
    mail: { configured: true, deliveryProven: true, host: "smtp.example.com", fromEmail: "hello@example.com", lastTestAt: 1_700_000_000_000 },
    ice: { productionReady: true, warning: "" },
    adminMfaEnrolled: true,
    legal: cleanLegal,
    defaultAdmin: cleanDefaultAdmin,
    betaSafety: cleanBetaSafety,
    aiHealth: {
      keys: cleanAiHealth.keys,
      modelQuality: { ok: false, detail: "Career extraction still uses Built-in rules only." },
      rulesOnly: ["career_extraction"],
      missingKeys: [],
    },
    backupDrill: cleanBackupDrill,
  });
  assert.equal(report.opsReady, true);
  assert.ok(report.checks.some((item) => item.id === "ai_career_extraction" && !item.ok && item.severity === "recommended"));
});

test("missing backup restore drill is recommended, not ops blocking", () => {
  const report = computeLaunchReadiness({
    env: { NODE_ENV: "production", COOKIE_SECURE: "1" },
    mail: { configured: true, deliveryProven: true, host: "smtp.example.com", fromEmail: "hello@example.com", lastTestAt: 1_700_000_000_000 },
    ice: { productionReady: true, warning: "" },
    adminMfaEnrolled: true,
    legal: cleanLegal,
    defaultAdmin: cleanDefaultAdmin,
    betaSafety: cleanBetaSafety,
    aiHealth: cleanAiHealth,
    backupDrill: {
      ok: false,
      lastBackupAt: null,
      lastRestoreAt: null,
      detail: "No backup or restore drill recorded.",
    },
  });
  assert.equal(report.opsReady, true);
  const drill = report.checks.find((item) => item.id === "backup_drill");
  assert.equal(drill.ok, false);
  assert.equal(drill.severity, "recommended");
  assert.match(drill.detail, /restore drill/i);
});

test("aiPipelineHealth flags blank live keys and rules-only extraction", async () => {
  const { aiPipelineHealth } = await import("./ai-pipeline-health.mjs");
  const database = new DatabaseSync(":memory:");
  database.exec(`CREATE TABLE ai_providers (
    id TEXT PRIMARY KEY,
    name TEXT,
    kind TEXT,
    api_key TEXT,
    enabled INTEGER
  )`);
  database
    .prepare("INSERT INTO ai_providers (id, name, kind, api_key, enabled) VALUES ('p1', 'OpenAI', 'openai', '', 1)")
    .run();

  const bad = aiPipelineHealth({
    db: database,
    assignmentFor: () => ({
      assignment_enabled: 1,
      enabled: 1,
      kind: "openai",
      name: "OpenAI",
      api_key: "",
    }),
  });
  assert.equal(bad.keys.ok, false);
  assert.equal(bad.modelQuality.ok, true);

  const rules = aiPipelineHealth({
    db: database,
    assignmentFor: (key) =>
      key === "career_extraction"
        ? { assignment_enabled: 1, enabled: 1, kind: "deterministic", name: "rules", api_key: "" }
        : { assignment_enabled: 1, enabled: 1, kind: "openai", name: "OpenAI", api_key: "sk-test" },
  });
  assert.equal(rules.modelQuality.ok, false);
  assert.ok(rules.rulesOnly.includes("career_extraction"));
});

test("scanLegalPlaceholders finds company and counsel markers in the repo copy", () => {
  const result = scanLegalPlaceholders(join(import.meta.dirname, ".."), undefined, {
    legalName: "",
    mailingAddress: "",
    privacyEmail: "",
    supportEmail: "",
  });
  assert.equal(result.ok, false);
  assert.ok(result.placeholderIds.includes("COMPANY_LEGAL_NAME"));
  assert.ok(result.placeholderIds.includes("PRIVACY_EMAIL"));
  assert.ok(result.counselDraftIds.includes("ARBITRATION_PLACEHOLDER") || result.counselDraftIds.includes("DRAFT_FOR_COUNSEL"));
});

test("scanLegalPlaceholders passes company fields when legal entity is filled", () => {
  const result = scanLegalPlaceholders(join(import.meta.dirname, ".."), undefined, {
    legalName: "Example Inc.",
    mailingAddress: "1 Main St",
    privacyEmail: "privacy@example.com",
    supportEmail: "legal@example.com",
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.placeholderIds, []);
  assert.ok(result.counselDraftIds.length > 0);
});

test("scanLegalPlaceholders passes when bracket fields are filled", () => {
  const root = mkdtempSync(join(tmpdir(), "jobpilot-legal-"));
  mkdirSync(join(root, "src", "content"), { recursive: true });
  writeFileSync(
    join(root, "src", "content", "terms.ts"),
    'export const termsDoc = { text: "JobPilot is operated by Example Inc. Contact privacy@example.com." };\n',
  );
  writeFileSync(
    join(root, "src", "content", "privacy.ts"),
    'export const privacyDoc = { text: "Mailing address: 1 Main St. Privacy requests: privacy@example.com." };\n',
  );
  const result = scanLegalPlaceholders(root);
  assert.equal(result.ok, true);
  assert.deepEqual(result.placeholderIds, []);
});

test("applyLegalEntityToText replaces company brackets", async () => {
  const { applyLegalEntityToText } = await import("./legal-entity.mjs");
  const text = applyLegalEntityToText(
    "Operated by [COMPANY LEGAL NAME]. Write [PRIVACY EMAIL] or [LEGAL / SUPPORT EMAIL]. Mail: [COMPANY MAILING ADDRESS]",
    {
      legalName: "Example Inc",
      mailingAddress: "1 Main St",
      privacyEmail: "privacy@example.com",
      supportEmail: "legal@example.com",
    },
  );
  assert.equal(
    text,
    "Operated by Example Inc. Write privacy@example.com or legal@example.com. Mail: 1 Main St",
  );
});

test("defaultAdminPasswordStatus fails when the published password still verifies", () => {
  const dir = mkdtempSync(join(tmpdir(), "jp-default-admin-"));
  const database = new DatabaseSync(":memory:");
  database.exec(`CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT,
    role TEXT,
    password_hash TEXT
  )`);
  database
    .prepare("INSERT INTO users (id, email, role, password_hash) VALUES (?, ?, 'admin', ?)")
    .run("usr-1", PUBLISHED_DEFAULT_ADMIN_EMAIL, hashPassword(PUBLISHED_DEFAULT_ADMIN_PASSWORD));
  writeFileSync(join(dir, "admin-bootstrap.txt"), `email: ${PUBLISHED_DEFAULT_ADMIN_EMAIL}\npassword: ${PUBLISHED_DEFAULT_ADMIN_PASSWORD}\n`);

  const result = defaultAdminPasswordStatus({
    db: database,
    dataDir: dir,
    verifyPassword,
  });
  assert.equal(result.ok, false);
  assert.match(result.detail, /published default password/i);
  assert.match(result.detail, /plaintext password/i);
});

test("defaultAdminPasswordStatus passes after rotation and bootstrap wipe", () => {
  const dir = mkdtempSync(join(tmpdir(), "jp-default-admin-ok-"));
  const database = new DatabaseSync(":memory:");
  database.exec(`CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT,
    role TEXT,
    password_hash TEXT
  )`);
  database
    .prepare("INSERT INTO users (id, email, role, password_hash) VALUES (?, ?, 'admin', ?)")
    .run("usr-1", PUBLISHED_DEFAULT_ADMIN_EMAIL, hashPassword("rotated-password-not-default"));
  writeFileSync(
    join(dir, "admin-bootstrap.txt"),
    `email: ${PUBLISHED_DEFAULT_ADMIN_EMAIL}\npassword: (changed — not stored)\n`,
  );

  const result = defaultAdminPasswordStatus({
    db: database,
    dataDir: dir,
    verifyPassword,
  });
  assert.equal(result.ok, true);
});

test("betaSafetyStatus fails when silent apply or live billing is on", () => {
  const database = new DatabaseSync(":memory:");
  database.exec(`CREATE TABLE payment_gateways (
    id TEXT PRIMARY KEY,
    kind TEXT,
    mode TEXT,
    enabled INTEGER
  )`);
  database
    .prepare("INSERT INTO payment_gateways (id, kind, mode, enabled) VALUES ('gw1', 'stripe', 'live', 1)")
    .run();

  const on = betaSafetyStatus({
    env: { BILLING_LIVE: "1" },
    isSilentAutoApplyEnabled: () => true,
    db: database,
  });
  assert.equal(on.silent.ok, false);
  assert.equal(on.billing.ok, false);

  const off = betaSafetyStatus({
    env: {},
    isSilentAutoApplyEnabled: () => false,
    db: database,
  });
  assert.equal(off.silent.ok, true);
  assert.equal(off.billing.ok, false);
  assert.match(off.billing.detail, /live card gateway/i);

  database.prepare("UPDATE payment_gateways SET enabled = 0 WHERE id = 'gw1'").run();
  const clean = betaSafetyStatus({
    env: {},
    isSilentAutoApplyEnabled: () => false,
    db: database,
  });
  assert.equal(clean.silent.ok, true);
  assert.equal(clean.billing.ok, true);
});
