import { prompts } from "./ai.mjs";
import { completeJson } from "./ai-run.mjs";
import { reconcileProducerReviewer } from "./ai-reconcile.mjs";
import { isResumeImageFilename, ocrResumeImage } from "./resume-ocr.mjs";

const SKILL_WORDS = [
  "Product management",
  "SQL",
  "Figma",
  "User research",
  "Data analysis",
  "JavaScript",
  "TypeScript",
  "React",
  "Python",
  "Communication",
  "Marketing",
  "Excel",
  "Leadership",
  "A/B testing",
  "Roadmapping",
  "Cisco",
  "AWS",
  "Azure",
];

const CORRUPT_MARK = /[¨ˆ˜˘˙˚˛˝°≡¼½¾¤¦§☒÷×⊘⋊⊲⊳◊◆◇□■▪▫※†‡•‣※Ω∑∏√∞≈≠≤≥«»‹›¡¿¢£¥€℗™℠]/g;
const PRIVATE_OR_SYMBOL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uE000-\uF8FF\uFFF0-\uFFFF]/g;
const NOT_A_NAME =
  /\b(resume|curriculum|vitae|summary|experience|address|email|phone|mobile|objective|profile|skills|education|contact|references|personal|married|born|service|management|manager|engineer|developer|administrator|support|supervisor|design|designer|system|systems|solution|application|server|network|professional|director|analyst|consultant|specialist|officer|assistant|coordinator|architect|technician|managed|deployed|developed|configured|maintained|installed|implemented|led|built|created|improved|responsible|duties|role|title|location|city|state|country|present|current|remote|hybrid)\b/i;
