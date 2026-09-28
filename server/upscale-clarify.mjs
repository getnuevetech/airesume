/** Upscale clarification → Fact Ledger closed loop helpers. */

import { padFactId, normalizeFact } from "./fact-ledger.mjs";

const WEAK_OPENERS = [
  [/\bResponsible for\b/i, "Owned"],
  [/\bHelped with\b/i, "Supported"],
  [/\bWorked on\b/i, "Delivered"],
];

function nextAchievementId(facts = []) {
  const count = (facts || []).filter((fact) => String(fact.fact_id || "").startsWith("ACH-")).length;
  return padFactId("ACH", count);
}

function nextSkillId(facts = []) {
  const count = (facts || []).filter((fact) => String(fact.fact_id || "").startsWith("SKILL-")).length;
  return padFactId("SKILL", count);
}

/**
 * Diagnostic clarifications: questions the user can answer to grow the Fact Ledger
 * before Upscale invents nothing.
 */
export function buildClarificationRecommendations(doc = {}) {
  const recommendations = [];
  const blob = JSON.stringify(doc);
  let weakCount = 0;

  (doc.employment || []).forEach((job, jobIndex) => {
    (job.bullets || []).forEach((bullet, bulletIndex) => {
      const text = String(bullet || "").trim();
      if (!text) return;
      const weak = WEAK_OPENERS.some(([pattern]) => pattern.test(text));
      const hasNumber = /\d/.test(text);
      if (weak && !hasNumber) {
        weakCount += 1;
        recommendations.push({
          id: `clarify-bullet-${jobIndex}-${bulletIndex}`,
          title: `Clarify impact for “${text.slice(0, 48)}${text.length > 48 ? "…" : ""}”`,
          detail: "Add a real metric you can stand behind (team size, %, revenue, volume). JobPilot will store it in the Fact Ledger — it will not invent one.",
          kind: "clarify",
          clarifyType: "metric",
          path: `employment.${jobIndex}.bullets.${bulletIndex}`,
          relatedText: text,
        });
      }
    });
  });

  if (!/\d/.test(blob)) {
    recommendations.push({
      id: "clarify-metrics",
      title: "Add a verified number to your Fact Ledger",
      detail: "Scope, team size, or a result you can confirm. Saved answers unlock Upscale rewrites that use those figures.",
      kind: "clarify",
      clarifyType: "metric",
    });
  }

  if (!(doc.skills || []).length) {
    recommendations.push({
      id: "clarify-skill",
      title: "Confirm a core skill",
      detail: "Name one skill from real experience. It is added to your profile and Fact Ledger as verified.",
      kind: "clarify",
      clarifyType: "skill",
    });
  }

  const summary = String(doc.summary || "").trim();
  if (summary.length && summary.length < 40) {
    recommendations.push({
      id: "clarify-summary",
      title: "Confirm one summary fact",
      detail: "Add a short factual line from a role you already list. We store it as a ledger statement — not marketing fluff.",
      kind: "clarify",
      clarifyType: "achievement",
    });
  }

  return { recommendations, weakCount };
}

/**
 * Apply a user clarification answer into profile + Fact Ledger.
 * Never invents content beyond what the user typed.
 */
export function applyClarificationAnswer({
  profile = {},
  facts = [],
  recommendation = {},
  answer = "",
} = {}) {
  const text = String(answer || "").replace(/\s+/g, " ").trim();
  if (text.length < 2) {
    throw new Error("Enter a short factual answer before saving to the Fact Ledger.");
  }
  if (text.length > 400) {
    throw new Error("Keep the clarification under 400 characters.");
  }

  const clarifyType = String(recommendation.clarifyType || recommendation.kind || "achievement");
  const nextFacts = Array.isArray(facts) ? facts.map((fact) => ({ ...fact })) : [];
  const employment = Array.isArray(profile.employment) ? profile.employment.map((job) => ({ ...job, bullets: [...(job.bullets || [])] })) : [];
  const skills = Array.isArray(profile.skills) ? profile.skills.slice() : [];
  let summary = String(profile.summary || "");
  let documentPatch = null;
  let fact = null;

  if (clarifyType === "skill") {
    const skill = text.split(/[,;]/)[0].trim();
    if (!skill) throw new Error("Enter a skill name.");
    if (!skills.some((item) => String(item).toLowerCase() === skill.toLowerCase())) {
      skills.push(skill);
    }
    const factId = nextSkillId(nextFacts);
    fact = normalizeFact(
      {
        fact_id: factId,
        category: "skill",
        statement: skill,
        confidence: 1,
        source: "user_clarification",
        verified_by_user: true,
        source_fact_ids: [factId],
      },
      { confidence: 1 },
    );
  } else if (clarifyType === "metric") {
    const path = String(recommendation.path || "");
    const match = path.match(/^employment\.(\d+)\.bullets\.(\d+)$/);
    let statement = text;
    if (match) {
      const jobIndex = Number(match[1]);
      const bulletIndex = Number(match[2]);
      const related = String(recommendation.relatedText || employment[jobIndex]?.bullets?.[bulletIndex] || "").trim();
      const base = related || employment[jobIndex]?.bullets?.[bulletIndex] || "";
      const combined = /\d/.test(base) ? `${base} (${text})` : `${base}${base ? " — " : ""}${text}`;
      if (employment[jobIndex]?.bullets) {
        employment[jobIndex].bullets[bulletIndex] = combined.slice(0, 400);
        documentPatch = { path, value: employment[jobIndex].bullets[bulletIndex] };
      }
      statement = combined.slice(0, 400);
    }
    const factId = nextAchievementId(nextFacts);
    fact = normalizeFact(
      {
        fact_id: factId,
        category: "achievement",
        statement,
        confidence: 1,
        source: "user_clarification",
        verified_by_user: true,
        source_fact_ids: [factId],
      },
      { confidence: 1 },
    );
  } else {
    const factId = nextAchievementId(nextFacts);
    fact = normalizeFact(
      {
        fact_id: factId,
        category: "achievement",
        statement: text,
        confidence: 1,
        source: "user_clarification",
        verified_by_user: true,
        source_fact_ids: [factId],
      },
      { confidence: 1 },
    );
    if (clarifyType === "summary" && summary.length < 40) {
      summary = `${summary}${summary ? " " : ""}${text}`.trim().slice(0, 800);
    }
  }

  if (!fact) throw new Error("Could not store that clarification.");
  const duplicate = nextFacts.some(
    (item) => String(item.statement || "").toLowerCase() === String(fact.statement).toLowerCase(),
  );
  if (!duplicate) nextFacts.push(fact);

  return {
    facts: nextFacts,
    profile: {
      ...profile,
      skills,
      employment,
      summary,
    },
    fact,
    documentPatch,
  };
}

export function markRecommendationAnswered(recommendations = [], recommendationId, answer) {
  return (recommendations || []).map((item) => {
    if (String(item.id) !== String(recommendationId)) return item;
    return {
      ...item,
      answered: true,
      answer: String(answer || "").trim(),
      answeredAt: Date.now(),
    };
  });
}
