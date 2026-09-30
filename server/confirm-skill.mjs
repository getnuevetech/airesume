/** Confirm one missing job skill into the Fact Ledger and the active resume. */

import { applyClarificationAnswer } from "./upscale-clarify.mjs";
import { matchJob } from "./match.mjs";
import { tailoredDocument } from "./resume-guard.mjs";

function sameSkill(left, right) {
  return String(left || "").trim().toLowerCase() === String(right || "").trim().toLowerCase();
}

/**
 * Store a skill only when it is one of this listing's gaps.
 * The saved name is the listing's spelling. A second confirm does not add another fact.
 */
export function confirmListedSkill({ profile = {}, facts = [], document = {}, missing = [], skill = "" } = {}) {
  const requested = String(skill || "").replace(/\s+/g, " ").trim();
  if (!requested) throw new Error("Choose a skill from this listing.");
  const canonical = (Array.isArray(missing) ? missing : []).find((item) => sameSkill(item, requested));
  if (!canonical) throw new Error("That skill is not a gap on this listing.");
  const name = String(canonical).replace(/\s+/g, " ").trim();
  const profileSkills = Array.isArray(profile.skills) ? profile.skills : [];
  const documentSkills = Array.isArray(document.skills) ? document.skills : [];
  const onProfile = profileSkills.some((item) => sameSkill(item, name));
  const onDocument = documentSkills.some((item) => sameSkill(item, name));
  if (onProfile && onDocument) {
    return {
      already: true,
      skill: name,
      facts: Array.isArray(facts) ? facts : [],
      profile,
      document,
    };
  }

  const applied = applyClarificationAnswer({
    profile,
    facts,
    recommendation: { clarifyType: "skill" },
    answer: name,
  });
  const nextSkills = documentSkills.slice();
  if (!nextSkills.some((item) => sameSkill(item, name))) nextSkills.push(name);
  return {
    already: false,
    skill: name,
    facts: applied.facts,
    profile: applied.profile,
    document: { ...document, skills: nextSkills },
    fact: applied.fact,
  };
}

/**
 * Rebuild the resume already prepared for this job from the resume that now includes the confirmed skill.
 * Only reorders skills, roles, and bullets that are already on that resume.
 */
export function preparedResumeAfterConfirm({ document = {}, job = {}, facts = [], preferences = {} } = {}) {
  const match = matchJob(document, preferences, job, { facts });
  return tailoredDocument(document, job, match, facts);
}

/**
 * Rebuild every resume already prepared for this candidate.
 * Each copy is ordered for its own job and only uses skills already on the updated resume.
 */
/**
 * Accept a skill only when career insights already lists it as a gap.
 * Listing labels such as "Title:" are not gaps the candidate can confirm.
 */
export function confirmInsightGap({ gaps = [], skill = "" } = {}) {
  const requested = String(skill || "").replace(/\s+/g, " ").trim();
  if (!requested) throw new Error("Choose a skill from your insights.");
  const names = (Array.isArray(gaps) ? gaps : [])
    .map((item) => String(item?.skill || item || "").replace(/\s+/g, " ").trim())
    .filter((name) => name && !/^(title|role|position|job title|company|employer|organization|org|location|based in|office)\s*:/i.test(name));
  const canonical = names.find((name) => name.toLowerCase() === requested.toLowerCase());
  if (!canonical) throw new Error("That skill is not a gap in your insights.");
  return canonical;
}

export function confirmedSkillMessage({ already = false, skill = "", prepared = 0, preparedThisJob = false } = {}) {
  if (already) return `${skill} is already on your resume.`;
  if (prepared > 1 || (prepared === 1 && !preparedThisJob)) {
    return `${skill} is saved to your Fact Ledger and the resumes prepared for your jobs.`;
  }
  if (prepared === 1) return `${skill} is saved to your Fact Ledger and the resume prepared for this job.`;
  return `${skill} is saved to your Fact Ledger and resume.`;
}

export function preparedResumesAfterConfirm({ document = {}, jobs = [], facts = [], preferences = {} } = {}) {
  return (Array.isArray(jobs) ? jobs : []).filter(Boolean).map((job) => ({
    jobId: String(job.id || ""),
    document: preparedResumeAfterConfirm({ document, job, facts, preferences }),
  }));
}
