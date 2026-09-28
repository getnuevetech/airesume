/** Application readiness engine — deterministic gates before submit. */

const SENSITIVE_KINDS = new Set(["salary", "sponsorship", "authorization", "disability", "veteran", "race", "gender", "criminal"]);

function pct(part, total) {
  if (!total) return 100;
  return Math.round((part / total) * 100);
}

/**
 * Compute readiness for an application package.
 * @returns {{
 *   state: 'APPLICATION_READY' | 'USER_ACTION_REQUIRED',
 *   matchScore: number,
 *   resumeAlignment: number,
 *   questionsComplete: number,
 *   documentsComplete: number,
 *   blockers: string[],
 *   checks: object
 * }}
 */
export function computeApplicationReadiness({
  match = {},
  application = {},
  version = null,
  preferences = {},
  verification = "",
} = {}) {
  const blockers = [];
  const score = Math.max(0, Math.min(100, Number(match.score || application.match_score || 0)));
  const missingSkills = Array.isArray(match.missing) ? match.missing : [];
  const mandatoryTotal = (match.requirements?.mandatory || []).length || missingSkills.length + (match.matched || []).length;
  const matchedCount = Array.isArray(match.matched) ? match.matched.length : Math.max(0, mandatoryTotal - missingSkills.length);
  const resumeAlignment = mandatoryTotal ? pct(matchedCount, mandatoryTotal) : score >= 70 ? 90 : 70;

  const questions = Array.isArray(application.questions) ? application.questions : [];
  const blank = questions.filter((item) => !String(item.answer || "").trim());
  const sensitiveBlank = blank.filter((item) => {
    const id = String(item.id || "");
    const reason = String(item.blankReason || item.kind || "");
    return SENSITIVE_KINDS.has(id) || /sensitive|user/i.test(reason) || item.kind === "user";
  });
  const questionsComplete = questions.length ? pct(questions.length - blank.length, questions.length) : 100;

  const hasResume = Boolean(version?.rendered || version?.document);
  const documentsComplete = hasResume ? 100 : 0;

  if (score < 55) blockers.push("Match score is below the possible-fit threshold.");
  if (missingSkills.length >= 3) blockers.push(`Still missing required skills: ${missingSkills.slice(0, 3).join(", ")}.`);
  if (!hasResume) blockers.push("A tailored resume version is required before submit.");
  if (sensitiveBlank.length) {
    blockers.push(`${sensitiveBlank.length} sensitive question${sensitiveBlank.length === 1 ? "" : "s"} need your answer.`);
  } else if (blank.length) {
    blockers.push(`${blank.length} application answer${blank.length === 1 ? "" : "s"} still blank.`);
  }
  if (!String(preferences.workAuthorization || "").trim()) {
    blockers.push("Confirm work authorization in your preferences before submit.");
  }
  if (/expired|review recommended|needs review/i.test(String(verification || ""))) {
    blockers.push(`Listing quality flag: ${verification}.`);
  }

  const state = blockers.length ? "USER_ACTION_REQUIRED" : "APPLICATION_READY";
  return {
    state,
    matchScore: score,
    resumeAlignment,
    questionsComplete,
    documentsComplete,
    blockers,
    checks: {
      matchOk: score >= 55,
      resumeOk: hasResume,
      questionsOk: blank.length === 0,
      preferencesOk: Boolean(String(preferences.workAuthorization || "").trim()),
      listingOk: !/expired|review recommended/i.test(String(verification || "")),
    },
  };
}
