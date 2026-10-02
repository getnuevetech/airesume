/** Launch checks for AI provider assignments used by the candidate path. */

import { assignmentFor } from "./ai-run.mjs";
import { db } from "./db.mjs";

const LIVE_KINDS = new Set(["openai", "anthropic", "google"]);
const CORE_FUNCTIONS = ["career_extraction", "career_review", "resume_diagnostic", "job_match"];

/**
 * @param {object} [options]
 * @param {typeof db} [options.db]
 * @param {(key: string) => any} [options.assignmentFor]
 */
export function aiPipelineHealth(options = {}) {
  const database = options.db || db;
  const resolve = options.assignmentFor || assignmentFor;

  /** @type {string[]} */
  const missingKeys = [];
  /** @type {string[]} */
  const rulesOnly = [];

  for (const functionKey of CORE_FUNCTIONS) {
    const assignment = resolve(functionKey);
    if (!assignment || !assignment.assignment_enabled || !assignment.enabled) {
      rulesOnly.push(functionKey);
      continue;
    }
    if (assignment.kind === "deterministic") {
      rulesOnly.push(functionKey);
      continue;
    }
    if (LIVE_KINDS.has(assignment.kind) && !String(assignment.api_key || "").trim()) {
      missingKeys.push(`${functionKey} (${assignment.name || assignment.kind})`);
    }
  }

  // Also catch enabled live providers with blank keys even if not on the core list.
  try {
    const blankProviders = database
      .prepare(
        `SELECT name, kind FROM ai_providers
         WHERE enabled = 1 AND kind IN ('openai', 'anthropic', 'google')
           AND (api_key IS NULL OR TRIM(api_key) = '')`,
      )
      .all();
    for (const row of blankProviders) {
      const label = `${row.name || row.kind} provider`;
      if (!missingKeys.includes(label)) missingKeys.push(label);
    }
  } catch {
    // Fresh DBs without tables are treated as rules-only.
  }

  const keys = missingKeys.length
    ? {
        ok: false,
        detail: `Live AI providers are missing API keys: ${missingKeys.join(", ")}. Add keys under Admin → AI or switch those functions to Built-in rules.`,
      }
    : {
        ok: true,
        detail: "Enabled OpenAI / Anthropic / Google providers have API keys set.",
      };

  const modelQuality = rulesOnly.includes("career_extraction")
    ? {
        ok: false,
        detail:
          "Career extraction still uses Built-in rules only. Assign a live provider under Admin → AI before promising AI resume reading in beta.",
      }
    : {
        ok: true,
        detail: "Career extraction is assigned to a live AI provider.",
      };

  return { keys, modelQuality, rulesOnly, missingKeys };
}
