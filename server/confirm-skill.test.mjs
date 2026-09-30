import test from "node:test";
import assert from "node:assert/strict";
import { confirmListedSkill } from "./confirm-skill.mjs";

const profile = {
  summary: "Product manager.",
  skills: ["Product management", "SQL"],
  employment: [],
};
const document = {
  summary: "Product manager.",
  skills: ["Product management", "SQL"],
  employment: [],
};
const facts = [
  {
    fact_id: "SKILL-001",
    category: "skill",
    statement: "Product management",
    confidence: 1,
    source: "profile",
    verified_by_user: true,
    source_fact_ids: ["SKILL-001"],
  },
];

test("a skill that is not a gap on the listing is rejected", () => {
  assert.throws(
    () =>
      confirmListedSkill({
        profile,
        facts,
        document,
        missing: ["Roadmapping", "A/B testing"],
        skill: "Kubernetes",
      }),
    /That skill is not a gap on this listing/,
  );
});

test("confirming a missing skill stores the listing spelling as a verified fact and resume skill", () => {
  const result = confirmListedSkill({
    profile,
    facts,
    document,
    missing: ["Roadmapping", "A/B testing"],
    skill: "roadmapping",
  });
  assert.equal(result.already, false);
  assert.equal(result.skill, "Roadmapping");
  assert.ok(result.profile.skills.includes("Roadmapping"));
  assert.ok(result.document.skills.includes("Roadmapping"));
  const added = result.facts.find((fact) => fact.statement === "Roadmapping");
  assert.ok(added);
  assert.equal(added.category, "skill");
  assert.equal(added.verified_by_user, true);
  assert.equal(added.source, "user_clarification");
  assert.equal(added.confidence, 1);

  const again = confirmListedSkill({
    profile: result.profile,
    facts: result.facts,
    document: result.document,
    missing: ["Roadmapping", "A/B testing"],
    skill: "Roadmapping",
  });
  assert.equal(again.already, true);
  assert.equal(again.facts.length, result.facts.length);
  assert.equal(again.facts.filter((fact) => fact.statement === "Roadmapping").length, 1);
});
