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
      applyDraftToUser,
      exportAccountBundle,
      deleteAccountData,
      DRAFT_RETENTION_MS,
    } = await import("./onboarding.mjs");
    const { syncProfileVersion } = await import("./platform.mjs");

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
        employment: [{ title: "Product Manager", employer: "Acme", bullets: ["Shipped onboarding"] }],
        education: [],
        facts: [{ fact_id: "ID-001", statement: "Name: Alex Rivera", confidence: 0.9 }],
        preferences: { salary: "120000", workArrangement: "remote", locations: "Austin", workAuthorization: "authorized" },
        rawText: "Alex Rivera Product Manager Acme",
        resumeName: "resume.txt",
        resumeFileUrl: "/uploads/rs_demo.txt",
        consentAt: Date.now(),
      },
    });
    assert.ok(activation.devLink.includes("/verify?token="));
    assert.equal(activation.devCode.length, 6);
    const token = new URL(activation.devLink).searchParams.get("token");
    const row = findActivation({ token });
    assert.ok(row);
    const userId = activateFromRow(row);
    syncProfileVersion(userId);
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    assert.equal(user.email, "alex@example.com");
    assert.equal(user.status, "active");
    assert.ok(!db.prepare("SELECT id FROM drafts WHERE id = ?").get(draftId));
    const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(userId);
    assert.equal(profile.resume_name, "resume.txt");
    assert.equal(profile.resume_file_url, "/uploads/rs_demo.txt");
    const version = db.prepare("SELECT * FROM resume_versions WHERE user_id = ?").get(userId);
    assert.ok(version);
    assert.equal(version.label, "Uploaded resume");
    assert.equal(version.kind, "upload");
    assert.equal(version.active, 1);

    const exported = exportAccountBundle(userId);
    assert.equal(exported.account.email, "alex@example.com");
    assert.equal(exported.profile.skills[0], "SQL");
    assert.equal(exported.profile.resumeFileUrl, "/uploads/rs_demo.txt");

    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword("password123"), userId);
    deleteAccountData(userId);
    assert.equal(db.prepare("SELECT id FROM users WHERE id = ?").get(userId), undefined);
    assert.ok(sha256("x").length === 64);

    // Google / direct signup path: user exists first, then draft is claimed onto the account.
    const googleUserId = id("usr");
    db.prepare(
      `INSERT INTO users (id, name, email, password_hash, provider, role, status, consent_at, created_at)
       VALUES (?, 'Sam Google', 'sam@example.com', NULL, 'google', 'user', 'active', ?, ?)`,
    ).run(googleUserId, Date.now(), Date.now());
    const claimDraftId = id("draft");
    db.prepare("INSERT INTO drafts (id, payload, created_at) VALUES (?, ?, ?)").run(
      claimDraftId,
      JSON.stringify({
        name: "Sam Google",
        email: "sam@example.com",
        summary: "Engineer",
        skills: ["TypeScript"],
        employment: [{ title: "Engineer", employer: "Relay", bullets: ["Built APIs"] }],
        education: ["BS CS"],
        facts: [],
        rawText: "Sam Google Engineer",
        resumeName: "sam-resume.pdf",
        resumeFileUrl: "/uploads/rs_sam.pdf",
      }),
      Date.now(),
    );
    applyDraftToUser(googleUserId, {
      draftId: claimDraftId,
      name: "Sam Google",
      phone: "555-0100",
      city: "Dallas, TX",
      summary: "Engineer",
      skills: ["TypeScript"],
      employment: [{ title: "Engineer", employer: "Relay", bullets: ["Built APIs"] }],
      education: ["BS CS"],
      facts: [],
      preferences: { salary: "130k", workArrangement: "hybrid", locations: "Dallas", workAuthorization: "authorized" },
      rawText: "Sam Google Engineer",
      resumeName: "sam-resume.pdf",
      resumeFileUrl: "/uploads/rs_sam.pdf",
    });
    syncProfileVersion(googleUserId);
    const claimed = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(googleUserId);
    assert.ok(claimed);
    assert.equal(claimed.resume_name, "sam-resume.pdf");
    assert.equal(JSON.parse(claimed.skills)[0], "TypeScript");
    assert.ok(!db.prepare("SELECT id FROM drafts WHERE id = ?").get(claimDraftId));
    const claimedVersion = db.prepare("SELECT * FROM resume_versions WHERE user_id = ?").get(googleUserId);
    assert.equal(claimedVersion?.label, "Uploaded resume");
    assert.throws(
      () =>
        applyDraftToUser(googleUserId, {
          draftId: "x",
          summary: "again",
          skills: [],
          employment: [],
          education: [],
          facts: [],
        }),
      /already has a saved resume/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
    delete process.env.JOBPILOT_DATA_DIR;
  }
});
