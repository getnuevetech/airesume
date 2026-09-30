import test from "node:test";
import assert from "node:assert/strict";
import { confirmInsightGap, confirmListedSkill, preparedResumeAfterConfirm, preparedResumesAfterConfirm } from "./confirm-skill.mjs";
import { describeTailoring } from "./resume-guard.mjs";

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

test("rebuilding a prepared resume includes the confirmed skill and does not invent one", () => {
  const document = {
    summary: "Product manager.",
    skills: ["Excel", "Product management", "SQL", "Data analysis"],
    employment: [{ title: "Product Manager", employer: "Northstar", bullets: ["Owned the activation roadmap"] }],
  };
  const facts = [
    { statement: "Data analysis", category: "skill", verified_by_user: true },
    { statement: "Product management" },
    { statement: "SQL" },
    { statement: "Excel" },
    { statement: "Northstar" },
  ];
  const job = {
    title: "Growth Product Manager",
    company: "Kindred",
    requirements: JSON.stringify({ mandatory: ["Product management", "SQL", "Data analysis"], preferred: [] }),
  };
  const prepared = preparedResumeAfterConfirm({ document, job, facts, preferences: {} });
  assert.ok(prepared.skills.includes("Data analysis"));
  assert.ok(prepared.skills.indexOf("Data analysis") < prepared.skills.indexOf("Excel"));
  assert.equal(prepared.skills.includes("Kubernetes"), false);
  const described = describeTailoring(document, prepared);
  assert.match(described.summary, /No new employers, dates, or skills were added|already leads/);
  assert.equal(described.changes.some((change) => /Kubernetes/.test(`${change.detail} ${change.after}`)), false);
});

test("an insight gap can be confirmed only when insights already lists it", () => {
  const gaps = [{ skill: "Python", demand: 4 }, { skill: "Title: Recruiter", demand: 2 }];
  assert.equal(confirmInsightGap({ gaps, skill: "python" }), "Python");
  assert.throws(() => confirmInsightGap({ gaps, skill: "Kubernetes" }), /not a gap in your insights/);
  assert.throws(() => confirmInsightGap({ gaps, skill: "Title: Recruiter" }), /not a gap in your insights/);
});

test("every prepared resume includes the confirmed skill and leaves out an invented one", () => {
  const document = {
    summary: "Product manager.",
    skills: ["Excel", "Product management", "SQL", "Communication"],
    employment: [{ title: "Product Manager", employer: "Northstar", bullets: ["Owned the activation roadmap"] }],
  };
  const facts = [
    { statement: "Communication", category: "skill", verified_by_user: true },
    { statement: "Product management" },
    { statement: "SQL" },
    { statement: "Excel" },
    { statement: "Northstar" },
  ];
  const prepared = preparedResumesAfterConfirm({
    document,
    facts,
    preferences: {},
    jobs: [
      {
        id: "job_northstar",
        title: "Senior Product Manager",
        company: "Northstar",
        requirements: JSON.stringify({ mandatory: ["Product management", "SQL"], preferred: [] }),
      },
      {
        id: "job_kindred",
        title: "Growth Product Manager",
        company: "Kindred",
        requirements: JSON.stringify({ mandatory: ["Product management", "SQL"], preferred: [] }),
      },
    ],
  });
  assert.deepEqual(prepared.map((item) => item.jobId), ["job_northstar", "job_kindred"]);
  for (const item of prepared) {
    assert.ok(item.document.skills.includes("Communication"));
    assert.equal(item.document.skills.includes("Kubernetes"), false);
  }
});
