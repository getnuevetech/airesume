/** Scan published Terms/Privacy copy for unfinished counsel placeholders. */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PLACEHOLDER_PATTERNS = [
  { id: "COMPANY_LEGAL_NAME", re: /\[COMPANY LEGAL NAME\]/g },
  { id: "COMPANY_MAILING_ADDRESS", re: /\[COMPANY MAILING ADDRESS\]/g },
  { id: "PRIVACY_EMAIL", re: /\[PRIVACY EMAIL\]/g },
  { id: "LEGAL_SUPPORT_EMAIL", re: /\[LEGAL\s*\/\s*SUPPORT EMAIL\]/g },
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
 */
export function scanLegalPlaceholders(rootDir, files = DEFAULT_FILES) {
  /** @type {{ file: string, label: string, ids: string[] }[]} */
  const hits = [];

  for (const file of files) {
    const absolute = join(rootDir, file.path);
    let text = "";
    try {
      text = readFileSync(absolute, "utf8");
    } catch {
      hits.push({ file: file.path, label: file.label, ids: ["UNREADABLE"] });
      continue;
    }
    const ids = [];
    for (const pattern of PLACEHOLDER_PATTERNS) {
      pattern.re.lastIndex = 0;
      if (pattern.re.test(text)) ids.push(pattern.id);
    }
    if (ids.length) hits.push({ file: file.path, label: file.label, ids });
  }

  const placeholderIds = [...new Set(hits.flatMap((hit) => hit.ids))];
  return {
    ok: hits.length === 0,
    hits,
    placeholderIds,
    detail: hits.length
      ? `Unfinished legal copy in ${hits.map((hit) => hit.label).join(" and ")}: ${placeholderIds.join(", ")}. Replace bracketed fields before publication.`
      : "Terms and Privacy have no unfinished company/counsel placeholders.",
  };
}

export function repoRootFromHere(metaUrl = import.meta.url) {
  return join(dirname(fileURLToPath(metaUrl)), "..");
}
