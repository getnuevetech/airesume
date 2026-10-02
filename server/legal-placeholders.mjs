/** Scan published Terms/Privacy copy for unfinished counsel placeholders. */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applyLegalEntityToText, getLegalEntity } from "./legal-entity.mjs";

const ENTITY_PATTERNS = [
  { id: "COMPANY_LEGAL_NAME", re: /\[COMPANY LEGAL NAME\]/g },
  { id: "COMPANY_MAILING_ADDRESS", re: /\[COMPANY MAILING ADDRESS\]/g },
  { id: "PRIVACY_EMAIL", re: /\[PRIVACY EMAIL\]/g },
  { id: "LEGAL_SUPPORT_EMAIL", re: /\[LEGAL\s*\/\s*SUPPORT EMAIL\]/g },
];

const COUNSEL_DRAFT_PATTERNS = [
  { id: "ARBITRATION_PLACEHOLDER", re: /placeholder for counsel-approved/gi },
  { id: "DRAFT_FOR_COUNSEL", re: /DRAFT FOR COUNSEL REVIEW/g },
];

const DEFAULT_FILES = [
  { path: "src/content/terms.ts", label: "Terms" },
  { path: "src/content/privacy.ts", label: "Privacy" },
];

/**
 * @param {string} rootDir
 * @param {{ path: string, label: string }[]} [files]
 * @param {ReturnType<typeof getLegalEntity> | null} [entity]
 */
export function scanLegalPlaceholders(rootDir, files = DEFAULT_FILES, entity = null) {
  const resolvedEntity = entity || getLegalEntity();
  /** @type {{ file: string, label: string, ids: string[] }[]} */
  const hits = [];
  /** @type {string[]} */
  const counselDraftIds = [];

  for (const file of files) {
    const absolute = join(rootDir, file.path);
    let text = "";
    try {
      text = readFileSync(absolute, "utf8");
    } catch {
      hits.push({ file: file.path, label: file.label, ids: ["UNREADABLE"] });
      continue;
    }
    const resolved = applyLegalEntityToText(text, resolvedEntity);
    const ids = [];
    for (const pattern of ENTITY_PATTERNS) {
      pattern.re.lastIndex = 0;
      if (pattern.re.test(resolved)) ids.push(pattern.id);
    }
    if (ids.length) hits.push({ file: file.path, label: file.label, ids });

    for (const pattern of COUNSEL_DRAFT_PATTERNS) {
      pattern.re.lastIndex = 0;
      if (pattern.re.test(text) && !counselDraftIds.includes(pattern.id)) {
        counselDraftIds.push(pattern.id);
      }
    }
  }

  const placeholderIds = [...new Set(hits.flatMap((hit) => hit.ids))];
  return {
    ok: hits.length === 0,
    hits,
    placeholderIds,
    counselDraftIds,
    detail: hits.length
      ? `Unfinished company fields in ${hits.map((hit) => hit.label).join(" and ")}: ${placeholderIds.join(", ")}. Save Legal entity under Admin → Launch, or edit the source copy.`
      : "Terms and Privacy company fields are filled (source or Admin → Launch legal entity).",
  };
}

export function repoRootFromHere(metaUrl = import.meta.url) {
  return join(dirname(fileURLToPath(metaUrl)), "..");
}
