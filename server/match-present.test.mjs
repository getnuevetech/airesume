import test from "node:test";
import assert from "node:assert/strict";
import { presentMatch, presentSkillFacts } from "./match-present.mjs";

test("a match view names skills and hides fact ids", () => {
  const view = presentMatch({
    explanation: "Overlaps on SQL [SKILL-001], Product management [SKILL-002]. Missing Figma. Location fits your preferences. Semantic overlap looks supportive (display-only).",
    matched: ["SQL", "Product management"],
    missing: ["Figma"],
    matchedFacts: [
      { skill: "SQL", fact_ids: ["SKILL-001"] },
      { skill: "Product management", fact_ids: ["SKILL-002"] },
    ],
  });
  assert.equal(view.summary.includes("SKILL-001"), false);
  assert.equal(view.summary.includes("Semantic"), false);
  assert.match(view.summary, /Fits SQL and Product management/);
  assert.match(view.summary, /Missing Figma/);
  assert.deepEqual(view.fits, ["SQL", "Product management"]);
  assert.deepEqual(view.gaps, ["Figma"]);
  assert.deepEqual(view.notes, ["Location fits your preferences."]);
});

test("paste field labels are not shown as missing skills", () => {
  const view = presentMatch({
    explanation: "Missing Title: Recruiter / Talent Acquisition, Company: Baupal GmbH, Location: Berlin.",
    matched: [],
    missing: ["Title: Recruiter / Talent Acquisition", "Company: Baupal GmbH", "Location: Berlin"],
    matchedFacts: [],
  });
  assert.equal(view.summary, "Limited overlap with this listing.");
  assert.deepEqual(view.gaps, []);
});

test("profile skill facts name the skill and hide the ledger id", () => {
  const view = presentSkillFacts([
    {
      fact_id: "SKILL-001",
      category: "skill",
      statement: "Communication",
      confidence: 1,
      verified_by_user: true,
      source_fact_ids: ["SKILL-001"],
    },
    {
      fact_id: "SKILL-002",
      category: "skill",
      statement: "Kubernetes",
      confidence: 0.2,
      verified_by_user: false,
    },
    { fact_id: "EXP-001", category: "employment", statement: "Analyst at DataCo" },
  ]);
  assert.deepEqual(view, [
    { name: "Communication", verified: true, confidence: 1 },
    { name: "Kubernetes", verified: false, confidence: 0.2 },
  ]);
  assert.equal(JSON.stringify(view).includes("SKILL-001"), false);
});

test("a match with no shared skills says the overlap is limited", () => {
  const view = presentMatch({
    explanation: "Limited overlap with the listing. Location is a stretch.",
    matched: [],
    missing: ["Communication"],
    matchedFacts: [],
  });
  assert.match(view.summary, /Missing Communication/);
  assert.equal(view.fits.length, 0);
  assert.deepEqual(view.notes, ["Location is a stretch for your preferences."]);
});
