/** Field detection + kit mapping for extension autofill (testable core). */

const SENSITIVE_RE =
  /password|captcha|recaptcha|ssn|social.?security|disability|veteran|race|ethnicity|gender|sex|criminal|conviction|authorization|sponsorship|citizen|visa|salary|compensation|eeo|demographic/i;

const CONTACT_PATTERNS = [
  { key: "name", re: /full[_\s-]?name|applicant[_\s-]?name|legal[_\s-]?name|(^|[\s_])name($|[\s_])/i },
  { key: "email", re: /e-?mail/i },
  { key: "phone", re: /phone|mobile|tel/i },
  { key: "city", re: /city|locality|town/i },
  { key: "address", re: /address|street|addr1|line[_\s-]?1/i },
];

export function fieldFingerprint(field = {}) {
  return [field.name, field.id, field.autocomplete, field.placeholder, field.ariaLabel, field.label, field.type]
    .map((part) => String(part || "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
}

export function isSensitiveField(field = {}) {
  const blob = fieldFingerprint(field);
  if (String(field.type || "").toLowerCase() === "password") return true;
  return SENSITIVE_RE.test(blob);
}

export function classifyContactField(field = {}) {
  if (isSensitiveField(field)) return null;
  const blob = fieldFingerprint(field);
  for (const item of CONTACT_PATTERNS) {
    if (item.re.test(blob)) return item.key;
  }
  if (String(field.type || "").toLowerCase() === "email") return "email";
  if (String(field.type || "").toLowerCase() === "tel") return "phone";
  return null;
}

export function classifyResumeField(field = {}) {
  if (isSensitiveField(field)) return null;
  const blob = fieldFingerprint(field);
  if (/resume|cv|cover.?letter|additional.?info|comments/i.test(blob) && (field.tag === "textarea" || /textarea/i.test(field.type || ""))) {
    return "resume";
  }
  return null;
}

/**
 * Build fill proposals from detected fields + apply kit.
 * Sensitive fields never get a value. Explicit user action is required to apply.
 */
export function proposeFills(fields = [], kit = {}) {
  const contact = new Map((kit.contact || []).map((item) => [item.key, item]));
  const proposals = [];
  for (const field of fields) {
    if (isSensitiveField(field)) {
      proposals.push({
        fieldId: field.uid,
        key: "sensitive",
        value: "",
        skipped: true,
        reason: "Sensitive fields stay blank unless you type them.",
      });
      continue;
    }
    const contactKey = classifyContactField(field);
    if (contactKey) {
      const item = contact.get(contactKey);
      const value = String(item?.value || "").trim();
      proposals.push({
        fieldId: field.uid,
        key: contactKey,
        value,
        skipped: !value,
        reason: value ? "" : item?.note || "No value in apply kit.",
      });
      continue;
    }
    const resumeKey = classifyResumeField(field);
    if (resumeKey) {
      const value = String(kit.resumeText || "").trim();
      proposals.push({
        fieldId: field.uid,
        key: "resume",
        value,
        skipped: !value,
        reason: value ? "" : "No tailored resume text in kit.",
      });
      continue;
    }
    const answer = matchAnswer(field, kit.answers || []);
    if (answer) {
      proposals.push({
        fieldId: field.uid,
        key: "answer",
        value: answer.ready ? answer.answer : "",
        skipped: !answer.ready,
        reason: answer.ready ? "" : answer.blankReason || "Answer not ready — fill manually.",
      });
    }
  }
  return proposals;
}

function matchAnswer(field, answers) {
  const blob = fieldFingerprint(field);
  if (!blob) return null;
  let best = null;
  let bestScore = 0;
  for (const answer of answers) {
    const prompt = String(answer.prompt || "").toLowerCase();
    if (!prompt) continue;
    const tokens = prompt.split(/[^a-z0-9]+/).filter((token) => token.length > 3);
    let hits = 0;
    for (const token of tokens) if (blob.includes(token)) hits += 1;
    const score = tokens.length ? hits / tokens.length : 0;
    if (score > bestScore && score >= 0.4) {
      best = answer;
      bestScore = score;
    }
  }
  return best;
}
