import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("onboarding helpers cover prefs, drafts, export, and activation", async () => {
  const dir = mkdtempSync(join(tmpdir(), "jp-onboard-"));
  process.env.JOBPILOT_DATA_DIR = dir;
  try {
    const { db, id, hashPassword, sha256 } = await import("./db.mjs");
    const { migrate, SCHEMA_VERSION } = await import("./schema.mjs");
    migrate();
    assert.equal(db.prepare("SELECT version FROM schema_version LIMIT 1").get().version, SCHEMA_VERSION);

    const {
      missingPreferenceFields,
      purgeExpiredDrafts,
      createEmailActivation,
      findActivation,
      activateFromRow,
      exportAccountBundle,
      deleteAccountData,
      DRAFT_RETENTION_MS,
    } = await import("./onboarding.mjs");

    const missing = missingPreferenceFields({}, { city: "" });
    assert.ok(missing.some((item) => item.key === "salary"));
    assert.ok(missing.some((item) => item.key === "workAuthorization"));
    assert.equal(missing.find((item) => item.key === "salary")?.inputType, "select");
    assert.ok((missing.find((item) => item.key === "salary")?.options || []).length > 2);
    assert.equal(missing.find((item) => item.key === "workArrangement")?.inputType, "select");
    assert.equal(missing.find((item) => item.key === "workAuthorization")?.inputType, "select");
    assert.equal(
      missingPreferenceFields({ salary: "120k", workArrangement: "remote", locations: "TX", workAuthorization: "authorized" }, {}).length,
      0,
    );

    db.prepare("INSERT INTO drafts (id, payload, created_at) VALUES (?, ?, ?)").run("draft_old", "{}", Date.now() - DRAFT_RETENTION_MS - 1000);
    db.prepare("INSERT INTO drafts (id, payload, created_at) VALUES (?, ?, ?)").run("draft_new", "{}", Date.now());
    assert.equal(purgeExpiredDrafts(), 1);
    assert.equal(db.prepare("SELECT id FROM drafts WHERE id = 'draft_new'").get()?.id, "draft_new");

    const draftId = id("draft");
    db.prepare("INSERT INTO drafts (id, payload, created_at) VALUES (?, ?, ?)").run(
      draftId,
      JSON.stringify({ name: "Alex Rivera", email: "alex@example.com", skills: ["SQL"] }),
      Date.now(),
    );
    const activation = await createEmailActivation({
      origin: "http://localhost:5173",
      payload: {
        draftId,
        name: "Alex Rivera",
        email: "alex@example.com",
        phone: "",
        address: "",
        city: "Austin, TX",
        summary: "PM",
        skills: ["SQL"],
        employment: [],
        education: [],
        facts: [{ fact_id: "ID-001", statement: "Name: Alex Rivera", confidence: 0.9 }],
        preferences: { salary: "120000", workArrangement: "remote", locations: "Austin", workAuthorization: "authorized" },
        rawText: "Alex Rivera",
        resumeName: "resume.txt",
        consentAt: Date.now(),
      },
    });
    assert.ok(activation.devLink.includes("/verify?token="));
    assert.equal(activation.devCode.length, 6);
    const token = new URL(activation.devLink).searchParams.get("token");
    const row = findActivation({ token });
    assert.ok(row);
    const userId = activateFromRow(row);
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    assert.equal(user.email, "alex@example.com");
    assert.equal(user.status, "active");
    assert.ok(!db.prepare("SELECT id FROM drafts WHERE id = ?").get(draftId));

    const exported = exportAccountBundle(userId);
    assert.equal(exported.account.email, "alex@example.com");
    assert.equal(exported.profile.skills[0], "SQL");

    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword("password123"), userId);
    deleteAccountData(userId);
    assert.equal(db.prepare("SELECT id FROM users WHERE id = ?").get(userId), undefined);
    assert.ok(sha256("x").length === 64);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    delete process.env.JOBPILOT_DATA_DIR;
  }
});
