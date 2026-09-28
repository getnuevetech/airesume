import assert from "node:assert/strict";
import test from "node:test";
import { authenticitySignals, findDuplicateJobs, normalizeJobListing } from "./job-schema.mjs";
import { extractJobRequirements } from "./job-requirements.mjs";
import { computeApplicationReadiness } from "./readiness.mjs";
import { matchLabel, matchLabelKey } from "./match.mjs";

test("normalizeJobListing maps shared schema fields", () => {
  const job = normalizeJobListing({
    title: "Network Engineer",
    company_name: "Acme",
    location: "Remote",
    remote_type: "remote",
    salary_min: 120000,
    salary_max: 150000,
    description: "Need Cisco routing and 5 years experience.",
    skills: ["Cisco", "AWS"],
    url: "https://example.com/jobs/1",
  });
  assert.equal(job.title, "Network Engineer");
  assert.equal(job.company, "Acme");
  assert.equal(job.remote_type, "remote");
  assert.equal(job.salary_min, 120000);
  assert.equal(job.source_url, "https://example.com/jobs/1");
  assert.ok(job.skills.includes("Cisco"));
});

test("authenticitySignals flags duplicates, expired, and staffing listings", () => {
  const expired = authenticitySignals({
    title: "Ops Lead",
    company: "Acme",
    description: "This position has been filled and the listing expired.",
    source_url: "https://acme.com/jobs/1",
  });
  assert.equal(expired.verification, "Listing may be expired");

  const staffing = authenticitySignals({
    title: "Engineer",
    company: "Staffing Hub Recruiting",
    description: "Great role",
  });
  assert.equal(staffing.verification, "Third-party recruiter");

  const duplicates = findDuplicateJobs(
    { title: "PM", company: "Acme", location: "Remote", source_url: "https://a.com/1" },
    [{ id: "job_2", title: "PM", company: "Acme", location: "Remote" }],
  );
  assert.equal(duplicates.length, 1);
});

test("extractJobRequirements falls back to deterministic rules", async () => {
  const result = await extractJobRequirements({
    title: "Product Manager",
    description: "Requirements: SQL, Product management. Nice to have: Figma. 5 years experience. Bachelor preferred.",
    skills: ["SQL", "Product management", "Figma"],
  });
  assert.ok(result.requirements.mandatory.length >= 1);
  assert.ok(result.requirements.years === 5 || result.requirements.years == null || Number(result.requirements.years) === 5);
});

test("match labels use threshold display names", () => {
  assert.equal(matchLabel(90), "Strong match");
  assert.equal(matchLabel(72), "Good match");
  assert.equal(matchLabelKey("Strong match"), "strong");
});

test("computeApplicationReadiness gates sensitive blanks and weak matches", () => {
  const blocked = computeApplicationReadiness({
    match: { score: 40, missing: ["Cisco", "AWS", "Python"], matched: [], requirements: { mandatory: ["Cisco", "AWS", "Python"] } },
    application: {
      questions: [{ id: "authorization", prompt: "Authorized?", answer: "", kind: "user" }],
    },
    version: null,
    preferences: {},
    verification: "Listing may be expired",
  });
  assert.equal(blocked.state, "USER_ACTION_REQUIRED");
  assert.ok(blocked.blockers.length >= 2);

  const ready = computeApplicationReadiness({
    match: { score: 88, missing: [], matched: ["SQL"], requirements: { mandatory: ["SQL"] } },
    application: {
      questions: [{ id: "why-fit", prompt: "Why?", answer: "Because of SQL", kind: "draft" }],
    },
    version: { rendered: "resume text" },
    preferences: { workAuthorization: "Authorized" },
    verification: "Active",
  });
  assert.equal(ready.state, "APPLICATION_READY");
});
