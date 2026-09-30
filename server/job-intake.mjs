/** Decide whether a feed row or a pasted page is a real job before it is stored. */

import { db, id } from "./db.mjs";
import { completeJson } from "./ai-run.mjs";

const JOB_INTAKE_PROMPT = `You review a listing before it is stored for applicants. Return strict JSON {"useful":true|false,"reason":""}.
Set useful to false when the text is a login wall, cookie banner, language picker, homepage, search results page, or any page that is not one specific open role.
Set useful to true only when a candidate could prepare an application from this text.
Do not invent a role, employer, or requirement that is not in the text.`;

const LOGIN_PATTERN = /sign in|log in|forgot password|cookie policy|user agreement|privacy policy|passkey|one-time link|keep me logged in|join linkedin|sign in with apple/gi;
const STRONG_DUTY_PATTERN = /responsibilit|requirement|qualificat|what you.?ll|we are hiring|about the role|aufgaben|anforderungen|you will|you'll|we're looking|we are looking/gi;
const LANGUAGE_PATTERN = /arabic|español|spanish|français|french|deutsch|german|português|portuguese|中文|chinese|日本語|japanese|हिंदी|hindi/gi;
const INDEX_TITLE = /^(current openings|open positions|open roles|job search|search results|careers|jobs)$/i;
const SEARCH_TITLE = /\b\d[\d,.]*\+?\s+\S.{0,80}\bjobs\b/i;

function count(pattern, text) {
  return (String(text || "").match(pattern) || []).length;
}

export function localJobUsefulness(draft = {}) {
  const title = String(draft.title || "").trim();
  const description = String(draft.description || "").trim();
  const blob = `${title}\n${description}`;
  const reasons = [];
  const loginHits = count(LOGIN_PATTERN, blob);
  const dutyHits = count(STRONG_DUTY_PATTERN, blob);
  const languageHits = count(LANGUAGE_PATTERN, blob);
  if (!title) reasons.push("The listing has no job title.");
  if (/login|sign in/i.test(title) && dutyHits === 0) {
    reasons.push("The title is a sign-in page, not a job.");
  }
  if (loginHits >= 2 && dutyHits === 0) {
    reasons.push("The text is a login or legal page, not a job description.");
  }
  if (languageHits >= 4 && dutyHits === 0) {
    reasons.push("The text is a language menu, not a job description.");
  }
  if ((INDEX_TITLE.test(title) || SEARCH_TITLE.test(title)) && dutyHits === 0) {
    reasons.push("The page is a list of openings, not one job.");
  }
  if (!description && dutyHits === 0 && reasons.length === 0) {
    reasons.push("There is no job description to show an applicant.");
  }
  const unique = [];
  for (const reason of reasons) {
    if (!unique.includes(reason)) unique.push(reason);
  }
  return { useful: unique.length === 0, reasons: unique };
}

/** Local rules block junk even when a model calls the page useful. A model can still hold a page the rules allowed. */
export function decideIntake(local, aiJson) {
  const reasons = [...(local?.reasons || [])];
  if (aiJson && aiJson.useful === false) {
    const reason = String(aiJson.reason || "This is not a useful job listing.").trim();
    if (reason && !reasons.includes(reason)) reasons.push(reason);
    return { useful: false, reasons };
  }
  return { useful: Boolean(local?.useful) && reasons.length === 0, reasons };
}

export async function reviewJobIntake(draft = {}) {
  const local = localJobUsefulness(draft);
  const ai = await completeJson(
    "job_intake",
    JOB_INTAKE_PROMPT,
    JSON.stringify({
      title: draft.title || "",
      company: draft.company || "",
      location: draft.location || "",
      url: draft.sourceUrl || draft.source_url || "",
      description: String(draft.description || "").slice(0, 4000),
    }).slice(0, 6000),
  );
  const decision = decideIntake(local, ai.json);
  return {
    ...decision,
    provider: ai.provider,
    model: ai.model,
    kind: ai.kind,
  };
}

export function holdJobDraft({ sourceId = "", userId = "", origin = "paste", draft = {}, reason = "", provider = "", model = "" }) {
  const title = String(draft.title || "").slice(0, 160);
  const sourceUrl = String(draft.sourceUrl || draft.source_url || "").slice(0, 500);
  const company = String(draft.company || "").slice(0, 120);
  const existing = db
    .prepare(
      "SELECT id, reason FROM job_intake_holds WHERE status = 'pending' AND title = ? AND company = ? AND source_url = ? AND origin = ?",
    )
    .get(title, company, sourceUrl, origin);
  if (existing) return { id: existing.id, reason: existing.reason || reason, duplicate: true };
  const holdId = id("hold");
  db.prepare(
    `INSERT INTO job_intake_holds (
      id, source_id, user_id, origin, title, company, location, description, source_url, payload, reason, status, provider, model, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
  ).run(
    holdId,
    String(sourceId || ""),
    String(userId || ""),
    String(origin || "paste").slice(0, 40),
    title,
    company,
    String(draft.location || "").slice(0, 120),
    String(draft.description || "").slice(0, 12000),
    sourceUrl,
    JSON.stringify(draft).slice(0, 20000),
    String(reason || "This is not a useful job listing.").slice(0, 500),
    String(provider || "").slice(0, 80),
    String(model || "").slice(0, 80),
    Date.now(),
  );
  return { id: holdId, reason, duplicate: false };
}

export const JOB_INTAKE_PROMPT_TEXT = JOB_INTAKE_PROMPT;