const STOP_HEADER = /^(summary|experience|employment|work history|skills|education|projects|certifications|objective|profile)\b/i;
const LABEL_LINE = /^(name|email|phone|mobile|address|location|city|tel|telephone|dob|date of birth)\s*[:#-]?\s*$/i;
const FILLER_WORD = /^(the|and|for|with|from|into|onto|over|under|call|centre|center|deployment|preparation|solution|solutions|systems|server|remote|work)$/i;

function isAllowedChar(ch) {
  return /[\p{L}\p{N}]/u.test(ch) || ".,;:'\"’‘“”-–—/&()@+#%$!?*|".includes(ch);
}

function weirdRatio(value) {
  const compact = [...String(value || "")].filter((ch) => !/\s/.test(ch));
  if (!compact.length) return 1;
  let weird = 0;
  for (const ch of compact) {
    if (!isAllowedChar(ch)) weird += 1;
  }
  return weird / compact.length;
}

function scriptCounts(value) {
  let latin = 0;
  let cjk = 0;
  let greek = 0;
  let other = 0;
  for (const ch of String(value || "")) {
    if (/\s/.test(ch)) continue;
    if (/[\u0041-\u007A\u00C0-\u024F\u1E00-\u1EFF]/i.test(ch)) latin += 1;
    else if (/[\u3040-\u30FF\u3400-\u9FFF\uF900-\uFAFF]/.test(ch)) cjk += 1;
    else if (/[\u0370-\u03FF\u1F00-\u1FFF]/.test(ch)) greek += 1;
    else if (/[\p{L}\p{N}]/u.test(ch)) other += 1;
  }
  return { latin, cjk, greek, other };
}

export function looksCorrupt(value) {
  const text = String(value || "");
  if (!text.trim()) return true;
  if (PRIVATE_OR_SYMBOL.test(text)) return true;
  const marks = text.match(CORRUPT_MARK);
  if (marks && marks.length >= 1 && weirdRatio(text) > 0.04) return true;
  if (marks && marks.length >= 2) return true;
  if (weirdRatio(text) > 0.08) return true;
  const scripts = scriptCounts(text);
  if (scripts.cjk && scripts.latin) return true;
  if (scripts.greek >= 2 && scripts.latin) return true;
  if (/[ØÐÞæðþßÐ]/.test(text) && /[≡½¾¼×÷¤¦§]/.test(text)) return true;
  return false;
}

function sanitizeFragment(value) {
  return String(value || "")
    .replace(PRIVATE_OR_SYMBOL, "")
    .replace(CORRUPT_MARK, " ")
    .replace(/[^\S\n]+/g, " ")
    .trim();
}

export function cleanResumeText(text) {
  return String(text || "")
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .split(/\r?\n/)
    .map((line) => sanitizeFragment(line.replace(/[^\S\n]+/g, " ")))
    .filter((line) => line && !looksCorrupt(line) && !LABEL_LINE.test(line))
    .join("\n");
}

function appearsIn(source, value) {
  if (!value) return false;
  return String(source || "").toLowerCase().includes(String(value).toLowerCase());
}

function isPersonName(name) {
  const value = String(name || "").replace(/\s+/g, " ").trim();
  if (value.length < 2 || value.length > 60) return false;
  if (looksCorrupt(value) || /\d|@|:/.test(value)) return false;
  if (!/^[\p{L}][\p{L}\s.'’-]*$/u.test(value)) return false;
  if (NOT_A_NAME.test(value)) return false;
  if (/^(us|uk|uae|eu)\s+address$/i.test(value)) return false;
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 5) return false;
  if (words.some((word) => FILLER_WORD.test(word))) return false;
  const letters = (word) => word.replace(/[.'’\-]/g, "");
  if (words.length === 1) {
    const word = letters(words[0]);
    if (word.length < 3 || word === word.toUpperCase()) return false;
  }
  const allShortCaps = words.every((word) => {
    const plain = letters(word);
    return plain.length <= 4 && plain === plain.toUpperCase() && !word.includes(".");
  });
  if (allShortCaps && words.length === 1) return false;
  // Prefer real names: most words capitalized, no long lowercase filler phrases.
  const titled = words.filter((word) => /^[\p{L}]/u.test(word) && word[0] === word[0].toUpperCase());
  if (titled.length < Math.ceil(words.length / 2)) return false;
  if (words.length >= 3 && words.every((word) => letters(word).length >= 4) && /ing\b|ment\b|tion\b/i.test(value)) {
    return false;
  }
  return words.some((word) => letters(word).length >= 2);
}

function headerLines(source) {
  const lines = String(source || "")
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const stop = lines.findIndex((line) => STOP_HEADER.test(line));
  return (stop < 0 ? lines.slice(0, 12) : lines.slice(0, stop)).slice(0, 12);
}

function pickName(source, city) {
  for (const line of headerLines(source)) {
    const candidate = line
      .split(/\s+[|•]\s+/)[0]
      .replace(/^(name|full name)\s*[:#-]?\s*/i, "")
      .trim();
    if (city && candidate.toLowerCase() === String(city).toLowerCase()) continue;
    if (/,\s*[A-Z]{2}\b/.test(candidate)) continue;
    if (/@|https?:|\d{3,}/.test(candidate)) continue;
    if (isPersonName(candidate)) return candidate;
  }
  return "";
}

function listEmails(text) {
  const found = [];
  for (const match of String(text || "").matchAll(/[A-Z0-9][A-Z0-9._%+-]*@[A-Z0-9.-]+\.[A-Z]{2,}/gi)) {
    const email = match[0].replace(/[.,;:]+$/, "");
    const local = email.split("@")[0] || "";
    if (local.length < 2) continue;
    if (!found.some((item) => item.toLowerCase() === email.toLowerCase())) found.push(email);
  }
  found.sort((a, b) => b.length - a.length);
  return found;
}

function pickEmail(candidate, source) {
  const found = listEmails(source);
  const wanted = String(candidate || "").trim().toLowerCase();
  const exact = found.find((email) => email.toLowerCase() === wanted);
  if (exact) return exact;
  const longer = found.find((email) => wanted && email.toLowerCase().endsWith(wanted) && email.length > wanted.length);
  if (longer) return longer;
  return found[0] || "";
}

function digitsOf(value) {
  return String(value || "").replace(/\D/g, "");
}

function listPhones(text) {
  const found = [];
  for (const match of String(text || "").matchAll(/\(?\+?\d[\d \t().-]{8,18}\d/g)) {
    let raw = match[0].trim().replace(/[ \t.()-]+$/, "");
    if (/[\r\n,]/.test(raw)) continue;
    const pieces = raw.split(/[ \t]+/);
    if (pieces.length > 1 && digitsOf(pieces[0]).length >= 10 && digitsOf(pieces[0]).length <= 15) {
      const rest = digitsOf(pieces.slice(1).join(""));
      if (rest.length > 0 && rest.length < 7 && digitsOf(raw).length > 11) raw = pieces[0];
    }
    const count = digitsOf(raw).length;
    if (count < 10 || count > 15 || raw.length > 20) continue;
    if (!found.some((item) => digitsOf(item) === digitsOf(raw))) found.push(raw);
  }
  return found;
}

function pickPhone(candidate, source) {
  const found = listPhones(source);
  const parts = String(candidate || "")
    .split(/[,;/]|\band\b/i)
    .map((part) => part.trim())
    .filter(Boolean);
  for (const part of parts) {
    const count = digitsOf(part);
    if (count.length < 10 || count.length > 15 || looksCorrupt(part)) continue;
    const hit = found.find((phone) => {
      const other = digitsOf(phone);
      return other === count || other.endsWith(count.slice(-10)) || count.endsWith(other.slice(-10));
    });
    if (hit) return hit;
  }
  return found[0] || "";
}

function isLocationLabel(value) {
  return /^(us|uk|uae|eu)?\s*address$/i.test(String(value || "").trim()) || /^(location|city|state|country)$/i.test(String(value || "").trim());
}

function pickCity(source, candidate = "") {
  const wanted = String(candidate || "").replace(/\s+/g, " ").trim();
  if (wanted && !looksCorrupt(wanted) && !isLocationLabel(wanted) && appearsIn(source, wanted) && wanted.length < 48) {
    if (/,\s*[A-Z]{2}\b/.test(wanted) || /^[\p{L}][\p{L}\s.'’-]*$/u.test(wanted)) return wanted;
  }
  const lines = String(source || "")
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines.slice(0, 20)) {
    if (looksCorrupt(line) || isLocationLabel(line) || /@/.test(line)) continue;
    if (/,\s*[A-Z]{2}\b/.test(line) && line.length < 48) return line;
    const cityOnly = line.match(/^([A-Z][\p{L}'’.-]+(?:\s+[A-Z][\p{L}'’.-]+){0,2}),?\s*([A-Z]{2})\b/u);
    if (cityOnly) return `${cityOnly[1]}, ${cityOnly[2]}`;
  }
  return "";
}

function pickAddress(source, candidate = "") {
  const wanted = String(candidate || "").replace(/\s+/g, " ").trim();
  if (wanted && !looksCorrupt(wanted) && appearsIn(source, wanted) && wanted.length <= 120) {
    if (/^\d+\s+\w+/.test(wanted) || /street|st\.|ave|road|rd\.|blvd|lane|dr\.|apt\b|close|street/i.test(wanted)) {
      return wanted;
    }
  }
  const lines = String(source || "")
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines.slice(0, 25)) {
    if (looksCorrupt(line) || isLocationLabel(line)) continue;
    if (/^\d+\s+\w+/.test(line) && /street|st\.|ave|road|rd\.|blvd|lane|dr\.|apt\b|close|street/i.test(line) && line.length <= 120) {
      return line;
    }
  }
  return "";
}

function cleanPlain(value, source, max) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text || text.length > max || looksCorrupt(text) || isLocationLabel(text)) return "";
  if (source && !appearsIn(source, text)) return "";
  return text;
}

function cleanSummary(value, source) {
  const text = String(value || "").replace(/\s+/g, " ").trim().slice(0, 500);
  if (!text || looksCorrupt(text)) return "";
  if (/born on|married\.?$/i.test(text) && text.length < 80) return "";
  const words = text.split(/\s+/).filter((word) => word.replace(/[^A-Za-z0-9]/g, "").length > 3);
  if (!words.length) return text.length < 80 && appearsIn(source, text) ? text : "";
  const hay = String(source || "").toLowerCase();
  const hits = words.filter((word) => hay.includes(word.toLowerCase().replace(/[^a-z0-9]/gi, "")));
  if (hits.length / words.length < 0.55) return "";
  return text;
}

function section(lines, start, stops) {
  const from = lines.findIndex((line) => new RegExp(`^${start}\\b`, "i").test(line));
  if (from < 0) return [];
  const rest = lines.slice(from + 1);
  const end = rest.findIndex((line) => stops.some((stop) => new RegExp(`^${stop}\\b`, "i").test(line)));
  return (end < 0 ? rest : rest.slice(0, end)).filter((line) => !/^[-•]$/.test(line));
}

export function deterministicExtract(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const email = pickEmail("", text);
  const phone = pickPhone("", text);
  const city = pickCity(text);
  const name = pickName(text, city);
  const address = pickAddress(text);
  const summaryBlock = section(lines, "Summary", ["Experience", "Skills", "Education", "Employment", "Work History"]);
  const summary = summaryBlock.join(" ").slice(0, 500);
  const skillLines = section(lines, "Skills", ["Education", "Experience", "Summary", "Employment"]);
  const skills = SKILL_WORDS.filter((skill) => new RegExp(skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text));
  for (const line of skillLines.join(",").split(/[,•]/)) {
    const clean = line.trim();
    if (clean && clean.length < 40 && !looksCorrupt(clean) && !skills.some((skill) => skill.toLowerCase() === clean.toLowerCase())) {
      skills.push(clean);
    }
  }
  const experience = section(lines, "Experience", ["Skills", "Education", "Summary"])
    .concat(section(lines, "Employment", ["Skills", "Education", "Summary"]))
    .concat(section(lines, "Work History", ["Skills", "Education", "Summary"]));
  const employment = [];
  let current = null;
  for (const line of experience) {
    if (looksCorrupt(line)) continue;
    const bullet = line.replace(/^[-•*]\s*/, "");
    const marked = /^[-•*]/.test(line);
    const sentence = current && /[.!?]$/.test(bullet) && !/,/.test(bullet);
    if (marked || sentence) {
      current?.bullets.push(bullet);
      continue;
    }
    if (/^\d{4}|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i.test(bullet) && /\b(present|current|date|\d{4})\b/i.test(bullet) && bullet.length < 40) {
      if (current && !current.dates) current.dates = bullet;
      continue;
    }
    const parts = bullet.split(/\s*[•|,]\s*/).map((part) => part.trim()).filter(Boolean);
    current = {
      title: parts[0] || bullet,
      employer: parts[1] || "",
      dates: "",
      bullets: [],
    };
    employment.push(current);
  }
  const education = section(lines, "Education", ["Skills", "Experience", "Summary"]);
  const facts = [];
  if (name) facts.push(fact("ID-001", "identity", `Name: ${name}`, 0.9));
  if (email) facts.push(fact("ID-002", "identity", `Email: ${email}`, 0.99));
  if (phone) facts.push(fact("ID-003", "identity", `Phone: ${phone}`, 0.95));
  if (city) facts.push(fact("ID-004", "identity", `Location: ${city}`, 0.8));
  employment.forEach((job, index) => {
    facts.push(fact(`EXP-${String(index + 1).padStart(3, "0")}`, "employment", `${job.title}${job.employer ? ` at ${job.employer}` : ""}`, 0.75));
  });
  skills.slice(0, 12).forEach((skill, index) => {
    facts.push(fact(`SKILL-${String(index + 1).padStart(3, "0")}`, "skill", skill, 0.85));
  });
  const questions = [];
  if (!email) questions.push("Which email should we use for your account?");
  if (!phone) questions.push("What phone number should employers use?");
  if (!city && !address) questions.push("Which city are you based in?");
  return {
    name,
    email,
    phone,
    address,
    city,
    summary,
    skills: skills.slice(0, 12),
    employment,
    education,
    facts,
    questions,
    provider: "deterministic",
    model: "rules-v1",
    prompt: "CAREER_EXTRACTION_V1",
  };
}

function fact(factId, category, statement, confidence) {
  return {
    fact_id: factId,
    category,
    statement,
    confidence,
    source: "uploaded_resume",
    verified_by_user: false,
  };
}

function cleanSkills(skills, source) {
  const out = [];
  for (const skill of skills || []) {
    const text = String(skill || "").replace(/\s+/g, " ").trim();
    if (!text || text.length > 48 || looksCorrupt(text) || !appearsIn(source, text)) continue;
    if (out.some((item) => item.toLowerCase() === text.toLowerCase())) continue;
    out.push(text);
    if (out.length >= 12) break;
  }
  return out;
}

function cleanEmployment(jobs, source) {
  const out = [];
  for (const job of jobs || []) {
    const title = String(job?.title || "").replace(/\s+/g, " ").trim();
    const employer = String(job?.employer || "").replace(/\s+/g, " ").trim();
    let dates = String(job?.dates || "").replace(/\s+/g, " ").trim();
    if (!title || title.length > 80 || looksCorrupt(title) || looksCorrupt(employer)) continue;
    if (/\bdate\b/i.test(title) && title.length < 28) continue;
    if (!appearsIn(source, title)) continue;
    if (employer && (!appearsIn(source, employer) || employer.length > 80)) continue;
    if (dates && (looksCorrupt(dates) || /\bdate\b/i.test(dates) || !appearsIn(source, dates))) dates = "";
    const bullets = [];
    for (const bullet of job?.bullets || []) {
      const text = String(bullet || "").replace(/\s+/g, " ").trim();
      if (!text || text.length > 240 || looksCorrupt(text) || !appearsIn(source, text)) continue;
      if (/^(born on|married)\b/i.test(text)) continue;
      bullets.push(text);
      if (bullets.length >= 6) break;
    }
    out.push({ title, employer, dates: dates || "", bullets });
    if (out.length >= 8) break;
  }
  return out;
}

function cleanEducation(items, source) {
  const out = [];
  for (const item of items || []) {
    const text = String(item || "").replace(/\s+/g, " ").trim();
    if (!text || text.length > 120 || looksCorrupt(text) || !appearsIn(source, text)) continue;
    if (/^(born on|married)\b/i.test(text)) continue;
    out.push(text);
    if (out.length >= 6) break;
  }
  return out;
}

function rebuildFacts(profile) {
  const facts = [];
  if (profile.name) facts.push(fact("ID-001", "identity", `Name: ${profile.name}`, 0.9));
  if (profile.email) facts.push(fact("ID-002", "identity", `Email: ${profile.email}`, 0.99));
  if (profile.phone) facts.push(fact("ID-003", "identity", `Phone: ${profile.phone}`, 0.95));
  if (profile.city) facts.push(fact("ID-004", "identity", `Location: ${profile.city}`, 0.8));
  else if (profile.address) facts.push(fact("ID-004", "identity", `Address: ${profile.address}`, 0.8));
  profile.employment.forEach((job, index) => {
    const statement = `${job.title}${job.employer ? ` at ${job.employer}` : ""}${job.dates ? ` (${job.dates})` : ""}`;
    if (looksCorrupt(statement)) return;
    facts.push(fact(`EXP-${String(index + 1).padStart(3, "0")}`, "employment", statement, 0.75));
  });
  profile.skills.forEach((skill, index) => {
    if (looksCorrupt(skill)) return;
    facts.push(fact(`SKILL-${String(index + 1).padStart(3, "0")}`, "skill", skill, 0.85));
  });
  return facts.filter((item) => !looksCorrupt(item.statement));
}

export function reviewExtraction(extracted, sourceText) {
  const source = cleanResumeText(sourceText);
  const unsupported = [];
  const warnings = [];
  const name = isPersonName(extracted.name) && appearsIn(source, extracted.name) ? String(extracted.name).replace(/\s+/g, " ").trim() : "";
  const email = pickEmail(extracted.email, source);
  const phone = pickPhone(extracted.phone, source);
  const city = pickCity(source, cleanPlain(extracted.city, source, 48) || extracted.city);
  const address = pickAddress(source, extracted.address);
  if (extracted.name && !name) unsupported.push("name");
  if (extracted.email && !email) unsupported.push("email");
  if (extracted.phone && !phone) unsupported.push("phone");
  if (extracted.city && !city) unsupported.push("city");
  if (extracted.address && !address) unsupported.push("address");
  const profile = {
    ...extracted,
    name: name || pickName(source, city),
    email,
    phone,
    city,
    address,
    summary: cleanSummary(extracted.summary, source),
    skills: cleanSkills(extracted.skills, source),
    employment: cleanEmployment(extracted.employment, source),
    education: cleanEducation(extracted.education, source),
    warnings: [],
  };
  profile.facts = rebuildFacts(profile);
  profile.questions = [];
  if (!profile.email) profile.questions.push("Which email should we use for your account?");
  if (!profile.phone) profile.questions.push("What phone number should employers use?");
  if (!profile.city && !profile.address) profile.questions.push("Which city are you based in?");
  if (!profile.name) profile.questions.push("What full name should appear on your account?");
  if (unsupported.length) {
    warnings.push("Some extracted details were removed because they were not found clearly in the resume.");
  }
  if (!profile.email) warnings.push("No email was found. Add one to activate the account.");
  if (!profile.name) warnings.push("No clear name was found. Add your full name before activating.");
  profile.warnings = warnings;
  profile.review = {
    status: unsupported.length || !profile.name || !profile.email ? "adjusted" : "pass",
    unsupported,
    prompt: prompts.CAREER_EXTRACTION_V1.slice(0, 80),
  };
  return profile;
}

export async function extractCareerProfile(text) {
  const source = cleanResumeText(text);
  const baseline = deterministicExtract(source);
  const ai = await completeJson("career_extraction", prompts.CAREER_EXTRACTION_V1, source.slice(0, 14000));
  const reviewed = reviewExtraction(
    ai.json
      ? {
          ...baseline,
          name: ai.json.name || baseline.name,
          email: ai.json.email || baseline.email,
          phone: ai.json.phone || baseline.phone,
          address: ai.json.address || baseline.address,
          city: ai.json.city || baseline.city,
          summary: ai.json.summary || baseline.summary,
          skills: Array.isArray(ai.json.skills) && ai.json.skills.length ? ai.json.skills : baseline.skills,
          employment: Array.isArray(ai.json.employment) && ai.json.employment.length ? ai.json.employment : baseline.employment,
          education: Array.isArray(ai.json.education) && ai.json.education.length ? ai.json.education : baseline.education,
          facts: Array.isArray(ai.json.facts) && ai.json.facts.length ? ai.json.facts : baseline.facts,
        }
      : baseline,
    source,
  );
  reviewed.provider = ai.provider;
  reviewed.model = ai.model;
  reviewed.costMicros = ai.costMicros || 0;
  reviewed.prompt = "CAREER_EXTRACTION_V1";
  if (!ai.json && ai.error) {
    reviewed.warnings = [
      ...(reviewed.warnings || []),
      "We could not use the automatic extraction service, so a simpler rules-based pass was used.",
    ];
  }

  const reviewAi = await completeJson(
    "career_review",
    prompts.CAREER_REVIEW_V1,
    JSON.stringify({
      resume: source.slice(0, 10000),
      profile: {
        name: reviewed.name,
        email: reviewed.email,
        phone: reviewed.phone,
        address: reviewed.address,
        city: reviewed.city,
        summary: reviewed.summary,
        skills: reviewed.skills,
        employment: reviewed.employment,
        education: reviewed.education,
      },
    }),
  );
  reviewed.costMicros = (reviewed.costMicros || 0) + (reviewAi.costMicros || 0);
  reviewed.reviewer = { provider: reviewAi.provider, model: reviewAi.model };
  if (reviewAi.json) {
    const unsupported = Array.isArray(reviewAi.json.unsupported)
      ? reviewAi.json.unsupported.map(String).filter(Boolean)
      : [];
    const notes = Array.isArray(reviewAi.json.notes) ? reviewAi.json.notes.map(String).filter(Boolean) : [];
    const reconciliation = reconcileProducerReviewer({
      source,
      profile: reviewed,
      reviewer: {
        status: reviewAi.json.status,
        unsupported,
        notes,
      },
    });
    Object.assign(reviewed, reconciliation.profile);
    reviewed.reconciliation = {
      status: reconciliation.status,
      decisions: reconciliation.decisions,
      dropped: reconciliation.dropped,
      kept: reconciliation.kept,
      confirmed: reconciliation.confirmed,
      producer: { provider: ai.provider, model: ai.model },
      reviewer: { provider: reviewAi.provider, model: reviewAi.model },
    };
    if (unsupported.length || reconciliation.dropped.length || reconciliation.confirmed.length) {
      reviewed.warnings = [
        ...new Set([
          ...(reviewed.warnings || []),
          "Producer and reviewer disagreed on some claims; rules kept only resume-supported details.",
        ]),
      ];
    }
  } else if (reviewAi.error) {
    reviewed.warnings = [...(reviewed.warnings || []), "A second review pass was unavailable; basic checks were used instead."];
    reviewed.reconciliation = {
      status: "reviewer_unavailable",
      decisions: [{ field: "*", action: "agree", reason: "Reviewer unavailable; rules-only profile kept." }],
      dropped: [],
      kept: [],
      confirmed: [],
      producer: { provider: ai.provider, model: ai.model },
      reviewer: { provider: reviewAi.provider, model: reviewAi.model, error: reviewAi.error },
    };
  } else {
    reviewed.reconciliation = {
      status: "agree",
      decisions: [{ field: "*", action: "agree", reason: "No reviewer disagreements reported." }],
      dropped: [],
      kept: [],
      confirmed: [],
      producer: { provider: ai.provider, model: ai.model },
      reviewer: { provider: reviewAi.provider, model: reviewAi.model },
    };
  }

  return reviewed;
}

function linesFromPdfItems(items) {
  const lines = [];
  let line = "";
  let lastY = null;
  let lastEnd = null;
  const flush = () => {
    const cleaned = sanitizeFragment(line.replace(/[ \t]{2,}/g, " "));
    if (cleaned && !looksCorrupt(cleaned)) lines.push(cleaned);
    line = "";
    lastEnd = null;
  };
  for (const item of items) {
    if (!item || typeof item.str !== "string" || !item.str) continue;
    const fragment = sanitizeFragment(item.str);
    if (!fragment || looksCorrupt(fragment)) continue;
    const y = item.transform?.[5] ?? 0;
    const x = item.transform?.[4] ?? 0;
    const gap = lastEnd == null ? 0 : x - lastEnd;
    if (lastY != null && Math.abs(y - lastY) > 3) flush();
    if (line && gap > 1.5 && !line.endsWith(" ") && !fragment.startsWith(" ")) line += " ";
    line += fragment;
    lastY = y;
    lastEnd = x + (Number(item.width) || 0);
    if (item.hasEOL) flush();
  }
  flush();
  return lines.join("\n");
}

async function readPdf(buffer) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    verbosity: 0,
    useSystemFonts: true,
  }).promise;
  try {
    const pages = [];
    for (let number = 1; number <= doc.numPages; number += 1) {
      const page = await doc.getPage(number);
      const content = await page.getTextContent();
      const text = linesFromPdfItems(content.items);
      if (text) pages.push(text);
    }
    return pages.join("\n\n");
  } finally {
    await doc.destroy();
  }
}

export async function readResumeFile(filename, buffer) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".txt") || lower.endsWith(".md")) return buffer.toString("utf8");
  if (lower.endsWith(".docx")) {
    const { writeFileSync, mkdtempSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { execFileSync } = await import("node:child_process");
    const dir = mkdtempSync(join(tmpdir(), "resume-"));
    const path = join(dir, "resume.docx");
    writeFileSync(path, buffer);
    const xml = execFileSync("python3", ["-c", "import zipfile,sys; print(zipfile.ZipFile(sys.argv[1]).read('word/document.xml').decode('utf-8','ignore'))", path], { encoding: "utf8" });
    return xml
      .replace(/<\/w:p>/g, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
        const code = Number.parseInt(hex, 16);
        return code > 31 && code !== 127 ? String.fromCodePoint(code) : " ";
      })
      .replace(/&#(\d+);/g, (_, num) => {
        const code = Number(num);
        return code > 31 && code !== 127 ? String.fromCodePoint(code) : " ";
      })
      .replace(/[ \t]{2,}/g, " ");
  }
  if (lower.endsWith(".pdf")) return readPdf(buffer);
  if (isResumeImageFilename(lower)) {
    const ocr = await ocrResumeImage({ filename, buffer });
    return ocr.text || "";
  }
  return "";
}

/**
 * Load resume text from PDF/DOCX/TXT or OCR an image via the Resume OCR pipeline.
 * @returns {Promise<{ text: string, ocr: null | { provider: string, model: string, costMicros: number, error?: string } }>}
 */
export async function loadResumeText(filename, buffer) {
  if (isResumeImageFilename(filename)) {
    const ocr = await ocrResumeImage({ filename, buffer });
    return { text: ocr.text || "", ocr };
  }
  const text = await readResumeFile(filename, buffer);
  return { text, ocr: null };
}
