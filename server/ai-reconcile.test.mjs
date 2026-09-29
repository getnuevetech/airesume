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

test("reconcile humanizes employment path labels instead of dumping raw paths", () => {
  const result = reconcileProducerReviewer({
    source: "Alex Rivera\nAcme Corp — Product Manager 2020-2022\nBeta Inc — Engineer 2018-2020",
    profile: {
      name: "Alex Rivera",
      email: "alex@example.com",
      skills: ["SQL"],
      employment: [
        { title: "Product Manager", employer: "Acme Corp", dates: "2020-2022", bullets: [] },
        { title: "Engineer", employer: "Beta Inc", dates: "2018-2020", bullets: [] },
      ],
      education: [],
      facts: [],
      questions: ["What full name should appear on your account?"],
      warnings: [],
      review: { status: "pass", unsupported: [] },
    },
    reviewer: {
      status: "fail",
      unsupported: [
        "employment[0].dates",
        "employment[1].dates",
        "employment[2].dates",
        "employment[3].dates",
        "employment[4].dates",
        "employment[5].dates",
      ],
      notes: [],
    },
  });

  const joined = result.profile.questions.join(" | ");
  assert.equal(/employment\[\d+\]\.dates/i.test(joined), false);
  assert.ok(result.profile.questions.some((item) => /employment dates/i.test(item)));
  assert.ok(result.profile.questions.includes("What full name should appear on your account?"));
});

test("humanizeClaimLabel maps employment paths to readable copy", async () => {
  const { humanizeClaimLabel } = await import("./ai-reconcile.mjs");
  assert.equal(
    humanizeClaimLabel("employment[0].dates", [{ title: "Manager", employer: "Acme" }]),
    "Confirm the dates for Manager at Acme.",
  );
  assert.equal(/employment\[0\]/.test(humanizeClaimLabel("employment[0].dates", [])), false);
});
