/** Hybrid job match scoring and requirement extraction (deterministic). */

import { citeSkillFact, skillsForMatching } from "./fact-ledger.mjs";
import { parseTargetSalary } from "./preference-options.mjs";

const WEIGHTS = {
  coreExperience: 25,
  requiredSkills: 25,
  roleSimilarity: 15,
  industry: 10,
  education: 10,
  location: 5,
  salary: 5,
  preferredSkills: 5,
};

const EDUCATION_WORDS = [
  "phd",
  "doctorate",
  "master",
  "mba",
  "bachelor",
  "bs",
  "ba",
  "bsc",
  "degree",
];

function lower(value) {
  return String(value || "").toLowerCase();
}

function unique(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = lower(item).trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(String(item).trim());
  }
  return out;
}

function skillHit(owned, skill) {
  const needle = lower(skill);
  return owned.some((item) => item.includes(needle) || needle.includes(item));
}

function yearsFromText(text) {
  const match = String(text || "").match(/(\d+)\+?\s*\+?\s*years?/i);
  if (!match) return null;
  const years = Number(match[1]);
  return Number.isFinite(years) ? years : null;
}

function educationFromText(text) {
  const blob = lower(text);
  for (const word of EDUCATION_WORDS) {
    if (blob.includes(word)) {
      if (word === "phd" || word === "doctorate") return "Doctorate";
      if (word === "master" || word === "mba") return "Master's";
      if (word === "bachelor" || word === "bs" || word === "ba" || word === "bsc") return "Bachelor's";
      return "Degree";
    }
  }
  return "";
}

/**
 * Build a requirements object from listing fields.
 * @param {{ title?: string, description?: string, skills?: string[], role?: string, category?: string }} raw
 */
export function extractRequirements(raw = {}) {
  const provided = Array.isArray(raw.skills) ? raw.skills.map(String) : [];
  const fromText = provided.length ? [] : skillsFromDescription(raw.description || "");
  const skills = unique([...provided, ...fromText]);
  const blob = `${raw.title || ""}\n${raw.description || ""}\n${raw.role || ""}`;
  const mandatoryFromSection = sectionSkills(raw.description || "", /must have|required|requirements|qualifications/i);
  const preferredFromSection = sectionSkills(raw.description || "", /nice to have|preferred|bonus/i);
  const mandatory = unique(mandatoryFromSection.length ? mandatoryFromSection : skills.slice(0, 8));
  const preferred = unique(
    preferredFromSection.length
      ? preferredFromSection
      : skills.slice(mandatory.length, mandatory.length + 6).filter((skill) => !mandatory.some((item) => lower(item) === lower(skill))),
  );
  const years = yearsFromText(blob);
  const education = educationFromText(blob);
  return {
    mandatory,
    preferred,
    education,
    years,
  };
}

function sectionSkills(description, heading) {
  const text = String(description || "");
  const match = text.match(new RegExp(`(?:${heading.source})[:\\s]*([\\s\\S]{0,1800}?)(?:\\n\\s*\\n|responsibilities|about |benefits|$)`, "i"));
  if (!match) return [];
  return match[1]
    .split(/\n+|·|•|;/)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter((line) => line.length >= 2 && line.length <= 48 && !/[?]/.test(line));
}

function skillsFromDescription(description) {
  const text = String(description || "");
  const known = [
    "JavaScript",
    "TypeScript",
    "React",
    "Node",
    "Python",
    "SQL",
    "Product management",
    "Figma",
    "AWS",
    "Java",
    "Excel",
    "A/B testing",
    "User research",
    "Roadmapping",
    "Communication",
    "Leadership",
  ];
  return known.filter((skill) => new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text));
}

export function parseRequirements(value, fallbackSkills = []) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value || "{}") : value || {};
    if (parsed && (Array.isArray(parsed.mandatory) || Array.isArray(parsed.preferred))) {
      return {
        mandatory: unique(parsed.mandatory || []),
        preferred: unique(parsed.preferred || []),
        education: String(parsed.education || ""),
        years: parsed.years == null || parsed.years === "" ? null : Number(parsed.years),
      };
    }
  } catch {
    // fall through
  }
  const skills = Array.isArray(fallbackSkills) ? fallbackSkills : [];
  try {
    const parsedSkills = typeof fallbackSkills === "string" ? JSON.parse(fallbackSkills || "[]") : skills;
    return extractRequirements({ skills: Array.isArray(parsedSkills) ? parsedSkills : [] });
  } catch {
    return extractRequirements({ skills: [] });
  }
}

