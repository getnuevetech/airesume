import { prompts } from "./ai.mjs";
import { completeJson } from "./ai-run.mjs";

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

const CORRUPT_MARK = /[¨ˆ˜˘˙˚˛˝°≡¼½¾¤¦§]/g;
const NOT_A_NAME =
  /\b(resume|curriculum|vitae|summary|experience|address|email|phone|mobile|objective|profile|skills|education|contact|references|personal|married|born|service|management|manager|engineer|developer|administrator|support|supervisor|design|designer|system|systems|solution|application|server|network|professional|director|analyst|consultant|specialist|officer|assistant|coordinator|architect|technician)\b/i;

function isAllowedChar(ch) {
  return /[\p{L}\p{N}]/u.test(ch) || ".,;:'\"’‘“”-–—/&()@+#%$!?*•·|".includes(ch);
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

function looksCorrupt(value) {
  const text = String(value || "");
  if (!text.trim()) return true;
  const marks = text.match(CORRUPT_MARK);
  if (marks && marks.length >= 2) return true;
  return weirdRatio(text) > 0.12;
}

export function cleanResumeText(text) {
  return String(text || "")
    .replace(/\u0000/g, "")
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/[^\S\n]+/g, " ").trim())
    .filter((line) => line && !looksCorrupt(line))
    .join("\n");
}

function appearsIn(source, value) {
  if (!value) return false;
  return String(source || "").toLowerCase().includes(String(value).toLowerCase());
}

