/** Dedicated job requirement extraction (AI when available, deterministic fallback). */

import { completeJson } from "./ai-run.mjs";
import { extractRequirements } from "./match.mjs";

const PROMPT = `Extract structured job requirements from the listing.
Return strict JSON:
{"mandatory": string[], "preferred": string[], "education": string, "years": number|null, "management": boolean}
Rules:
- mandatory = required skills/tools clearly demanded
- preferred = nice-to-have skills
- education is a short phrase or empty string
- years is minimum years of experience or null
- Copy skills from the listing. Never invent tools that are not mentioned.`;

function cleanList(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const item of value) {
    const text = String(item || "").replace(/\s+/g, " ").trim();
    if (!text || text.length > 64) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= 16) break;
  }
  return out;
}

function mergeRequirements(primary, fallback) {
  return {
    mandatory: cleanList(primary?.mandatory?.length ? primary.mandatory : fallback.mandatory),
    preferred: cleanList(primary?.preferred?.length ? primary.preferred : fallback.preferred),
    education: String(primary?.education || fallback.education || "").trim(),
    years:
      primary?.years == null || primary?.years === ""
        ? fallback.years
        : Number.isFinite(Number(primary.years))
          ? Number(primary.years)
          : fallback.years,
    management: Boolean(primary?.management),
  };
}

/**
 * Extract normalized requirements for matching.
 * Always has a deterministic baseline; AI can refine when assigned.
 */
export async function extractJobRequirements(job = {}) {
  const baseline = extractRequirements({
    title: job.title,
    description: job.description || job.job_description,
    skills: Array.isArray(job.skills) ? job.skills : [],
    role: job.role,
    category: job.category,
  });
  const ai = await completeJson(
    "job_requirements",
    PROMPT,
    JSON.stringify({
      title: job.title || "",
      company: job.company || "",
      location: job.location || "",
      description: String(job.description || job.job_description || "").slice(0, 8000),
      skills: Array.isArray(job.skills) ? job.skills.slice(0, 20) : [],
    }),
  );
  if (!ai.json) {
    return {
      requirements: { ...baseline, management: false },
      provider: ai.provider,
      model: ai.model,
      costMicros: ai.costMicros || 0,
      source: "deterministic",
    };
  }
  return {
    requirements: mergeRequirements(ai.json, baseline),
    provider: ai.provider,
    model: ai.model,
    costMicros: ai.costMicros || 0,
    source: "ai",
  };
}
