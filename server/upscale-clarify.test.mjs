import assert from "node:assert/strict";
import test from "node:test";
import {
  applyClarificationAnswer,
  buildClarificationRecommendations,
  markRecommendationAnswered,
} from "./upscale-clarify.mjs";
import { claimsSupported } from "./resume-guard.mjs";

test("buildClarificationRecommendations asks for metrics on weak bullets", () => {
  const { recommendations, weakCount } = buildClarificationRecommendations({
    summary: "Short",
    skills: [],
    employment: [{ title: "PM", employer: "Acme", bullets: ["Responsible for onboarding"] }],
  });
  assert.ok(weakCount >= 1);
  assert.ok(recommendations.some((item) => item.kind === "clarify" && item.clarifyType === "metric"));
  assert.ok(recommendations.some((item) => item.id === "clarify-skill"));
});

test("applyClarificationAnswer stores verified Fact Ledger metric and unlocks number claims", () => {
  const recommendation = {
    id: "clarify-bullet-0-0",
    kind: "clarify",
    clarifyType: "metric",
    path: "employment.0.bullets.0",
    relatedText: "Responsible for onboarding",
  };
  const result = applyClarificationAnswer({
    profile: {
      skills: ["SQL"],
      employment: [{ title: "PM", employer: "Acme", bullets: ["Responsible for onboarding"] }],
      summary: "",
    },
    facts: [{ fact_id: "SKILL-001", category: "skill", statement: "SQL", confidence: 1, verified_by_user: true }],
    recommendation,
    answer: "raised completion 18%",
  });
  assert.equal(result.fact.category, "achievement");
  assert.equal(result.fact.verified_by_user, true);
  assert.equal(result.fact.source, "user_clarification");
  assert.match(result.fact.statement, /18%/);
  assert.match(result.profile.employment[0].bullets[0], /18%/);
  assert.ok(claimsSupported("Owned onboarding and raised completion 18%", "Responsible for onboarding", result.facts));
});

test("markRecommendationAnswered flags the clarification", () => {
  const next = markRecommendationAnswered(
    [{ id: "clarify-metrics", kind: "clarify" }, { id: "other", kind: "note" }],
    "clarify-metrics",
    "team of 6",
  );
  assert.equal(next[0].answered, true);
  assert.equal(next[0].answer, "team of 6");
  assert.equal(next[1].answered, undefined);
});
