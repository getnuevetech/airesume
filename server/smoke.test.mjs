import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { autoDecision, TRACKER_STATUSES } from "./apply-rules.mjs";
import { parseJobPaste } from "./job-import.mjs";
import { extractRequirements, matchJob, matchLabel } from "./match.mjs";
import { draftQuestions } from "./questions.mjs";
import { matchExplainLimit, redactMatch, resumeReviewLimit, startOfUtcWeek } from "./quota.mjs";
import { estimateCostMicros, moneyFromMicros } from "./ai-cost.mjs";
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

test("autoDecision never chooses silent submit", () => {
  assert.ok(TRACKER_STATUSES.includes("Ready"));
  assert.ok(TRACKER_STATUSES.includes("Review required"));
  const job = {
    title: "Product Manager",
    company: "Northstar",
    verification: "Active",
    location: "Remote",
    remote_type: "remote",
    salary_min: 140000,
    salary_max: 180000,
  };
  const strong = {
    score: 92,
    label: "strong",
    missing: [],
  };
  const ready = autoDecision(job, strong, { locations: "Remote", salary: "150000" }, { auto_min: 85 });
  assert.equal(ready.action, "ready");

  const review = autoDecision(
    { ...job, verification: "Needs review" },
    strong,
    { locations: "Remote" },
    { auto_min: 85 },
  );
  assert.equal(review.action, "review");

  const skipped = autoDecision(job, strong, { excludeCompanies: "Northstar" }, { auto_min: 85 });
  assert.equal(skipped.action, "skip");

  const missing = autoDecision(job, { score: 90, label: "strong", missing: ["SQL"] }, {}, { auto_min: 85 });
  assert.equal(missing.action, "review");
});

test("parseJobPaste extracts title company and requirements", () => {
  const draft = parseJobPaste({
    text: `Senior Product Manager
Northstar
Location: Remote
Salary: $140,000 - $170,000

Requirements:
- Product management
- SQL
- Roadmapping

Nice to have:
- A/B testing

Are you authorized to work in the US?
What are your salary expectations?
`,
  });
  assert.equal(draft.title, "Senior Product Manager");
  assert.equal(draft.company, "Northstar");
  assert.equal(draft.remoteType, "remote");
  assert.ok(draft.requirements.mandatory.includes("Product management"));
  assert.ok(draft.salaryMin >= 140000);
});

test("draftQuestions leaves salary and authorization blank", () => {
  const questions = draftQuestions(
    {
      title: "Product Manager",
      company: "Northstar",
      description: "What are your salary expectations?\nAre you authorized to work in the US?\nTell us about a launch you led.",
    },
    {
      skills: ["Product management", "SQL"],
      employment: [{ title: "PM", employer: "Acme", bullets: ["Led an onboarding launch"] }],
      summary: "Product manager",
    },
    { salary: "150000", workAuthorization: "US citizen" },
    { matched: ["Product management"], missing: [] },
  );
  const salary = questions.find((item) => /salary/i.test(item.prompt));
  const auth = questions.find((item) => /authoriz/i.test(item.prompt));
  assert.ok(salary);
  assert.equal(salary.answer, "");
  assert.ok(salary.blankReason);
  assert.ok(auth);
  assert.equal(auth.answer, "");
  assert.ok(questions.some((item) => item.kind === "draft" && item.answer));
});

test("matchExplainLimit treats 0 as unlimited and redacts locked matches", () => {
  assert.equal(matchExplainLimit({ match_explain_limit: 5 }), 5);
  assert.equal(matchExplainLimit({ match_explain_limit: 0 }), 0);
  assert.equal(resumeReviewLimit({ resume_review_limit: 3 }), 3);
  assert.equal(resumeReviewLimit({ resume_review_limit: 0 }), 0);
  assert.equal(resumeReviewLimit({}), 3);
  const redacted = redactMatch({ score: 90, label: "strong", explanation: "hi", matched: ["SQL"], missing: [], preferredMatched: [] });
  assert.equal(redacted.explanation, "");
  assert.equal(redacted.explanationLocked, true);
  assert.ok(startOfUtcWeek() > 0);
});

test("estimateCostMicros is zero for deterministic and positive for mini models", () => {
  assert.equal(estimateCostMicros({ kind: "deterministic", model: "rules-v1", system: "a", user: "b" }), 0);
  const paid = estimateCostMicros({
    kind: "openai",
    model: "gpt-4o-mini",
    system: "Review this resume. ".repeat(200),
    user: "Profile JSON goes here. ".repeat(400),
    response: '{"rating":80}'.repeat(20),
  });
  assert.ok(paid > 0);
  assert.ok(moneyFromMicros(paid).startsWith("$"));
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
    const columns = db.prepare("PRAGMA table_info(applications)").all().map((row) => row.name);
    if (!columns.includes("questions")) process.exit(5);
    if (!db.prepare("PRAGMA table_info(users)").all().some((row) => row.name === "auto_daily_cap")) process.exit(6);
    const views = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='match_explanation_views'").get();
    if (!views) process.exit(7);
    const free = JSON.parse(db.prepare("SELECT features FROM plans WHERE id='free'").get().features);
    if (free.match_explain_limit !== 5) process.exit(8);
    if (free.resume_review_limit !== 3) process.exit(9);
    if (!db.prepare("PRAGMA table_info(ai_audit)").all().some((row) => row.name === "cost_micros")) process.exit(10);
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
