import assert from "node:assert/strict";
import test from "node:test";
import {
  citeSkillFact,
  rebuildFactsFromProfile,
  skillsForMatching,
} from "./fact-ledger.mjs";
import { matchJob } from "./match.mjs";

test("rebuildFactsFromProfile pads ids and marks verified", () => {
  const facts = rebuildFactsFromProfile({
    name: "Alex",
    email: "alex@example.com",
    skills: ["SQL", "Product"],
    employment: [{ title: "PM", employer: "Acme", dates: "2021-2024" }],
  });
  assert.ok(facts.some((fact) => fact.fact_id === "SKILL-001" && fact.statement === "SQL" && fact.verified_by_user));
  assert.ok(facts.some((fact) => fact.fact_id === "EXP-001" && fact.source_fact_ids.includes("EXP-001")));
});

test("low-confidence unverified skills are excluded from matching", () => {
  const facts = [
    { fact_id: "SKILL-001", category: "skill", statement: "SQL", confidence: 0.9, verified_by_user: false },
    { fact_id: "SKILL-002", category: "skill", statement: "Kubernetes", confidence: 0.2, verified_by_user: false },
  ];
  const owned = skillsForMatching(["SQL", "Kubernetes"], facts);
  assert.deepEqual(owned, ["SQL"]);
});

test("matchJob cites source fact ids in explanation", () => {
  const facts = rebuildFactsFromProfile({
    name: "Alex",
    skills: ["SQL", "Product management", "Roadmapping"],
    employment: [{ title: "PM", employer: "Acme" }],
  });
  const match = matchJob(
    { skills: ["SQL", "Product management", "Roadmapping"], employment: [{ title: "PM", employer: "Acme", bullets: [] }], summary: "" },
    { locations: "Remote", salary: "150000" },
    {
      title: "Product Manager",
      company: "Northstar",
      location: "Remote",
      remote_type: "remote",
      salary_min: 140000,
      salary_max: 180000,
      description: "Own activation with SQL",
      skills: JSON.stringify(["SQL", "Product management", "Roadmapping"]),
      requirements: JSON.stringify({ mandatory: ["SQL", "Product management"], preferred: ["Roadmapping"] }),
    },
    { facts },
  );
  assert.ok(match.matchedFacts.some((item) => item.skill === "SQL" && item.fact_ids.includes("SKILL-001")));
  assert.match(match.explanation, /SKILL-001/);
  assert.equal(match.semanticHint, null);
  const withHint = matchJob(
    { skills: ["SQL"], employment: [], summary: "activation experiments" },
    {},
    { title: "PM", description: "activation experiments", skills: "[]", requirements: "{}" },
    { facts, embeddings: true },
  );
  assert.equal(typeof withHint.semanticHint, "number");
});

test("citeSkillFact returns empty ids when unknown", () => {
  const cited = citeSkillFact("ObscureTool", []);
  assert.deepEqual(cited.fact_ids, []);
  assert.equal(cited.verified, true);
});
