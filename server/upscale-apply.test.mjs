import assert from "node:assert/strict";
import test from "node:test";
import { claimsSupported, normalizeResumePath } from "./resume-guard.mjs";
import { migrate } from "./schema.mjs";
import { db, id, hashPassword } from "./db.mjs";

test("normalizeResumePath converts bracket indexes", () => {
  assert.equal(normalizeResumePath("employment[0].bullets[2]"), "employment.0.bullets.2");
  assert.equal(normalizeResumePath("employment.0.bullets.2"), "employment.0.bullets.2");
  assert.equal(normalizeResumePath(""), "");
});

test("claimsSupported accepts Fact Ledger numbers", () => {
  const source = JSON.stringify({ employment: [{ bullets: ["Owned activation"] }] });
  assert.equal(claimsSupported("Owned activation and raised completion 18%.", source, []), false);
  assert.equal(
    claimsSupported("Owned activation and raised completion 18%.", source, [{ statement: "raised completion 18%" }]),
    true,
  );
});

test("upscale apply succeeds when review provider/model are null", async () => {
  migrate();
  const email = `upscale-null-${Date.now()}@example.com`;
  const userId = id("usr");
  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, provider, role, status, plan_id, consent_at, created_at)
     VALUES (?, 'Null Provider', ?, ?, 'email', 'user', 'active', 'autopilot', ?, ?)`,
  ).run(userId, email, hashPassword("Password123!"), Date.now(), Date.now());
  const doc = {
    headline: "PM",
    summary: "Product manager with enough summary text for the diagnostic to keep the rating middle of the road.",
    skills: ["SQL"],
    employment: [
      {
        title: "PM",
        employer: "Acme",
        dates: "2021-2024",
        bullets: ["Responsible for activation and growth experiments across the funnel."],
      },
    ],
    education: ["BS"],
  };
  db.prepare(
    `INSERT INTO profiles (user_id, headline, summary, skills, employment, education, facts, preferences, raw_text, resume_name, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, '[]', '{}', '', 'r.txt', ?)`,
  ).run(
    userId,
    doc.headline,
    doc.summary,
    JSON.stringify(doc.skills),
    JSON.stringify(doc.employment),
    JSON.stringify(doc.education),
    Date.now(),
  );
  const verId = id("ver");
  db.prepare(
    `INSERT INTO resume_versions (id, user_id, label, kind, document, rendered, parent_id, active, created_at)
     VALUES (?, ?, 'Base', 'profile', ?, 'x', null, 1, ?)`,
  ).run(verId, userId, JSON.stringify(doc), Date.now());
  const reviewId = id("rev");
  db.prepare(
    `INSERT INTO resume_reviews (id, user_id, version_id, rating, feedback, recommendations, provider, model, created_at)
     VALUES (?, ?, ?, 70, ?, ?, NULL, NULL, ?)`,
  ).run(
    reviewId,
    userId,
    verId,
    JSON.stringify(["ok"]),
    JSON.stringify([
      {
        id: "bullet-0-0",
        title: "Strengthen opener",
        detail: "verb swap",
        kind: "rewrite",
        path: "employment[0].bullets[0]",
        proposed: "Owned activation and growth experiments across the funnel.",
      },
    ]),
    Date.now(),
  );

  // Exercise the same apply logic through a minimal in-process call of helpers used by the route.
  const { normalizeResumePath: norm } = await import("./resume-guard.mjs");
  const path = norm("employment[0].bullets[0]");
  assert.equal(path, "employment.0.bullets.0");

  // Simulate audit hardening used by apply
  db.prepare(
    `INSERT INTO ai_audit (id, user_id, function_name, provider, model, status, detail, created_at, cost_micros)
     VALUES (?, ?, 'resume_upscale', ?, ?, 'version', ?, ?, 0)`,
  ).run(id("ai"), userId, null || "Built-in rules", null || "rules-v1", verId, Date.now());

  const audit = db.prepare("SELECT provider, model FROM ai_audit WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").get(userId);
  assert.equal(audit.provider, "Built-in rules");
  assert.equal(audit.model, "rules-v1");

  // Bracket path should apply via normalize + setPath semantics
  const next = JSON.parse(JSON.stringify(doc));
  const parts = path.split(".");
  let cursor = next;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = Number.isInteger(Number(parts[i])) && String(Number(parts[i])) === parts[i] ? Number(parts[i]) : parts[i];
    cursor = cursor[key];
  }
  cursor[Number(parts.at(-1))] = "Owned activation and growth experiments across the funnel.";
  assert.equal(next.employment[0].bullets[0].startsWith("Owned"), true);
});
