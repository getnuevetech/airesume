import assert from "node:assert/strict";
import test from "node:test";
import { migrate, SCHEMA_VERSION } from "./schema.mjs";
import { db } from "./db.mjs";
import {
  isPromptRegistryEnabled,
  isSilentAutoApplyEnabled,
  setPromptRegistryEnabled,
  setSilentAutoApplyEnabled,
  resolveSystemPrompt,
  savePromptDraft,
  publishPrompt,
  rollbackPrompt,
  listPromptRegistry,
  defaultPromptBody,
} from "./prompt-registry.mjs";
import { autoDecision } from "./apply-rules.mjs";

test("schema 24+ seeds prompt registry off and silent auto-apply off", () => {
  assert.ok(SCHEMA_VERSION >= 24);
  migrate();
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ai_prompt_versions'").get());
  assert.equal(isPromptRegistryEnabled(), false);
  assert.equal(isSilentAutoApplyEnabled(), false);
  const seeded = db.prepare("SELECT COUNT(*) AS count FROM ai_prompt_versions WHERE status = 'published'").get();
  assert.ok(Number(seeded.count) >= 8);
});

test("prompt registry publish and rollback change resolveSystemPrompt only when enabled", () => {
  migrate();
  setPromptRegistryEnabled(false);
  const codeDefault = defaultPromptBody("career_extraction");
  assert.ok(codeDefault.length > 40);
  assert.equal(resolveSystemPrompt("career_extraction", codeDefault), codeDefault);

  const draft = savePromptDraft(
    "career_extraction",
    `${codeDefault}\n\nADMIN EDIT: prefer shorter summaries.`,
    "unit test draft",
    "test",
  );
  assert.equal(draft.ok, true);
  const published = publishPrompt("career_extraction", "test");
  assert.equal(published.ok, true);

  // Still off — code fallback wins.
  assert.equal(resolveSystemPrompt("career_extraction", codeDefault), codeDefault);

  setPromptRegistryEnabled(true);
  const resolved = resolveSystemPrompt("career_extraction", codeDefault);
  assert.ok(resolved.includes("ADMIN EDIT"));
  assert.notEqual(resolved, codeDefault);

  const before = listPromptRegistry().functions.find((item) => item.key === "career_extraction");
  assert.ok(before?.published);
  const archived = before?.history.find((row) => row.status === "archived" || (row.status === "published" && row.version === 1));
  // Seeded v1 was archived when we published the draft; roll back to any non-published history entry with body.
  const target = before?.history.find((row) => row.status === "archived");
  assert.ok(target, "expected archived seed version");
  const rolled = rollbackPrompt("career_extraction", target.id, "test");
  assert.equal(rolled.ok, true);
  const after = resolveSystemPrompt("career_extraction", "fallback-should-not-win");
  assert.ok(after.includes("You extract a candidate career profile"));
  assert.ok(!after.includes("ADMIN EDIT"));

  setPromptRegistryEnabled(false);
  void archived;
});

test("silent auto-apply admin switch defaults off and can toggle", () => {
  migrate();
  setSilentAutoApplyEnabled(false);
  assert.equal(isSilentAutoApplyEnabled(), false);
  setSilentAutoApplyEnabled(true);
  assert.equal(isSilentAutoApplyEnabled(), true);
  setSilentAutoApplyEnabled(false);
  assert.equal(isSilentAutoApplyEnabled(), false);
});

test("autoDecision still never returns apply — silent transmit is a separate gate", () => {
  const job = {
    title: "Product Manager",
    company: "Northstar",
    verification: "Active",
    location: "Remote",
    remote_type: "remote",
    salary_min: 140000,
    salary_max: 180000,
  };
  const ready = autoDecision(job, { score: 92, label: "strong", missing: [] }, { locations: "Remote" }, { auto_min: 85 });
  assert.equal(ready.action, "ready");
  assert.notEqual(ready.action, "apply");
});
