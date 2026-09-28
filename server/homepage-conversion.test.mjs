import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

test("homepage conversion content covers Spec §53 sections", () => {
  const path = join(dirname(fileURLToPath(import.meta.url)), "..", "shared", "homepage.json");
  const homepage = JSON.parse(readFileSync(path, "utf8"));
  assert.equal(homepage.brand, "JobPilot");
  assert.ok(homepage.hero.titleLines.length >= 2);
  assert.match(homepage.hero.titleLines.join(" "), /Better applications/i);
  assert.equal(homepage.hero.uploadLabel, "Upload Resume");
  assert.equal(homepage.hero.continueLabel, "Select a resume to continue");
  assert.ok(homepage.hero.image);
  assert.ok(homepage.trust.items.length >= 4);
  assert.equal(homepage.how.steps.length, 4);
  assert.ok(homepage.fit.demo.score >= 80);
  assert.ok(homepage.fit.demo.why.length);
  assert.ok(homepage.efficiency.stages.length >= 4);
  assert.ok(homepage.better.before);
  assert.ok(homepage.better.after);
  assert.ok(homepage.results.metrics.length >= 4);
  assert.equal(homepage.pricing.plans.length, 4);
  assert.match(homepage.cta.title, /resume/i);
  assert.ok(!JSON.stringify(homepage).match(/OpenAI|Anthropic|GPT-|Claude/i));
});
