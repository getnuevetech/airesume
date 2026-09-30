/** Resume insights, accepted rewrites, and fact-checked upscale documents. */

import { claimsSupported, normalizeResumePath } from "./resume-guard.mjs";

const WEAK = [
  [/^\s*responsible for\s+/i, "Owned "],
  [/^\s*was responsible for\s+/i, "Owned "],
  [/^\s*duties included\s+/i, "Delivered "],
  [/^\s*helped with\s+/i, "Supported "],
  [/^\s*helped\s+/i, "Supported "],
  [/^\s*assisted with\s+/i, "Supported "],
  [/^\s*worked on\s+/i, "Delivered "],
  [/^\s*tasked with\s+/i, "Led "],
];

function tidy(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function readPath(doc, path) {
  const parts = normalizeResumePath(path).split(".").filter(Boolean);
  let cursor = doc;
  for (const part of parts) {
    if (cursor == null) return undefined;
    const key = Number.isInteger(Number(part)) && String(Number(part)) === part ? Number(part) : part;
    cursor = cursor[key];
  }
  return cursor;
}

function writePath(doc, path, value) {
  const parts = normalizeResumePath(path).split(".").filter(Boolean);
  if (!parts.length) return false;
  let cursor = doc;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    const key = Number.isInteger(Number(part)) && String(Number(part)) === part ? Number(part) : part;
    cursor = cursor?.[key];
  }
  if (!cursor || typeof cursor !== "object") return false;
  const last = parts[parts.length - 1];
  const key = Number.isInteger(Number(last)) && String(Number(last)) === last ? Number(last) : last;
  if (cursor[key] === undefined) return false;
  cursor[key] = value;
  return true;
}

function sameIdentity(original, proposed) {
  const left = original?.employment || [];
  const right = proposed?.employment || [];
  if (left.length !== right.length) return false;
  return left.every((job, index) => {
    const next = right[index] || {};
    return tidy(job.title) === tidy(next.title)
      && tidy(job.employer) === tidy(next.employer)
      && tidy(job.dates) === tidy(next.dates)
      && (job.bullets || []).length === (next.bullets || []).length;
  });
}

/**
 * Concrete review: what is weak, what to change, and a rewrite that adds no new facts.
 */
export function buildResumeInsights(doc = {}) {
  const feedback = [];
  const recommendations = [];
  let rating = 84;
  const summary = tidy(doc.summary);
  const role = (doc.employment || [])[0];
  const roleTitle = tidy(role?.title);
  const employer = tidy(role?.employer);

  if (!summary) {
    rating -= 14;
    feedback.push("There is no summary, so the resume reads as a list of jobs with no point of view.");
  } else if (summary.length < 40) {
    rating -= 10;
    feedback.push(`The summary is ${summary.length} characters. It does not tell an employer what you do.`);
  } else if (roleTitle && employer && !summary.toLowerCase().includes(roleTitle.toLowerCase())) {
    const proposed = `${roleTitle} at ${employer}. ${summary}`;
    if (claimsSupported(proposed, JSON.stringify(doc))) {
      recommendations.push({
        id: "summary-lead",
        title: "Open the summary with the role already on the resume",
        detail: `The summary never names ${roleTitle}. Leading with that role uses only text already on the resume.`,
        kind: "rewrite",
        path: "summary",
        before: summary,
        proposed,
      });
      feedback.push(`The summary does not name your ${roleTitle} role at ${employer}.`);
      rating -= 6;
    }
  } else {
    feedback.push(roleTitle ? `The summary already names your ${roleTitle} role.` : "The summary is long enough to open the resume.");
  }

  let weakCount = 0;
  (doc.employment || []).forEach((job, jobIndex) => {
    (job.bullets || []).forEach((bullet, bulletIndex) => {
      const text = tidy(bullet);
      if (!text) return;
      const rule = WEAK.find(([pattern]) => pattern.test(text));
      if (!rule) return;
      const proposed = tidy(text.replace(rule[0], rule[1]));
      if (!proposed || proposed === text || !claimsSupported(proposed, text)) return;
      weakCount += 1;
      const where = [tidy(job.title), tidy(job.employer)].filter(Boolean).join(" at ") || "this role";
      recommendations.push({
        id: `bullet-${jobIndex}-${bulletIndex}`,
        title: `Use a direct verb in ${where}`,
        detail: "The line describes the same duty. The new opening states ownership instead of a weak verb. No employer, date, or number is added.",
        kind: "rewrite",
        path: `employment.${jobIndex}.bullets.${bulletIndex}`,
        before: text,
        proposed,
      });
    });
  });

  if (weakCount) {
    rating -= Math.min(18, weakCount * 6);
    feedback.push(`${weakCount} experience line${weakCount === 1 ? "" : "s"} open with a weak verb such as “responsible for” or “helped”.`);
  } else if ((doc.employment || []).some((job) => (job.bullets || []).length)) {
    feedback.push("Experience lines already use direct verbs.");
  } else {
    rating -= 10;
    feedback.push("No experience lines are on the resume, so there is nothing to strengthen.");
  }

  if (!/\d/.test(JSON.stringify(doc))) {
    rating -= 8;
    feedback.push("No measurable figure is on the resume. Add only a number you can confirm. The rewrite will not invent one.");
  }

  const rewrites = recommendations.filter((item) => item.kind === "rewrite");
  if (rewrites.length) {
    feedback.unshift(
      `${rewrites.length} change${rewrites.length === 1 ? "" : "s"} can be applied to a new resume. Each one rewrites text already on the resume.`,
    );
  } else {
    feedback.push("No wording change is safe to apply yet. Answer a clarification if you want a stronger line that uses a verified fact.");
  }

  return {
    rating: Math.max(35, Math.min(96, rating)),
    feedback,
    recommendations,
  };
}

