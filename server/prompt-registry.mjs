/** Versioned admin prompt registry with publish/rollback and a global on/off switch. */

import { db, id } from "./db.mjs";
import { DEFAULT_PROMPTS } from "./ai.mjs";

export const PROMPT_REGISTRY_SETTING = "prompt_registry_enabled";
export const SILENT_AUTO_APPLY_SETTING = "silent_auto_apply_enabled";

const FUNCTION_META = [
  { key: "career_extraction", label: "Career extraction", detail: "Reads a resume into a structured profile." },
  { key: "career_review", label: "Career fact review", detail: "Second-pass review of extracted career facts against the resume text." },
  { key: "resume_diagnostic", label: "Resume review", detail: "Rates the resume and writes recommendations." },
  { key: "resume_upscale", label: "Resume upscale", detail: "Rewrites accepted recommendations into a new version." },
  { key: "resume_verify", label: "Fact check", detail: "Rejects resume claims that are not in the profile." },
  { key: "job_categorize", label: "Job categorization", detail: "Assigns a category and role to each job." },
  { key: "job_requirements", label: "Job requirements", detail: "Extracts mandatory and preferred requirements before matching." },
  { key: "job_verify", label: "Job verification", detail: "Checks whether a listing looks active, duplicate, or unclear." },
  { key: "job_primary", label: "Primary recruiter", detail: "Finds the hiring company in a feed listing when the poster is an aggregator." },
  { key: "job_match", label: "Job match", detail: "Explains how a job fits the career profile." },
  { key: "image_enhance", label: "Photo enhancement", detail: "Chooses safe contrast, color, and sharpness for a headshot." },
];

function settingValue(key, fallback = "0") {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row?.value == null ? fallback : String(row.value);
}

function setSetting(key, value) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, String(value));
}

export function isPromptRegistryEnabled() {
  return settingValue(PROMPT_REGISTRY_SETTING, "0") === "1";
}

export function setPromptRegistryEnabled(enabled) {
  setSetting(PROMPT_REGISTRY_SETTING, enabled ? "1" : "0");
  return isPromptRegistryEnabled();
}

export function isSilentAutoApplyEnabled() {
  return settingValue(SILENT_AUTO_APPLY_SETTING, "0") === "1";
}

export function setSilentAutoApplyEnabled(enabled) {
  setSetting(SILENT_AUTO_APPLY_SETTING, enabled ? "1" : "0");
  return isSilentAutoApplyEnabled();
}

export function defaultPromptBody(functionKey) {
  return DEFAULT_PROMPTS[functionKey] || "";
}

export function knownFunctionKey(functionKey) {
  return Boolean(DEFAULT_PROMPTS[functionKey]) || FUNCTION_META.some((item) => item.key === functionKey);
}

/**
 * Resolve the system prompt for an AI call.
 * When the registry is on and a published version exists, use it; otherwise use code fallback.
 */
export function resolveSystemPrompt(functionKey, codeFallback = "") {
  const fallback = String(codeFallback || defaultPromptBody(functionKey) || "");
  if (!isPromptRegistryEnabled()) return fallback;
  const published = db
    .prepare(
      `SELECT body FROM ai_prompt_versions
       WHERE function_key = ? AND status = 'published'
       ORDER BY version DESC LIMIT 1`,
    )
    .get(functionKey);
  const body = String(published?.body || "").trim();
  return body || fallback;
}

