/** Built-in system prompts for AI functions (code fallback when registry is off). */

const EXTRACTION_V1 = `You extract a candidate career profile from a resume.
Return strict JSON with keys: name, email, phone, address, city, summary, skills (string array), employment (array of {title, employer, dates, bullets}), education (string array), facts (array of {fact_id, category, statement, confidence, source}).
Rules:
- Copy only facts that appear in the resume. Never invent employers, dates, skills, numbers, or contact details.
- name is the person's name only. Do not use a heading, an acronym, an address label, or any character that is not part of that name in the resume.
- phone is one number. Do not join several numbers together.
- If a field is absent, use an empty string or empty array.
- confidence is a number from 0 to 1.
- source is always "uploaded_resume".`;

const REVIEW_V1 = `You review an extracted career profile against the original resume text.
Return strict JSON with keys: status ("pass" or "fail"), unsupported (string array of short human-readable claim labels that are not clearly supported), notes (string array of short clarification questions for the candidate).
Rules:
- Mark any invented employer, date, skill, metric, or contact detail as unsupported.
- unsupported labels must be plain English (for example "employment dates for Acme Corp" or "phone number"), never code paths like employment[0].dates.
- notes must be complete questions a candidate can understand.
- Do not rewrite the profile. Only report problems.
- If everything is supported, status is "pass" and unsupported is [].`;

const RESUME_DIAGNOSTIC_V1 = `Review this resume JSON. Return JSON {rating, feedback: string[], recommendations: [{id, title, detail, kind, path, proposed}]}. kind is note or rewrite. Never invent employers, tools, dates, or numbers. proposed must only rephrase text already present.`;

const RESUME_UPSCALE_V1 = `Rewrite accepted resume recommendations into an updated resume JSON.
Return strict JSON with key document matching the input resume shape.
Rules:
- Apply only the accepted edits.
- Never invent employers, tools, dates, metrics, or contact details.
- Keep unsupported claims out of the document.`;

const RESUME_VERIFY_V1 = `Fact-check resume claims against the candidate profile and Fact Ledger.
Return strict JSON {ok: boolean, unsupported: string[], notes: string[]}.
Rules:
- Mark any claim not supported by the profile or ledger as unsupported.
- Do not invent replacements.`;

const JOB_CATEGORIZE_V1 = `Return JSON {"category","role"}. category must be one of: Product, Design, Data, Marketing, Engineering, Sales, Operations. Do not invent a company.`;

const JOB_REQUIREMENTS_V1 = `Extract structured job requirements from the listing.
Return strict JSON:
{"mandatory": string[], "preferred": string[], "education": string, "years": number|null, "management": boolean}
Rules:
- mandatory = required skills/tools clearly demanded
- preferred = nice-to-have skills
- education is a short phrase or empty string
- years is minimum years of experience or null
- Copy skills from the listing. Never invent tools that are not mentioned.`;

const JOB_VERIFY_V1 = `Return JSON {"verification","note"}. verification must be one of: Active, Possible duplicate, Needs review, Third-party recruiter, Listing may be expired, Review recommended.`;

const JOB_PRIMARY_V1 = `Return JSON {"primaryCompany","primaryUrl","primaryEmail"}. Copy each value from the listing. If the listed company is the employer, primaryCompany is that company. Never invent a company, URL, or email.`;

const JOB_MATCH_V1 = `Explain how this job fits the career profile.
Return strict JSON {score: number, label: string, reasons: string[], missing: string[]}.
Rules:
- score is 0 to 100.
- label is one of: strong, possible, weak, not recommended.
- reasons must cite profile facts only.
- missing lists required skills absent from the profile.
- Never invent skills or experience.`;

const IMAGE_ENHANCE_V1 = `Return JSON {contrast, color, sharpness} as numbers from 1 to 1.35. These tune the existing photo. Do not describe a different person.`;

const RESUME_OCR_V1 = `You read a resume image with OCR.
Return strict JSON {"text": string}.
Rules:
- text is the full readable resume content in reading order (top to bottom, left to right).
- Preserve line breaks between sections, jobs, and bullets.
- Copy only text visible in the image. Never invent employers, dates, skills, numbers, or contact details.
- If a word is illegible, omit it rather than guessing.
- If the image is not a resume or has no readable text, return {"text":""}.`;

export const prompts = {
  CAREER_EXTRACTION_V1: EXTRACTION_V1,
  CAREER_REVIEW_V1: REVIEW_V1,
  RESUME_OCR_V1,
};

/** Default system prompt body keyed by AI_FUNCTIONS.key */
export const DEFAULT_PROMPTS = {
  career_extraction: EXTRACTION_V1,
  career_review: REVIEW_V1,
  resume_diagnostic: RESUME_DIAGNOSTIC_V1,
  resume_upscale: RESUME_UPSCALE_V1,
  resume_verify: RESUME_VERIFY_V1,
  job_categorize: JOB_CATEGORIZE_V1,
  job_requirements: JOB_REQUIREMENTS_V1,
  job_verify: JOB_VERIFY_V1,
  job_primary: JOB_PRIMARY_V1,
  job_match: JOB_MATCH_V1,
  image_enhance: IMAGE_ENHANCE_V1,
  resume_ocr: RESUME_OCR_V1,
};

export function routing() {
  return {
    career_profile_extraction: {
      primary: process.env.AI_EXTRACT_PROVIDER || "deterministic",
      review: process.env.AI_REVIEW_PROVIDER || "deterministic",
    },
  };
}
