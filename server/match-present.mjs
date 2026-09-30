/** Candidate-facing match copy. Fact Ledger ids stay on the match record, not in this view. */

function cleanName(value) {
  return String(value || "")
    .replace(/\s*\[[^\]]+\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function names(values) {
  const seen = new Set();
  const out = [];
  for (const value of values || []) {
    const name = cleanName(value);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

function list(items, limit) {
  const shown = items.slice(0, limit);
  if (shown.length <= 1) return shown[0] || "";
  if (shown.length === 2) return `${shown[0]} and ${shown[1]}`;
  return `${shown.slice(0, -1).join(", ")}, and ${shown[shown.length - 1]}`;
}

export function presentMatch(match = {}) {
  const fromFacts = Array.isArray(match.matchedFacts) ? match.matchedFacts.map((item) => item?.skill) : [];
  const fits = names(fromFacts.length ? fromFacts : match.matched).slice(0, 6);
  const gaps = names(match.missing).slice(0, 6);
  const explanation = String(match.explanation || "");
  const notes = [];
  if (/Location fits your preferences/i.test(explanation)) notes.push("Location fits your preferences.");
  if (/Location is a stretch/i.test(explanation)) notes.push("Location is a stretch for your preferences.");
  const sentences = [];
  if (fits.length) sentences.push(`Fits ${list(fits, 4)}.`);
  if (gaps.length) sentences.push(`Missing ${list(gaps, 3)}.`);
  if (!sentences.length) sentences.push("Limited overlap with this listing.");
  return {
    summary: sentences.join(" "),
    fits,
    gaps,
    notes,
  };
}
