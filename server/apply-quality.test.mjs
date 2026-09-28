import assert from "node:assert/strict";
import test from "node:test";
import { buildApplyKit } from "./apply-kit.mjs";
import { applyKitMetrics, recordApplyKitEvent } from "./apply-kit-metrics.mjs";
import { computeApplicationReadiness } from "./readiness.mjs";
import { migrate, SCHEMA_VERSION } from "./schema.mjs";
import { db, id } from "./db.mjs";

test("schema version is 17 for apply kit events", () => {
  assert.equal(SCHEMA_VERSION, 17);
  migrate();
  const columns = db.prepare("PRAGMA table_info(apply_kit_events)").all();
  assert.ok(columns.some((column) => column.name === "event"));
});

test("buildApplyKit exposes pinned version metadata for Assisted Apply", () => {
  const kit = buildApplyKit({
    user: { name: "Alex", email: "a@example.com", phone: "", city: "", address: "" },
    profile: {},
    job: { title: "PM", company: "Acme", primary_company: "Acme", primary_url: "https://jobs.example/pm" },
    application: {
      id: "app_1",
      status: "Review required",
      mode: "assisted",
      version_id: "ver_1",
      target_company: "Acme",
      target_url: "https://jobs.example/pm",
      questions: [],
    },
    version: { id: "ver_1", label: "For Acme — PM", rendered: "Alex\nPM" },
    preferences: {},
  });
  assert.equal(kit.mode, "assisted");
  assert.equal(kit.versionId, "ver_1");
  assert.equal(kit.versionLabel, "For Acme — PM");
  assert.equal(kit.versionPinned, true);
  assert.equal(kit.eligible, true);
});

test("apply kit metrics track opened copied completed funnel", () => {
  migrate();
  const userId = id("usr");
  const appId = id("app");
  recordApplyKitEvent(userId, appId, "opened");
  recordApplyKitEvent(userId, appId, "copied", "Email");
  recordApplyKitEvent(userId, appId, "completed");
  const metrics = applyKitMetrics({ userId });
  assert.equal(metrics.kitsOpened, 1);
  assert.equal(metrics.kitsCompleted, 1);
  assert.equal(metrics.completionRate, 100);
  assert.ok(metrics.copied >= 1);
  const one = applyKitMetrics({ userId, applicationId: appId });
  assert.equal(one.completed, 1);
});

test("readiness blocks email-submit style packages with sensitive blanks", () => {
  const readiness = computeApplicationReadiness({
    match: { score: 80, missing: [], matched: ["SQL"], requirements: { mandatory: ["SQL"] } },
    application: {
      questions: [{ id: "salary", prompt: "Salary?", kind: "user", answer: "", blankReason: "Sensitive" }],
      match_score: 80,
    },
    version: { rendered: "Alex" },
    preferences: { workAuthorization: "Authorized" },
    verification: "Active",
  });
  assert.equal(readiness.state, "USER_ACTION_REQUIRED");
  assert.ok(readiness.blockers.some((item) => /sensitive/i.test(item)));
});
