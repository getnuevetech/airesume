import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildApplyKit } from "./apply-kit.mjs";
import { listingsFromJson, normalizeFeedUrl } from "./feeds.mjs";
import { matchJob } from "./match.mjs";
import { draftQuestions } from "./questions.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(here, "fixtures", "greenhouse-board.json"), "utf8"));

test("confirmed signup stores resume text and a verified fact", () => {
  const dir = mkdtempSync(join(tmpdir(), "jp-candidate-"));
  const script = `
    import { db, id } from "./db.mjs";
    import { migrate } from "./schema.mjs";
    import { createEmailActivation, findActivation, activateFromRow } from "./onboarding.mjs";
    migrate();
    const draftId = id("draft");
    const rawText = "Alex Rivera. Product Manager at Acme. Skills: SQL.";
    db.prepare("INSERT INTO drafts (id, payload, created_at) VALUES (?, ?, ?)").run(draftId, "{}", Date.now());
    const activation = await createEmailActivation({
      origin: "http://127.0.0.1",
      payload: {
        draftId,
        name: "Alex Rivera",
        email: "alex-path@example.com",
        summary: "Product manager",
        skills: ["SQL"],
        employment: [{ title: "Product Manager", employer: "Acme", bullets: ["Shipped onboarding"] }],
        education: [],
        facts: [{ fact_id: "SKILL-001", category: "skill", statement: "SQL", confidence: 0.95 }],
        preferences: { salary: "120000", workArrangement: "remote", locations: "Remote", workAuthorization: "authorized" },
        rawText,
        resumeName: "resume.txt",
        resumeFileUrl: "/uploads/resume.txt",
        consentAt: Date.now(),
      },
    });
    const token = new URL(activation.devLink).searchParams.get("token");
    const userId = activateFromRow(findActivation({ token }));
    const profile = db.prepare("SELECT raw_text, facts FROM profiles WHERE user_id = ?").get(userId);
    if (!profile || !String(profile.raw_text).includes("Alex Rivera")) process.exit(2);
    const facts = JSON.parse(profile.facts || "[]");
    const skill = facts.find((fact) => fact.fact_id === "SKILL-001");
    if (!skill || !skill.verified_by_user) process.exit(3);
  `;
  try {
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: here,
      env: { ...process.env, JOBPILOT_DATA_DIR: dir },
      encoding: "utf8",
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("candidate path keeps resume facts, parses a board, matches, and leaves sensitive answers blank", () => {
  const rawText = "Alex Rivera. Product Manager at Acme. Skills: SQL, product management.";
  const facts = [
    {
      fact_id: "SKILL-001",
      category: "skill",
      statement: "SQL",
      confidence: 0.95,
      verified_by_user: true,
      source_fact_ids: ["SKILL-001"],
    },
    {
      fact_id: "SKILL-002",
      category: "skill",
      statement: "product management",
      confidence: 0.95,
      verified_by_user: true,
      source_fact_ids: ["SKILL-002"],
    },
  ];
  const profile = {
    raw_text: rawText,
    facts: JSON.stringify(facts),
    skills: JSON.stringify(["SQL", "product management"]),
    employment: JSON.stringify([{ title: "Product Manager", employer: "Acme", bullets: ["Shipped onboarding"] }]),
    education: JSON.stringify(["B.S. Computer Science"]),
    summary: "Product manager",
    preferences: JSON.stringify({ locations: "Remote", salary: "120000", workArrangement: "remote" }),
  };
  assert.match(profile.raw_text, /Alex Rivera/);
  assert.ok(JSON.parse(profile.facts).some((fact) => fact.verified_by_user && fact.fact_id === "SKILL-001"));

  assert.throws(() => normalizeFeedUrl("https://www.indeed.com/jobs?q=nurse"), /Indeed/);

  const listings = listingsFromJson(fixture, "Acme");
  assert.equal(listings.length, 1);
  assert.equal(listings[0].title, "Product Manager");
  assert.equal(listings[0].company, "Acme");

  const doc = {
    summary: profile.summary,
    skills: JSON.parse(profile.skills),
    employment: JSON.parse(profile.employment),
    education: JSON.parse(profile.education),
  };
  const job = {
    title: listings[0].title,
    company: listings[0].company,
    primary_company: "Acme",
    role: "Product Manager",
    category: "Product",
    location: "Remote",
    remote_type: "remote",
    salary_min: 120000,
    salary_max: 150000,
    description: fixture.jobs[0].content,
    skills: JSON.stringify(["SQL", "product management"]),
    requirements: JSON.stringify({
      mandatory: ["SQL", "product management"],
      preferred: [],
      education: "",
      years: 0,
    }),
    primary_url: listings[0].sourceUrl,
    source_url: listings[0].sourceUrl,
  };
  const match = matchJob(doc, { locations: "Remote", salary: "120000" }, job, { facts });
  assert.ok(match.score >= 50, `expected a usable score, got ${match.score}`);
  assert.match(match.explanation, /SKILL-001/);
  assert.match(match.explanation, /SQL/);

  const questions = draftQuestions(job, doc, { salary: "120000" }, match);
  const sensitive = questions.filter((item) => /salary|sponsor|authorization/i.test(item.prompt));
  assert.ok(sensitive.length >= 3);
  for (const item of sensitive) {
    assert.equal(item.answer, "");
    assert.match(item.blankReason, /must be entered by you/);
  }

  const kit = buildApplyKit({
    user: { name: "Alex Rivera", email: "alex@example.com", phone: "", city: "Austin", address: "" },
    profile,
    job,
    application: {
      id: "app_1",
      status: "Ready",
      mode: "assisted",
      target_url: job.primary_url,
      target_company: "Acme",
      questions,
    },
    version: { id: "ver_1", label: "Uploaded resume", rendered: rawText },
    preferences: {},
  });
  assert.equal(kit.resumeText, rawText);
  for (const item of kit.answers.filter((answer) => /salary|sponsor|authorization/i.test(answer.prompt))) {
    assert.equal(item.answer, "");
  }
});