export function applyAcceptedRewrites(doc, recommendations = [], facts = []) {
  const source = JSON.stringify(doc);
  const next = structuredClone(doc);
  const applied = [];
  const skippedClaims = [];
  const skippedPaths = [];
  const changes = [];
  for (const item of recommendations) {
    const proposed = tidy(item?.proposed);
    const path = normalizeResumePath(item?.path);
    if (!proposed || !path) {
      skippedPaths.push(String(item?.id || ""));
      continue;
    }
    if (!claimsSupported(proposed, source, facts)) {
      skippedClaims.push(String(item.id));
      continue;
    }
    const before = tidy(readPath(next, path));
    if (typeof readPath(next, path) !== "string" || !writePath(next, path, proposed)) {
      skippedPaths.push(String(item.id));
      continue;
    }
    applied.push(String(item.id));
    if (before !== proposed) changes.push({ path, before, after: proposed });
  }
  return { document: next, applied, skippedClaims, skippedPaths, changes };
}

function changesAgainst(original, next) {
  const changes = [];
  const originalSummary = tidy(original.summary);
  const nextSummary = tidy(next.summary);
  if (originalSummary !== nextSummary) changes.push({ path: "summary", before: originalSummary, after: nextSummary });
  const originalHeadline = tidy(original.headline);
  const nextHeadline = tidy(next.headline);
  if (originalHeadline !== nextHeadline) changes.push({ path: "headline", before: originalHeadline, after: nextHeadline });
  (original.employment || []).forEach((job, jobIndex) => {
    (job.bullets || []).forEach((bullet, bulletIndex) => {
      const before = tidy(bullet);
      const after = tidy(next.employment?.[jobIndex]?.bullets?.[bulletIndex]);
      if (before !== after) {
        changes.push({
          path: `employment.${jobIndex}.bullets.${bulletIndex}`,
          before,
          after,
        });
      }
    });
  });
  return changes;
}

/**
 * Keep an upscale model document only where it rephrases supported text.
 * Employers, titles, dates, and bullet counts stay on the original resume.
 */
export function mergeUpscaleDocument(original, deterministic, proposed, facts = []) {
  const source = JSON.stringify(original);
  const next = structuredClone(deterministic);
  if (!proposed || typeof proposed !== "object" || !sameIdentity(original, proposed)) {
    return { document: next, changes: changesAgainst(original, next), acceptedModel: false };
  }
  const proposedSummary = tidy(proposed.summary);
  if (proposedSummary && claimsSupported(proposedSummary, source, facts)) next.summary = proposedSummary;
  const proposedHeadline = tidy(proposed.headline);
  if (proposedHeadline && claimsSupported(proposedHeadline, source, facts)) next.headline = proposedHeadline;
  (original.employment || []).forEach((job, jobIndex) => {
    (job.bullets || []).forEach((_, bulletIndex) => {
      const text = tidy(proposed.employment?.[jobIndex]?.bullets?.[bulletIndex]);
      if (!text || !claimsSupported(text, source, facts)) return;
      next.employment[jobIndex].bullets[bulletIndex] = text;
    });
  });
  return { document: next, changes: changesAgainst(original, next), acceptedModel: true };
}
