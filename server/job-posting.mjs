/** Turn a raw job description into a posting a person can scan. */

const INLINE_LABELS = [
  [/\b(Gehalt|Vergütung|Salary|Compensation)\s*:/gi, "\n\nPay: "],
  [/\b(Benefits|Wir bieten|What we offer|Perks)\s*:/gi, "\n\nBenefits: "],
  [/\b(Arbeitszeit|Arbeitszeitmodell|Employment type|Job type|Schedule)\s*:/gi, "\n\nSchedule: "],
  [/\b(Standort|Location|Office)\s*:/gi, "\n\nLocation: "],
  [/\b(Start(?:datum)?)\s*:/gi, "\n\nStart: "],
  [/\b(Aufgaben|Deine Aufgaben|Responsibilities|What you'll do|What you will do)\s*:/gi, "\n\nThe role: "],
  [/\b(Anforderungen|Qualifikationen|Requirements|Qualifications|What you bring|Was [Dd]u mitbringen solltest)\s*:/gi, "\n\nWhat you bring: "],
];

const FACT_HEADINGS = new Set(["Pay", "Schedule", "Location", "Start"]);

function markInlineLabels(text) {
  let next = String(text || "");
  for (const [pattern, replacement] of INLINE_LABELS) {
    next = next.replace(pattern, replacement);
  }
  return next;
}

function isNumberDot(text, index) {
  return text[index] === "." && /\d/.test(text[index - 1] || "") && /\d/.test(text[index + 1] || "");
}

export function splitSentences(text) {
  const cleaned = String(text || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const parts = [];
  let buf = "";
  for (let i = 0; i < cleaned.length; i += 1) {
    const ch = cleaned[i];
    buf += ch;
    const lastWord = buf.trim().replace(/[.!?]+$/, "").split(/\s+/).pop() || "";
    const shortAbbreviation = ch === "." && lastWord.length > 0 && lastWord.length < 4;
    if ((ch === "." || ch === "!" || ch === "?") && !isNumberDot(cleaned, i) && !shortAbbreviation) {
      const next = cleaned[i + 1];
      if (next === undefined || /\s/.test(next)) {
        const sentence = buf.trim();
        if (sentence) parts.push(sentence);
        buf = "";
        while (cleaned[i + 1] === " ") i += 1;
      }
    }
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

function wrapWords(text, size) {
  const chunks = [];
  let remaining = String(text || "").trim();
  while (remaining.length > size) {
    let cut = remaining.lastIndexOf(" ", size);
    if (cut < Math.floor(size / 2)) cut = size;
    chunks.push(remaining.slice(0, cut).trim());
    remaining = remaining.slice(cut).trim();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

function readablePieces(text) {
  const sentences = splitSentences(text);
  if (sentences.length > 1 || (sentences[0] || "").length <= 420) return sentences;
  return wrapWords(sentences[0], 320);
}

function paragraphsFromSentences(sentences) {
  const paragraphs = [];
  for (let i = 0; i < sentences.length; i += 2) {
    paragraphs.push(sentences.slice(i, i + 2).join(" "));
  }
  return paragraphs.filter(Boolean);
}

function peelListItem(part) {
  const text = String(part || "").trim();
  const match = text.match(/^([^.]{2,70}?)\s+(?=[A-ZÄÖÜ])/);
  if (match && text.length > match[1].length + 15) {
    return { item: match[1].replace(/[.,;]+$/, "").trim(), rest: text.slice(match[1].length).trim() };
  }
  return { item: text.replace(/[.,;]+$/, "").trim(), rest: "" };
}

function listItems(text) {
  const pieces = String(text || "")
    .split(/\s*(?:;|•)\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
  if (pieces.length < 3) return { items: [], rest: String(text || "") };
  const items = [];
  const rest = [];
  for (const piece of pieces) {
    const peeled = peelListItem(piece);
    if (peeled.item && peeled.item.length < 90 && !/[.!?]/.test(peeled.item)) {
      items.push(peeled.item);
      if (peeled.rest) rest.push(peeled.rest);
    } else {
      rest.push(piece);
    }
  }
  if (items.length < 3) return { items: [], rest: String(text || "") };
  return { items, rest: rest.join(" ") };
}

function headingOf(line) {
  const match = String(line || "").match(/^(Pay|Schedule|Location|Start|Benefits|The role|What you bring)\s*:\s*([\s\S]+)$/i);
  if (!match) return null;
  const canonical = {
    pay: "Pay",
    schedule: "Schedule",
    location: "Location",
    start: "Start",
    benefits: "Benefits",
    "the role": "The role",
    "what you bring": "What you bring",
  };
  return { heading: canonical[match[1].toLowerCase()] || match[1], body: match[2].trim() };
}

function money(cents) {
  if (cents == null || cents === "") return "";
  const amount = Number(cents);
  if (!Number.isFinite(amount)) return "";
  return amount >= 1000 ? `$${Math.round(amount).toLocaleString("en-US")}` : `$${amount}`;
}

function mergeFacts(primary, extracted) {
  const seen = new Set();
  const facts = [];
  for (const fact of [...primary, ...extracted]) {
    const value = String(fact.value || "").trim();
    if (!value) continue;
    const key = fact.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    facts.push({ label: fact.label, value: value.slice(0, 160) });
  }
  return facts;
}

/**
 * @param {string} description
 * @param {{ location?: string, remoteType?: string, salaryMin?: number|null, salaryMax?: number|null, employmentType?: string }} [extras]
 */
export function presentJobPosting(description, extras = {}) {
  const stripped = markInlineLabels(String(description || ""))
    .replace(/^(?:title|company)\s*:\s*.+$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  const blocks = stripped.split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);
  const intro = [];
  const facts = [];
  const sections = [];
  for (const block of blocks) {
    const labeled = headingOf(block.replace(/\s+/g, " ").trim());
    if (!labeled) {
      intro.push(block);
      continue;
    }
    if (FACT_HEADINGS.has(labeled.heading) && labeled.body.length <= 160) {
      facts.push({ label: labeled.heading, value: labeled.body });
      continue;
    }
    const listed = listItems(labeled.body);
    const prose = listed.items.length ? listed.rest : labeled.body;
    sections.push({
      heading: labeled.heading,
      paragraphs: paragraphsFromSentences(readablePieces(prose)),
      items: listed.items,
    });
  }
  const introSentences = readablePieces(intro.join(" "));
  const summarySentences = introSentences.slice(0, 2);
  let summary = summarySentences.join(" ");
  if (summary.length > 420) summary = `${summary.slice(0, 417).trim()}…`;
  const rest = introSentences.slice(summarySentences.length);
  if (rest.length) {
    sections.unshift({
      heading: sections.some((section) => section.heading === "The role") ? "About" : "The role",
      paragraphs: paragraphsFromSentences(rest),
      items: [],
    });
  }
  const knownLocation = String(extras.location || "").trim();
  const filteredFacts = facts.filter((fact) => {
    if (fact.label === "Location" && knownLocation) return false;
    return true;
  });
  const headerFacts = [];
  if (!filteredFacts.some((fact) => fact.label === "Pay") && (extras.salaryMin || extras.salaryMax)) {
    const range = [money(extras.salaryMin), money(extras.salaryMax)].filter(Boolean).join(" – ");
    if (range) headerFacts.push({ label: "Pay", value: range });
  }
  if (!filteredFacts.some((fact) => fact.label === "Schedule") && extras.employmentType) {
    headerFacts.push({ label: "Schedule", value: String(extras.employmentType) });
  }
  if (!knownLocation && extras.remoteType) {
    headerFacts.push({ label: "Work", value: String(extras.remoteType) });
  }
  return {
    summary,
    facts: mergeFacts(headerFacts, filteredFacts),
    sections: sections.filter((section) => section.paragraphs.length || section.items.length),
  };
}

export function importedAt(externalKey, userId) {
  const key = String(externalKey || "");
  const id = String(userId || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!id) return 0;
  const match = key.match(new RegExp(`^paste-${id}-(\\d+)$`));
  return match ? Number(match[1]) : 0;
}

/** User imports sort ahead of the catalog, newest first. Match score breaks the rest. */
export function compareJobRank(a, b, userId) {
  const aImport = importedAt(a.external_key || a.externalKey, userId);
  const bImport = importedAt(b.external_key || b.externalKey, userId);
  if (aImport !== bImport) return bImport - aImport;
  return (b.score || 0) - (a.score || 0);
}
