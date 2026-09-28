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
Return strict JSON with keys: status ("pass" or "fail"), unsupported (string array of field names or short claim labels that are not clearly supported), notes (string array of short clarification questions).
Rules:
- Mark any invented employer, date, skill, metric, or contact detail as unsupported.
- Do not rewrite the profile. Only report problems.
- If everything is supported, status is "pass" and unsupported is [].`;

export const prompts = {
  CAREER_EXTRACTION_V1: EXTRACTION_V1,
  CAREER_REVIEW_V1: REVIEW_V1,
};

export function routing() {
  return {
    career_profile_extraction: {
      primary: process.env.AI_EXTRACT_PROVIDER || "deterministic",
      review: process.env.AI_REVIEW_PROVIDER || "deterministic",
    },
  };
}