function experienceScore(doc, job) {
  const titles = (doc.employment || []).map((item) => lower(`${item.title || ""} ${item.employer || ""}`));
  const role = lower(`${job.title || ""} ${job.role || ""}`);
  if (!titles.length) return 0.2;
  if (titles.some((title) => title && (role.includes(title.split(",")[0].trim()) || title.includes(lower(job.role))))) return 1;
  const tokens = role.split(/\W+/).filter((token) => token.length > 3);
  const overlap = tokens.filter((token) => titles.some((title) => title.includes(token)));
  if (overlap.length >= 2) return 0.75;
  if (overlap.length === 1) return 0.5;
  return 0.25;
}

function industryScore(doc, job) {
  const category = lower(job.category || "");
  if (!category) return 0.5;
  const blob = lower(JSON.stringify(doc.employment || []));
  if (blob.includes(category)) return 1;
  const role = lower(job.role || job.title || "");
  if (blob.includes(role.split(" ")[0] || "")) return 0.7;
  return 0.35;
}

function educationScore(doc, requirements) {
  const wanted = lower(requirements.education || "");
  if (!wanted) return 0.7;
  const have = lower((doc.education || []).join(" "));
  if (!have) return 0.3;
  if (have.includes(lower(wanted)) || (wanted.includes("bachelor") && /bachelor|bs|ba|bsc|degree/.test(have))) return 1;
  if (wanted.includes("master") && /master|mba|ms\b/.test(have)) return 1;
  return 0.4;
}

function locationScore(preferences, job) {
  const places = lower(preferences.locations || "");
  if (!places) return 0.7;
  const remoteOk = lower(preferences.workArrangement || "").includes("remote") || places.includes("remote");
  if (lower(job.remote_type || job.remoteType) === "remote" && remoteOk) return 1;
  const location = lower(job.location || "");
  if (places.split(/[,/]/).some((place) => place.trim() && location.includes(place.trim()))) return 1;
  if (lower(job.remote_type || job.remoteType) === "remote") return 0.75;
  return 0.35;
}

function salaryScore(preferences, job) {
  const wanted = parseTargetSalary(preferences.salary);
  if (!wanted) return 0.7;
  const max = Number(job.salary_max || job.salaryMax || 0);
  const min = Number(job.salary_min || job.salaryMin || 0);
  if (!max && !min) return 0.55;
  if (max && wanted <= max) return 1;
  if (min && wanted <= min * 1.1) return 0.8;
  if (max && wanted <= max * 1.15) return 0.6;
  return 0.25;
}

function yearsScore(doc, requirements) {
  if (requirements.years == null || !Number.isFinite(Number(requirements.years))) return 0.7;
  const wanted = Number(requirements.years);
  const blob = JSON.stringify(doc.employment || []);
  const found = yearsFromText(blob);
  if (found != null && found >= wanted) return 1;
  const roles = (doc.employment || []).length;
  if (roles >= Math.ceil(wanted / 3)) return 0.65;
  return 0.35;
}

export function matchLabel(score) {
  if (score >= 85) return "Strong match";
  if (score >= 70) return "Good match";
  if (score >= 55) return "Possible match";
  if (score >= 40) return "Weak match";
  return "Not recommended";
}

export function matchLabelKey(scoreOrLabel) {
  const value = String(scoreOrLabel || "").toLowerCase();
  if (/^\d+$/.test(value)) return matchLabelKey(matchLabel(Number(value)));
  if (value.includes("strong")) return "strong";
  if (value.includes("good")) return "good";
  if (value.includes("possible")) return "possible";
  if (value.includes("weak")) return "weak";
  return "not_recommended";
}

/**
 * Score a resume document against a job row.
 * Optional `options.facts` attaches ledger provenance to matched skills.
 * Deterministic gates remain authoritative; embeddings (if enabled) are display-only.
 * @returns {{ score: number, label: string, matched: string[], missing: string[], preferredMatched: string[], matchedFacts: object[], explanation: string, parts: object, semanticHint: number|null }}
 */