export function seedPromptRegistry() {
  const insert = db.prepare(
    `INSERT INTO ai_prompt_versions
      (id, function_key, version, body, note, status, created_at, published_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const now = Date.now();
  for (const item of FUNCTION_META) {
    const existing = db
      .prepare("SELECT id FROM ai_prompt_versions WHERE function_key = ? LIMIT 1")
      .get(item.key);
    if (existing) continue;
    const body = defaultPromptBody(item.key);
    if (!body) continue;
    insert.run(id("prm"), item.key, 1, body, "Seeded from built-in defaults", "published", now, now, "system");
  }
  if (!db.prepare("SELECT value FROM settings WHERE key = ?").get(PROMPT_REGISTRY_SETTING)) {
    setSetting(PROMPT_REGISTRY_SETTING, "0");
  }
  if (!db.prepare("SELECT value FROM settings WHERE key = ?").get(SILENT_AUTO_APPLY_SETTING)) {
    setSetting(SILENT_AUTO_APPLY_SETTING, "0");
  }
}

function nextVersion(functionKey) {
  const row = db
    .prepare("SELECT COALESCE(MAX(version), 0) AS max_version FROM ai_prompt_versions WHERE function_key = ?")
    .get(functionKey);
  return Number(row?.max_version || 0) + 1;
}

export function listPromptRegistry() {
  const versions = db
    .prepare(
      `SELECT id, function_key, version, body, note, status, created_at, published_at, created_by
       FROM ai_prompt_versions
       ORDER BY function_key ASC, version DESC`,
    )
    .all();
  const byFunction = FUNCTION_META.map((item) => {
    const rows = versions.filter((row) => row.function_key === item.key);
    const published = rows.find((row) => row.status === "published") || null;
    const draft = rows.find((row) => row.status === "draft") || null;
    return {
      key: item.key,
      label: item.label,
      detail: item.detail,
      defaultBody: defaultPromptBody(item.key),
      published: published
        ? {
            id: published.id,
            version: published.version,
            body: published.body,
            note: published.note,
            publishedAt: published.published_at,
            createdBy: published.created_by,
          }
        : null,
      draft: draft
        ? {
            id: draft.id,
            version: draft.version,
            body: draft.body,
            note: draft.note,
            createdAt: draft.created_at,
            createdBy: draft.created_by,
          }
        : null,
      history: rows.slice(0, 12).map((row) => ({
        id: row.id,
        version: row.version,
        status: row.status,
        note: row.note,
        createdAt: row.created_at,
        publishedAt: row.published_at,
        createdBy: row.created_by,
        bodyPreview: String(row.body || "").slice(0, 120),
      })),
    };
  });
  return {
    registryEnabled: isPromptRegistryEnabled(),
    silentAutoApplyEnabled: isSilentAutoApplyEnabled(),
    functions: byFunction,
  };
}

export function savePromptDraft(functionKey, body, note = "", createdBy = "admin") {
  if (!knownFunctionKey(functionKey)) {
    return { ok: false, error: "Unknown AI function." };
  }
  const text = String(body || "").trim();
  if (text.length < 20) {
    return { ok: false, error: "Prompt body must be at least 20 characters." };
  }
  const existingDraft = db
    .prepare("SELECT id FROM ai_prompt_versions WHERE function_key = ? AND status = 'draft'")
    .get(functionKey);
  const now = Date.now();
  if (existingDraft) {
    db.prepare("UPDATE ai_prompt_versions SET body = ?, note = ?, created_at = ?, created_by = ? WHERE id = ?").run(
      text,
      String(note || "").slice(0, 240),
      now,
      String(createdBy || "admin").slice(0, 80),
      existingDraft.id,
    );
    return { ok: true, id: existingDraft.id };
  }
  const version = nextVersion(functionKey);
  const promptId = id("prm");
  db.prepare(
    `INSERT INTO ai_prompt_versions
      (id, function_key, version, body, note, status, created_at, published_at, created_by)
     VALUES (?, ?, ?, ?, ?, 'draft', ?, NULL, ?)`,
  ).run(promptId, functionKey, version, text, String(note || "").slice(0, 240), now, String(createdBy || "admin").slice(0, 80));
  return { ok: true, id: promptId, version };
}

export function publishPrompt(functionKey, createdBy = "admin") {
  if (!knownFunctionKey(functionKey)) {
    return { ok: false, error: "Unknown AI function." };
  }
  const draft = db
    .prepare("SELECT * FROM ai_prompt_versions WHERE function_key = ? AND status = 'draft'")
    .get(functionKey);
  if (!draft) {
    return { ok: false, error: "Save a draft before publishing." };
  }
  const now = Date.now();
  db.prepare(
    "UPDATE ai_prompt_versions SET status = 'archived' WHERE function_key = ? AND status = 'published'",
  ).run(functionKey);
  db.prepare(
    "UPDATE ai_prompt_versions SET status = 'published', published_at = ?, created_by = ? WHERE id = ?",
  ).run(now, String(createdBy || "admin").slice(0, 80), draft.id);
  return { ok: true, id: draft.id, version: draft.version };
}

/**
 * Roll back to a prior archived (or any non-draft) version: republish that body as a new version.
 */
export function rollbackPrompt(functionKey, versionId, createdBy = "admin") {
  if (!knownFunctionKey(functionKey)) {
    return { ok: false, error: "Unknown AI function." };
  }
  const target = db
    .prepare("SELECT * FROM ai_prompt_versions WHERE id = ? AND function_key = ?")
    .get(versionId, functionKey);
  if (!target) {
    return { ok: false, error: "Prompt version not found." };
  }
  if (target.status === "published") {
    return { ok: true, id: target.id, version: target.version, already: true };
  }
  const now = Date.now();
  const version = nextVersion(functionKey);
  const promptId = id("prm");
  db.prepare(
    "UPDATE ai_prompt_versions SET status = 'archived' WHERE function_key = ? AND status = 'published'",
  ).run(functionKey);
  db.prepare(
    `INSERT INTO ai_prompt_versions
      (id, function_key, version, body, note, status, created_at, published_at, created_by)
     VALUES (?, ?, ?, ?, ?, 'published', ?, ?, ?)`,
  ).run(
    promptId,
    functionKey,
    version,
    target.body,
    `Rollback to v${target.version}${target.note ? `: ${target.note}` : ""}`.slice(0, 240),
    now,
    now,
    String(createdBy || "admin").slice(0, 80),
  );
  return { ok: true, id: promptId, version };
}

export function automationSwitches() {
  return {
    promptRegistryEnabled: isPromptRegistryEnabled(),
    silentAutoApplyEnabled: isSilentAutoApplyEnabled(),
  };
}
