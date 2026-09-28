import assert from "node:assert/strict";
import test from "node:test";
import { reconcileProducerReviewer, textAppearsInSource } from "./ai-reconcile.mjs";

test("textAppearsInSource matches resume-supported claims", () => {
  assert.equal(textAppearsInSource("Alex Rivera\nSQL and React", "SQL"), true);
  assert.equal(textAppearsInSource("Alex Rivera\nSQL and React", "Kubernetes"), false);
});

test("reconcile keeps resume-supported skills and drops invented ones", () => {
  const source = "Alex Rivera\nSkills: SQL, React\nAcme Corp — Product Manager";
  const result = reconcileProducerReviewer({
    source,
    profile: {
      name: "Alex Rivera",
      email: "alex@example.com",
      phone: "",
      city: "",
      address: "",
      summary: "",
      skills: ["SQL", "Kubernetes"],
      employment: [{ title: "Product Manager", employer: "Acme Corp", bullets: [] }],
      education: [],
      facts: [
        { fact_id: "SKILL-001", category: "skill", statement: "SQL", confidence: 0.9 },
        { fact_id: "SKILL-002", category: "skill", statement: "Kubernetes", confidence: 0.9 },
      ],
      questions: [],
      warnings: [],
      review: { status: "pass", unsupported: [] },
    },
    reviewer: {
      status: "fail",
      unsupported: ["Kubernetes", "employer:FakeCo"],
      notes: ["Confirm any cloud certifications."],
    },
  });

  assert.ok(result.profile.skills.includes("SQL"));
  assert.ok(!result.profile.skills.includes("Kubernetes"));
  assert.ok(result.dropped.some((item) => item.includes("Kubernetes")));
  assert.ok(result.kept.some((item) => item === "skill:SQL") || result.profile.skills.includes("SQL"));
  assert.ok(result.profile.questions.some((item) => /certifications/i.test(item)));
  assert.equal(result.profile.review.reconciliation.status, result.status);
});

test("reconcile drops contact fields missing from source", () => {
  const result = reconcileProducerReviewer({
    source: "Alex Rivera\nalex@example.com",
    profile: {
      name: "Alex Rivera",
      email: "alex@example.com",
      phone: "555-0100",
      skills: [],
      employment: [],
      education: [],
      facts: [],
      questions: [],
      warnings: [],
      review: { status: "pass", unsupported: [] },
    },
    reviewer: { status: "fail", unsupported: ["phone"], notes: [] },
  });
  assert.equal(result.profile.phone, "");
  assert.ok(result.dropped.includes("phone"));
  assert.ok(result.decisions.some((item) => item.field === "phone" && item.action === "drop"));
});

test("reconcile agrees when reviewer passes", () => {
  const result = reconcileProducerReviewer({
    source: "Alex",
    profile: { name: "Alex", skills: [], employment: [], education: [], facts: [], questions: [], warnings: [] },
    reviewer: { status: "pass", unsupported: [], notes: [] },
  });
  assert.equal(result.status, "agree");
  assert.equal(result.decisions[0].action, "agree");
});
