import assert from "node:assert/strict";
import test from "node:test";
import { db } from "./db.mjs";
import {
  formatSmtpConnectError,
  publicMailSettings,
  recordSmtpTestSuccess,
  saveMailSettings,
  smtpDeliveryStatus,
  smtpSecureForPort,
} from "./mail.mjs";

function clearMailSettings() {
  db.prepare("DELETE FROM settings WHERE key IN ('smtp', 'smtp_last_test')").run();
}

test("SMTP delivery stays unproven until a successful test is recorded", () => {
  clearMailSettings();
  const saved = saveMailSettings({
    host: "smtp.example.com",
    port: 587,
    secure: false,
    user: "mailer",
    password: "secret",
    fromEmail: "hello@example.com",
    fromName: "JobPilot",
  });
  assert.equal(saved.configured, true);
  assert.equal(saved.deliveryProven, false);
  assert.equal(smtpDeliveryStatus().deliveryProven, false);

  const proven = recordSmtpTestSuccess({ to: "ops@example.com" });
  assert.equal(proven.deliveryProven, true);
  assert.equal(publicMailSettings().deliveryProven, true);
  assert.equal(publicMailSettings().lastTestTo, "ops@example.com");
});

test("changing SMTP host clears the last successful test", () => {
  clearMailSettings();
  saveMailSettings({
    host: "smtp.example.com",
    port: 587,
    secure: false,
    user: "mailer",
    password: "secret",
    fromEmail: "hello@example.com",
    fromName: "JobPilot",
  });
  recordSmtpTestSuccess({ to: "ops@example.com" });
  assert.equal(publicMailSettings().deliveryProven, true);

  const next = saveMailSettings({
    host: "smtp.other.example",
    port: 587,
    secure: false,
    user: "mailer",
    fromEmail: "hello@example.com",
    fromName: "JobPilot",
  });
  assert.equal(next.configured, true);
  assert.equal(next.deliveryProven, false);
  assert.equal(next.lastTestAt, null);
});

test("smtpSecureForPort forces 465 TLS on and 587/25 off", () => {
  assert.equal(smtpSecureForPort(465, false), true);
  assert.equal(smtpSecureForPort(587, true), false);
  assert.equal(smtpSecureForPort(25, true), false);
  assert.equal(smtpSecureForPort(2525, true), true);
  assert.equal(smtpSecureForPort(2525, false), false);
});

test("saveMailSettings corrects implicit TLS when port is 587", () => {
  clearMailSettings();
  const saved = saveMailSettings({
    host: "smtp.example.com",
    port: 587,
    secure: true,
    user: "mailer",
    password: "secret",
    fromEmail: "hello@example.com",
    fromName: "JobPilot",
  });
  assert.equal(saved.port, 587);
  assert.equal(saved.secure, false);
});

test("formatSmtpConnectError names host, port, and TLS mode", () => {
  const message = formatSmtpConnectError(
    { host: "smtp.example.com", port: 587, secure: false },
    { code: "ETIMEDOUT" },
  );
  assert.match(message, /smtp\.example\.com:587/);
  assert.match(message, /STARTTLS/);
  assert.match(message, /outbound SMTP/i);
});
