/** Application tracker statuses and autopilot eligibility rules. */

export const TRACKER_STATUSES = [
  "Found",
  "Reviewed",
  "Skipped",
  "Resume preparing",
  "Ready",
  "Review required",
  "Applied",
  "Responded",
  "Interview",
  "Offer",
  "Rejected",
  "Withdrawn",
];

export const PRE_APPLY_STATUSES = new Set(["Found", "Reviewed", "Skipped", "Resume preparing", "Ready", "Review required"]);
export const SUBMITTED_STATUSES = new Set(["Applied", "Responded", "Interview", "Offer", "Rejected", "Withdrawn"]);

function lower(value) {
  return String(value || "").toLowerCase();
}

function listFrom(value) {
  return String(value || "")
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function startOfUtcDay(now = Date.now()) {
  const date = new Date(now);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Decide what autopilot may do with a matched job.
 * Never returns "apply" — only ready (user/auto queue) or review required.
 * @returns {{ action: "skip" | "ready" | "review", reason: string }}
 */
export function autoDecision(job, match, preferences = {}, user = {}) {
  const minMatch = Math.max(50, Math.min(99, Number(user.auto_min ?? user.autoMin ?? 85) || 85));
  const score = Number(match?.score || 0);
  if (score < minMatch) {
    return { action: "skip", reason: `Match ${score}% is below your ${minMatch}% bar.` };
  }

  const company = lower(job.primary_company || job.company);
  const poster = lower(job.company);
  for (const excluded of listFrom(preferences.excludeCompanies)) {
    if (company.includes(lower(excluded)) || poster.includes(lower(excluded))) {
      return { action: "skip", reason: `Excluded company “${excluded}”.` };
    }
  }

  const blob = lower(`${job.title || ""} ${job.description || ""} ${job.company || ""}`);
  for (const keyword of listFrom(preferences.excludeKeywords)) {
    if (blob.includes(lower(keyword))) {
      return { action: "skip", reason: `Excluded keyword “${keyword}”.` };
    }
  }

  const places = lower(preferences.locations || "");
  if (places) {
    const location = lower(job.location || "");
    const remote = lower(job.remote_type || job.remoteType || "") === "remote";
    const remoteOk = lower(preferences.workArrangement || "").includes("remote") || places.includes("remote");
    const placeHit = places.split(/[,/]/).some((place) => place.trim() && location.includes(place.trim()));
    if (!placeHit && !(remote && remoteOk)) {
      return { action: "skip", reason: "Location does not match your preferences." };
    }
  }

  const wantedSalary = Number(String(preferences.salary || "").replace(/[^0-9]/g, ""));
  if (wantedSalary) {
    const max = Number(job.salary_max || job.salaryMax || 0);
    const min = Number(job.salary_min || job.salaryMin || 0);
    if (max && wantedSalary > max * 1.15) {
      return { action: "skip", reason: "Listed pay is below your target salary." };
    }
    if (!max && min && wantedSalary > min * 1.25) {
      return { action: "skip", reason: "Listed pay is below your target salary." };
    }
  }

  const verification = String(job.verification || "");
  if (verification === "Needs review" || verification === "Possible duplicate") {
    return { action: "review", reason: `Listing marked “${verification}”.` };
  }

  if (verification === "Third-party recruiter") {
    const primary = String(job.primary_company || "");
    if (!primary || primary.toLowerCase() === String(job.company || "").toLowerCase()) {
      return { action: "review", reason: "Recruiter listing without a clear employer." };
    }
    return { action: "review", reason: "Recruiter listing needs a quick check before submit." };
  }

  if (verification && verification !== "Active") {
    return { action: "review", reason: `Listing verification is “${verification}”.` };
  }

  if ((match.missing || []).length) {
    return { action: "review", reason: `Missing required skills: ${match.missing.slice(0, 3).join(", ")}.` };
  }

  const label = match.label || "";
  if (label === "weak" || label === "not recommended") {
    return { action: "skip", reason: `Match labeled “${label}”.` };
  }
  if (label === "possible") {
    return { action: "review", reason: "Possible match — review before submitting." };
  }

  if (score < 85 && label !== "strong") {
    return { action: "review", reason: "Score is under the autopilot submit bar; left ready for review." };
  }

  return { action: "ready", reason: "Cleared match, location, pay, and verification checks." };
}
