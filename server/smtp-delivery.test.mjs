import assert from "node:assert/strict";
import test from "node:test";
import { db } from "./db.mjs";
import {
  publicMailSettings,
  recordSmtpTestSuccess,
  saveMailSettings,
  smtpDeliveryStatus,
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