export function matchJob(doc, preferences, job, options = {}) {
  const facts = Array.isArray(options.facts) ? options.facts : [];
  const requirements = parseRequirements(job.requirements, job.skills);
  const ownedSkills = skillsForMatching(doc.skills || [], facts);
  const owned = ownedSkills.map((skill) => lower(skill));
  const mandatory = requirements.mandatory;
  const preferred = requirements.preferred;
  const matched = mandatory.filter((skill) => skillHit(owned, skill));
  const missing = mandatory.filter((skill) => !skillHit(owned, skill));
  const preferredMatched = preferred.filter((skill) => skillHit(owned, skill));
  const matchedFacts = matched.map((skill) => citeSkillFact(skill, facts));
  const requiredSkills = mandatory.length ? matched.length / mandatory.length : 0.45;
  const preferredSkills = preferred.length ? preferredMatched.length / preferred.length : 0.5;
  const core = Math.max(experienceScore(doc, job), yearsScore(doc, requirements) * 0.85);
  const parts = {
    coreExperience: core,
    requiredSkills,
    roleSimilarity: experienceScore(doc, job),
    industry: industryScore(doc, job),
    education: educationScore(doc, requirements),
    location: locationScore(preferences || {}, job),
    salary: salaryScore(preferences || {}, job),
    preferredSkills,
  };
  const semanticHint = embeddingsOverlapHint(doc, job, options);
  const score = Math.round(
    parts.coreExperience * WEIGHTS.coreExperience +
      parts.requiredSkills * WEIGHTS.requiredSkills +
      parts.roleSimilarity * WEIGHTS.roleSimilarity +
      parts.industry * WEIGHTS.industry +
      parts.education * WEIGHTS.education +
      parts.location * WEIGHTS.location +
      parts.salary * WEIGHTS.salary +
      parts.preferredSkills * WEIGHTS.preferredSkills,
  );
  const clamped = Math.max(1, Math.min(99, score));
  const label = matchLabel(clamped);
  const bits = [];
  if (matchedFacts.length) {
    const cites = matchedFacts.slice(0, 4).map((item) => {
      const ids = item.fact_ids?.length ? ` [${item.fact_ids.join(", ")}]` : "";
      return `${item.skill}${ids}`;
    });
    bits.push(`Overlaps on ${cites.join(", ")}`);
  } else if (matched.length) {
    bits.push(`Overlaps on ${matched.slice(0, 4).join(", ")}`);
  }
  if (missing.length) bits.push(`Missing ${missing.slice(0, 3).join(", ")}`);
  if (parts.location >= 0.9) bits.push("Location fits your preferences");
  if (parts.location <= 0.4) bits.push("Location is a stretch");
  if (semanticHint != null && semanticHint >= 0.55) bits.push("Semantic overlap looks supportive (display-only)");
  if (!bits.length) bits.push("Limited overlap with the listing");
  return {
    score: clamped,
    label,
    labelKey: matchLabelKey(label),
    matched,
    missing,
    preferredMatched,
    matchedFacts,
    explanation: bits.join(". ") + ".",
    parts,
    requirements,
    semanticHint,
  };
}

/** Lightweight bag-of-tokens overlap behind MATCH_EMBEDDINGS=1 — never changes score gates. */
function embeddingsOverlapHint(doc, job, options = {}) {
  const enabled = options.embeddings === true || String(process.env.MATCH_EMBEDDINGS || "") === "1";
  if (!enabled) return null;
  const docSkills = Array.isArray(doc.skills) ? doc.skills.join(" ") : String(doc.skills || "");
  const jobSkills = Array.isArray(job.skills) ? job.skills.join(" ") : String(job.skills || "");
  const left = tokenize(`${doc.summary || ""} ${docSkills} ${JSON.stringify(doc.employment || [])}`);
  const right = tokenize(`${job.title || ""} ${job.description || ""} ${jobSkills}`);
  if (!left.size || !right.size) return 0;
  let hit = 0;
  for (const token of left) if (right.has(token)) hit += 1;
  return hit / Math.max(left.size, right.size);
}

function tokenize(text) {
  return new Set(
    String(text || "")
      .toLowerCase()
      .split(/[^a-z0-9+#.]+/i)
      .filter((token) => token.length > 2),
  );
}

export const MATCH_WEIGHTS = WEIGHTS;
