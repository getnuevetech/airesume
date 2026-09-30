import assert from "node:assert/strict";
import test from "node:test";
import { applyAcceptedRewrites, buildResumeInsights, mergeUpscaleDocument } from "./resume-upscale.mjs";

const doc = {
  headline: "Product manager",
  summary: "Builds onboarding flows and tracks activation across the product.",
  skills: ["SQL"],
  employment: [
    {
      title: "Product manager",
      employer: "Northstar",
      dates: "2021-2024",
      bullets: ["Responsible for activation and growth experiments across the funnel."],
    },
  ],
  education: ["BS"],
};

test("resume insight names the weak line and a safe rewrite", () => {
  const insight = buildResumeInsights(doc);
  assert.match(insight.feedback.join(" "), /weak verb/);
  const rewrite = insight.recommendations.find((item) => item.id === "bullet-0-0");
  assert.equal(rewrite.kind, "rewrite");
  assert.match(rewrite.before, /Responsible for/);
  assert.match(rewrite.proposed, /^Owned /);
  assert.match(rewrite.detail, /No employer, date, or number is added/);
  const summary = insight.recommendations.find((item) => item.id === "summary-lead");
  assert.equal(summary.path, "summary");
  assert.match(summary.proposed, /Product manager at Northstar/);
});

test("accepted rewrites produce a separate document and a visible change", () => {
  const insight = buildResumeInsights(doc);
  const result = applyAcceptedRewrites(doc, insight.recommendations.filter((item) => item.kind === "rewrite"));
  assert.ok(result.applied.includes("bullet-0-0"));
  assert.match(result.document.employment[0].bullets[0], /^Owned /);
  assert.match(doc.employment[0].bullets[0], /Responsible for/);
  assert.ok(result.changes.some((change) => change.after.startsWith("Owned")));
});

test("upscale model output cannot invent an employer or a number", () => {
  const deterministic = applyAcceptedRewrites(doc, buildResumeInsights(doc).recommendations.filter((item) => item.kind === "rewrite"));
  const invented = {
    ...doc,
    summary: "Product manager at Northstar. Grew activation 40%.",
    employment: [
      {
        title: "Director",
        employer: "Invented Co",
        dates: "2021-2024",
        bullets: ["Owned activation and growth experiments across the funnel."],
      },
    ],
  };
  const rejected = mergeUpscaleDocument(doc, deterministic.document, invented, []);
  assert.equal(rejected.acceptedModel, false);
  assert.equal(rejected.document.employment[0].employer, "Northstar");
  assert.equal(rejected.document.employment[0].title, "Product manager");

  const safe = structuredClone(deterministic.document);
  safe.summary = "Product manager at Northstar. Builds onboarding flows and tracks activation across the product.";
  const accepted = mergeUpscaleDocument(doc, deterministic.document, safe, []);
  assert.equal(accepted.acceptedModel, true);
  assert.match(accepted.document.summary, /Product manager at Northstar/);
  assert.ok(accepted.changes.some((change) => change.path === "summary"));
});
