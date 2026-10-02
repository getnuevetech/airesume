import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { hashPassword, verifyPassword } from "./db.mjs";
import { computeLaunchReadiness } from "./launch-readiness.mjs";
import { scanLegalPlaceholders } from "./legal-placeholders.mjs";
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

test("launch readiness fails closed without SMTP and production env; MFA stays informational", () => {
  const report = computeLaunchReadiness({
    env: { NODE_ENV: "development", COOKIE_SECURE: "0", REQUIRE_ADMIN_MFA: "0" },
    mail: { configured: false, host: "", fromEmail: "" },
    ice: { productionReady: false, warning: "TURN missing" },
    adminMfaEnrolled: false,
    legal: cleanLegal,
    defaultAdmin: cleanDefaultAdmin,
  });
  assert.equal(report.opsReady, false);
  assert.equal(report.launchReady, false);
  assert.ok(report.checks.some((item) => item.id === "smtp" && !item.ok));
  assert.ok(report.checks.some((item) => item.id === "admin_mfa_policy" && item.ok && item.severity === "info"));
  assert.ok(report.checks.some((item) => item.id === "counsel" && !item.ok));
  assert.ok(report.checks.some((item) => item.id === "legal_placeholders" && item.ok));
  assert.ok(report.checks.some((item) => item.id === "default_admin_password" && item.ok));
});

test("launch readiness opsReady when production signals are green (counsel still open)", () => {
  const report = computeLaunchReadiness({
    env: { NODE_ENV: "production", COOKIE_SECURE: "1", REQUIRE_ADMIN_MFA: "1" },
    mail: { configured: true, host: "smtp.example.com", fromEmail: "hello@example.com" },
    ice: { productionReady: true, warning: "" },
    adminMfaEnrolled: true,
    legal: cleanLegal,
    defaultAdmin: cleanDefaultAdmin,
  });
  assert.equal(report.opsReady, true);
  assert.equal(report.launchReady, false);
  assert.ok(report.checks.some((item) => item.id === "turn" && item.ok));
  assert.ok(report.checks.some((item) => item.id === "counsel" && !item.ok));
  assert.ok(report.checks.some((item) => item.id === "legal_placeholders" && item.ok));
  assert.ok(report.checks.some((item) => item.id === "default_admin_password" && item.ok));
});

test("unfinished legal placeholders block opsReady even when SMTP and production are green", () => {
  const report = computeLaunchReadiness({
    env: { NODE_ENV: "production", COOKIE_SECURE: "1" },
    mail: { configured: true, host: "smtp.example.com", fromEmail: "hello@example.com" },
    ice: { productionReady: true, warning: "" },
    adminMfaEnrolled: true,
    legal: {
      ok: false,
      hits: [{ file: "src/content/terms.ts", label: "Terms", ids: ["COMPANY_LEGAL_NAME"] }],
      placeholderIds: ["COMPANY_LEGAL_NAME"],
      detail: "Unfinished legal copy in Terms: COMPANY_LEGAL_NAME.",
    },
    defaultAdmin: cleanDefaultAdmin,
  });
  assert.equal(report.opsReady, false);
  assert.equal(report.launchReady, false);
  assert.ok(report.checks.some((item) => item.id === "legal_placeholders" && !item.ok));
});

test("published default admin password blocks opsReady", () => {
  const report = computeLaunchReadiness({
    env: { NODE_ENV: "production", COOKIE_SECURE: "1" },
    mail: { configured: true, host: "smtp.example.com", fromEmail: "hello@example.com" },
    ice: { productionReady: true, warning: "" },
    adminMfaEnrolled: true,
    legal: cleanLegal,
    defaultAdmin: {
      ok: false,
      detail: "admin@jobpilot.app still accepts the published default password.",
    },
  });
  assert.equal(report.opsReady, false);
  assert.ok(report.checks.some((item) => item.id === "default_admin_password" && !item.ok));
});

test("scanLegalPlaceholders finds company and counsel markers in the repo copy", () => {
  const result = scanLegalPlaceholders(join(import.meta.dirname, ".."));
  assert.equal(result.ok, false);
  assert.ok(result.placeholderIds.includes("COMPANY_LEGAL_NAME"));
  assert.ok(result.placeholderIds.includes("PRIVACY_EMAIL"));
  assert.ok(result.placeholderIds.includes("ARBITRATION_PLACEHOLDER") || result.placeholderIds.includes("DRAFT_FOR_COUNSEL"));
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