function isPersonName(name) {
  const value = String(name || "").replace(/\s+/g, " ").trim();
  if (value.length < 2 || value.length > 60) return false;
  if (looksCorrupt(value) || /\d|@/.test(value)) return false;
  if (!/^[\p{L}][\p{L}\s.'’-]*$/u.test(value)) return false;
  if (NOT_A_NAME.test(value)) return false;
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length > 5) return false;
  const letters = (word) => word.replace(/[.'’\-]/g, "");
  if (words.length === 1) {
    const word = letters(words[0]);
    if (word.length < 3 || word === word.toUpperCase()) return false;
  }
  const allShortCaps = words.every((word) => {
    const plain = letters(word);
    return plain.length <= 4 && plain === plain.toUpperCase() && !word.includes(".");
  });
  if (allShortCaps) return false;
  return words.some((word) => letters(word).length >= 2);
}

function pickName(source, city) {
  const lines = String(source || "")
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines.slice(0, 15)) {
    const candidate = line.split(/\s+[|•]\s+/)[0].trim();
    if (city && candidate.toLowerCase() === String(city).toLowerCase()) continue;
    if (/,\s*[A-Z]{2}\b/.test(candidate)) continue;
    if (isPersonName(candidate)) return candidate;
  }
  return "";
}

function listEmails(text) {
  const found = [];
  for (const match of String(text || "").matchAll(/[A-Z0-9][A-Z0-9._%+-]*@[A-Z0-9.-]+\.[A-Z]{2,}/gi)) {
    const email = match[0].replace(/[.,;:]+$/, "");
    const local = email.split("@")[0] || "";
    if (local.length < 3) continue;
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

function cleanPlain(value, source, max) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text || text.length > max || looksCorrupt(text)) return "";
  if (source && !appearsIn(source, text)) return "";
  return text;
}

function cleanSummary(value, source) {
  const text = String(value || "").replace(/\s+/g, " ").trim().slice(0, 500);
  if (!text || looksCorrupt(text)) return "";
  const words = text.split(/\s+/).filter((word) => word.replace(/[^A-Za-z0-9]/g, "").length > 3);
  if (!words.length) return text.length < 80 && appearsIn(source, text) ? text : "";
  const hay = String(source || "").toLowerCase();
  const hits = words.filter((word) => hay.includes(word.toLowerCase().replace(/[^a-z0-9]/gi, "")));
  if (hits.length / words.length < 0.6) return "";
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
  const city = lines.find((line) => /,\s*[A-Z]{2}\b/.test(line) && line.length < 48 && !looksCorrupt(line)) || "";
  const name = pickName(text, city);
  const address =
    lines.find((line) => /^\d+\s+\w+/.test(line) && /street|st\.|ave|road|rd\.|blvd|lane|dr\.|apt\b/i.test(line) && !looksCorrupt(line)) ||
    "";
  const summaryBlock = section(lines, "Summary", ["Experience", "Skills", "Education"]);
  const summary = summaryBlock.join(" ").slice(0, 500);
  const skillLines = section(lines, "Skills", ["Education", "Experience", "Summary"]);
  const skills = SKILL_WORDS.filter((skill) => new RegExp(skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text));
  for (const line of skillLines.join(",").split(/[,•]/)) {
    const clean = line.trim();
    if (clean && clean.length < 40 && !skills.some((skill) => skill.toLowerCase() === clean.toLowerCase())) {
      skills.push(clean);
    }
  }
  const experience = section(lines, "Experience", ["Skills", "Education", "Summary"]);
  const employment = [];
  let current = null;
  for (const line of experience) {
    const bullet = line.replace(/^[-•*]\s*/, "");
    const marked = /^[-•*]/.test(line);
    const sentence = current && /[.!?]$/.test(bullet) && !/,/.test(bullet);
    if (marked || sentence) {
      current?.bullets.push(bullet);
      continue;
    }
    const parts = bullet.split(",").map((part) => part.trim());
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
    const dates = String(job?.dates || "").replace(/\s+/g, " ").trim();
    if (!title || title.length > 80 || looksCorrupt(title) || looksCorrupt(employer)) continue;
    if (/\bdate\b/i.test(title) && title.length < 28) continue;
    if (!appearsIn(source, title)) continue;
    if (employer && (!appearsIn(source, employer) || employer.length > 80)) continue;
    if (dates && (looksCorrupt(dates) || !appearsIn(source, dates))) continue;
    const bullets = [];
    for (const bullet of job?.bullets || []) {
      const text = String(bullet || "").replace(/\s+/g, " ").trim();
      if (!text || text.length > 240 || looksCorrupt(text) || !appearsIn(source, text)) continue;
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
    facts.push(
      fact(
        `EXP-${String(index + 1).padStart(3, "0")}`,
        "employment",
        `${job.title}${job.employer ? ` at ${job.employer}` : ""}`,
        0.75,
      ),
    );
  });
  profile.skills.forEach((skill, index) => {
    facts.push(fact(`SKILL-${String(index + 1).padStart(3, "0")}`, "skill", skill, 0.85));
  });
  return facts;
}

export function reviewExtraction(extracted, sourceText) {
  const source = cleanResumeText(sourceText);
  const unsupported = [];
  const name = isPersonName(extracted.name) && appearsIn(source, extracted.name) ? String(extracted.name).replace(/\s+/g, " ").trim() : "";
  const email = pickEmail(extracted.email, source);
  const phone = pickPhone(extracted.phone, source);
  const city = cleanPlain(extracted.city, source, 48);
  const address = cleanPlain(extracted.address, source, 120);
  if (extracted.name && !name) unsupported.push("name");
  if (extracted.email && !email) unsupported.push("email");
  if (extracted.phone && !phone) unsupported.push("phone");
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
  profile.review = {
    status: unsupported.length ? "adjusted" : "pass",
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
  reviewed.warnings = [];
  if (!ai.json && ai.error) {
    reviewed.warnings = ["The assigned model was unavailable, so a rules-based extraction was used."];
  }
  return reviewed;
}

function linesFromPdfItems(items) {
  const lines = [];
  let line = "";
  let lastY = null;
  let lastEnd = null;
  const flush = () => {
    const cleaned = line.replace(/[ \t]{2,}/g, " ").trim();
    if (cleaned) lines.push(cleaned);
    line = "";
    lastEnd = null;
  };
  for (const item of items) {
    if (!item || typeof item.str !== "string" || !item.str || looksCorrupt(item.str)) continue;
    const y = item.transform?.[5] ?? 0;
    const x = item.transform?.[4] ?? 0;
    const gap = lastEnd == null ? 0 : x - lastEnd;
    if (lastY != null && Math.abs(y - lastY) > 3) flush();
    if (line && gap > 1.5 && !line.endsWith(" ") && !item.str.startsWith(" ")) line += " ";
    line += item.str;
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
  return "";
}
