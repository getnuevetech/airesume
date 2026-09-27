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
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const phone = text.match(/(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3}\)?[\s.-]?)\d{3}[\s.-]?\d{4}/)?.[0] || "";
  let name = "";
  for (const line of lines.slice(0, 8)) {
    if (line.includes("@") || line === phone || /resume|curriculum|^cv\b|summary|experience/i.test(line)) continue;
    if (line.length < 48 && line.split(/\s+/).length <= 5) {
      name = line;
      break;
    }
  }
  const city = lines.find((line) => /,\s*[A-Z]{2}\b/.test(line) && line.length < 48) || "";
  const address = lines.find((line) => /^\d+\s+\w+/.test(line) && /street|st\.|ave|road|rd\.|blvd|lane|dr\./i.test(line)) || "";
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
    const bullet = line.replace(/^[-•]\s*/, "");
    if (line.startsWith("-") || line.startsWith("•")) {
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

function appearsIn(source, value) {
  if (!value) return true;
  return source.toLowerCase().includes(String(value).toLowerCase());
}

export function reviewExtraction(extracted, sourceText) {
  const warnings = [];
  const unsupported = [];
  for (const field of ["name", "email", "phone", "city", "address"]) {
    if (extracted[field] && !appearsIn(sourceText, extracted[field])) {
      unsupported.push(field);
      extracted[field] = "";
    }
  }
  extracted.skills = (extracted.skills || []).filter((skill) => appearsIn(sourceText, skill));
  extracted.employment = (extracted.employment || []).filter((job) => {
    const ok = appearsIn(sourceText, job.employer || job.title);
    if (!ok) unsupported.push(job.title || job.employer);
    return ok;
  });
  if (unsupported.length) {
    warnings.push("Some extracted details were removed because they were not found in the resume.");
  }
  if (!extracted.email) warnings.push("No email was found. Add one to activate the account.");
  extracted.warnings = warnings;
  extracted.review = {
    status: unsupported.length ? "adjusted" : "pass",
    unsupported,
    prompt: prompts.CAREER_EXTRACTION_V1.slice(0, 80),
  };
  return extracted;
}

export async function extractCareerProfile(text) {
  const baseline = deterministicExtract(text);
  const ai = await completeJson("career_extraction", prompts.CAREER_EXTRACTION_V1, text.slice(0, 14000));
  if (!ai.json) {
    const reviewed = reviewExtraction(baseline, text);
    reviewed.provider = ai.provider;
    reviewed.model = ai.model;
    if (ai.error) reviewed.warnings = [...(reviewed.warnings || []), "The assigned model was unavailable, so a rules-based extraction was used."];
    return reviewed;
  }
  const parsed = ai.json;
  const merged = {
    ...baseline,
    ...parsed,
    provider: ai.provider,
    model: ai.model,
    prompt: "CAREER_EXTRACTION_V1",
    facts: Array.isArray(parsed.facts) && parsed.facts.length ? parsed.facts : baseline.facts,
    questions: baseline.questions,
  };
  return reviewExtraction(merged, text);
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
      .replace(/&#\d+;/g, " ")
      .replace(/[ \t]{2,}/g, " ");
  }
  if (lower.endsWith(".pdf")) {
    const raw = buffer.toString("latin1");
    const chunks = [];
    const pattern = /\((?:\\\)|\\.|[^)\\])*\)/g;
    for (const match of raw.match(pattern) || []) {
      const value = match.slice(1, -1).replace(/\\n/g, "\n").replace(/\\([()\\])/g, "$1");
      if (/[A-Za-z]{3,}/.test(value)) chunks.push(value);
    }
    return chunks.join("\n");
  }
  return "";
}
