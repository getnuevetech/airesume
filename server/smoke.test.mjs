import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { extractRequirements, matchJob, matchLabel } from "./match.mjs";
import { claimsSupported, tailoredDocument } from "./resume-guard.mjs";

const here = dirname(fileURLToPath(import.meta.url));

test("extractRequirements splits mandatory and preferred skills", () => {
  const requirements = extractRequirements({
    title: "Product Manager",
    description: "Need 5 years of product management. Bachelor preferred.",
    skills: ["Product management", "SQL", "Roadmapping", "A/B testing", "Figma", "Excel", "Python", "Leadership", "Communication", "Notion"],
    role: "Product Manager",
    category: "Product",
  });
  assert.equal(requirements.mandatory.length, 8);
  assert.ok(requirements.preferred.length >= 1);
  assert.equal(requirements.years, 5);
  assert.match(requirements.education, /Bachelor/i);
});

test("matchJob uses hybrid weights and labels", () => {
  const doc = {
    skills: ["Product management", "SQL", "Roadmapping", "A/B testing"],
    employment: [{ title: "Product Manager", employer: "Acme", bullets: ["Owned activation with SQL"] }],
    education: ["B.S. Computer Science"],
  };
  const job = {
    title: "Senior Product Manager",
    role: "Product Manager",
    category: "Product",
    location: "Remote",
    remote_type: "remote",
    salary_min: 140000,
    salary_max: 180000,
    skills: JSON.stringify(["Product management", "SQL", "Roadmapping", "A/B testing"]),
    requirements: JSON.stringify({
      mandatory: ["Product management", "SQL", "Roadmapping"],
      preferred: ["A/B testing"],
      education: "Bachelor's",
      years: 5,
    }),
  };
  const match = matchJob(doc, { locations: "Remote", salary: "150000" }, job);
  assert.ok(match.score >= 70, `expected strongish score, got ${match.score}`);
  assert.equal(matchLabel(match.score), match.label);
  assert.ok(match.matched.includes("Product management"));
  assert.ok(match.explanation.length > 10);
});

test("claimsSupported rejects invented numbers", () => {
  assert.equal(claimsSupported("Grew revenue 40%", "Grew revenue"), false);
  assert.equal(claimsSupported("Grew revenue 40%", "Grew revenue 40%"), true);
  assert.equal(claimsSupported("Grew revenue 40%", "Grew revenue", [{ statement: "Grew revenue 40%" }]), true);
});

test("tailoredDocument only reorders existing content", () => {
  const doc = {
    skills: ["Excel", "Product management", "SQL"],
    employment: [
      { title: "Analyst", employer: "DataCo", bullets: ["Built Excel models"] },
      { title: "Product Manager", employer: "Acme", bullets: ["Shipped SQL dashboards", "Owned roadmap"] },
    ],
  };
  const match = {
    matched: ["Product management", "SQL"],
    preferredMatched: [],
    label: "good",
  };
  const next = tailoredDocument(doc, { title: "Product Manager", company: "Northstar" }, match, [
    { statement: "Product management" },
    { statement: "SQL" },
    { statement: "Acme" },
  ]);
  assert.equal(next.skills[0], "Product management");
  assert.equal(next.employment[0].title, "Product Manager");
  assert.deepEqual(
    next.employment.flatMap((job) => job.bullets).sort(),
    doc.employment.flatMap((job) => job.bullets).sort(),
  );
});

test("fresh data dir migrates and seeds schema version", () => {
  const dir = mkdtempSync(join(tmpdir(), "jobpilot-test-"));
  const script = `
    import { db } from "./db.mjs";
    import { migrate, SCHEMA_VERSION } from "./schema.mjs";
    migrate();
    const version = db.prepare("SELECT version FROM schema_version LIMIT 1").get();
    if (!version || version.version !== SCHEMA_VERSION) {
      console.error("bad version", version);
      process.exit(2);
    }
    const jobs = db.prepare("SELECT COUNT(*) AS count FROM jobs").get();
    if (!jobs || jobs.count < 1) process.exit(3);
    const sample = db.prepare("SELECT requirements FROM jobs LIMIT 1").get();
    const requirements = JSON.parse(sample.requirements || "{}");
    if (!Array.isArray(requirements.mandatory)) process.exit(4);
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
