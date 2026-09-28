/** Shared job listing schema + authenticity / duplicate signals. */

const VERIFICATIONS = [
  "Active",
  "Possible duplicate",
  "Needs review",
  "Third-party recruiter",
  "Listing may be expired",
  "Review recommended",
];

function text(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function money(value) {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function skillsList(value) {
  if (Array.isArray(value)) return value.map((item) => text(item)).filter(Boolean).slice(0, 24);
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return skillsList(parsed);
    } catch {
      return value
        .split(/[,•|;]/)
        .map((item) => text(item))
        .filter(Boolean)
        .slice(0, 24);
    }
  }
  return [];
}

/**
 * Normalize any feed / paste / catalog row into the shared job schema.
 */
export function normalizeJobListing(raw = {}, fallback = {}) {
  const title = text(raw.title || raw.position || raw.name || fallback.title);
  const company = text(raw.company || raw.company_name || raw.organization || fallback.company || fallback.employer);
  const employer = text(raw.employer || raw.hiring_company || raw.hiringCompany || raw.primaryCompany || "");
  const sourceUrl = text(raw.sourceUrl || raw.source_url || raw.url || raw.link || raw.applyUrl || raw.apply_url || "");
  const applyUrl = text(raw.applyUrl || raw.apply_url || raw.application_url || sourceUrl);
  const description = text(raw.description || raw.job_description || raw.summary || raw.content || "");
  const location = text(raw.location || raw.location_name || "");
  const remoteType = text(raw.remoteType || raw.remote_type || raw.workplaceType || "").toLowerCase();
  const skills = skillsList(raw.skills);
  const requirements =
    raw.requirements && typeof raw.requirements === "object"
      ? raw.requirements
      : {
          mandatory: Array.isArray(raw.mandatory) ? raw.mandatory.map(String) : [],
          preferred: Array.isArray(raw.preferred) ? raw.preferred.map(String) : [],
          education: text(raw.education || raw.minimum_education || ""),
          years: raw.experience_years == null ? null : Number(raw.experience_years),
        };
  return {
    job_id: text(raw.job_id || raw.id || raw.externalKey || ""),
    externalKey: text(raw.externalKey || raw.id || `${company}-${title}`).slice(0, 180),
    company,
    employer,
    title,
    location,
    remote_type: remoteType,
    employment_type: text(raw.employment_type || raw.employmentType || "full-time") || "full-time",
    salary_min: money(raw.salaryMin ?? raw.salary_min),
    salary_max: money(raw.salaryMax ?? raw.salary_max),
    job_description: description,
    description,
    requirements: {
      mandatory: Array.isArray(requirements.mandatory) ? requirements.mandatory.map(String) : [],
      preferred: Array.isArray(requirements.preferred) ? requirements.preferred.map(String) : [],
      education: text(requirements.education || ""),
      years: requirements.years == null || requirements.years === "" ? null : Number(requirements.years),
    },
    preferred_requirements: Array.isArray(requirements.preferred) ? requirements.preferred.map(String) : [],
    skills,
    education: Array.isArray(raw.education) ? raw.education.map(String) : [],
    experience_years: requirements.years == null ? null : Number(requirements.years),
    work_authorization: text(raw.work_authorization || raw.workAuthorization || ""),
    source_url: sourceUrl,
    apply_url: applyUrl,
    source_type: text(raw.source_type || raw.sourceType || fallback.source_type || ""),
    date_detected: text(raw.date_detected || raw.dateDetected || "") || new Date().toISOString().slice(0, 10),
    date_verified: text(raw.date_verified || raw.dateVerified || ""),
    category: text(raw.category || ""),
    role: text(raw.role || title),
    primaryCompany: employer || company,
    primaryUrl: applyUrl || sourceUrl,
    primaryEmail: text(raw.primaryEmail || raw.primary_email || ""),
  };
}

export function jobFingerprint(job) {
  const company = text(job.company || job.primaryCompany).toLowerCase();
  const title = text(job.title).toLowerCase();
  const location = text(job.location).toLowerCase();
  return `${company}|${title}|${location}`;
}

export function findDuplicateJobs(job, siblings = []) {
  const selfKey = jobFingerprint(job);
  const url = text(job.source_url || job.sourceUrl || job.apply_url || job.applyUrl).toLowerCase();
  const hits = [];
  for (const other of siblings) {
    if (job.id && other.id && String(job.id) === String(other.id)) continue;
    const otherKey = jobFingerprint(other);
    const otherUrl = text(other.source_url || other.sourceUrl || "").toLowerCase();
    if (selfKey && selfKey === otherKey) {
      hits.push({ id: other.id || null, reason: "Same company, title, and location" });
      continue;
    }
    if (url && otherUrl && url === otherUrl) {
      hits.push({ id: other.id || null, reason: "Same source URL" });
    }
  }
  return hits;
}

/**
 * Deterministic authenticity / quality signals for a listing.
 */
export function authenticitySignals(job, siblings = []) {
  const flags = [];
  const blob = `${job.title || ""}\n${job.company || ""}\n${job.description || job.job_description || ""}\n${job.source_url || ""}`.toLowerCase();
  const duplicates = findDuplicateJobs(job, siblings);
  if (!text(job.title) || !text(job.company)) {
    flags.push({ code: "missing_identity", label: "Needs review", note: "Missing a title or company." });
  }
  if (/staffing|recruit|talent solutions|workforce/i.test(String(job.company || ""))) {
    flags.push({ code: "third_party", label: "Third-party recruiter", note: "Company name looks like a staffing firm." });
  }
  if (duplicates.length) {
    flags.push({
      code: "duplicate",
      label: "Possible duplicate",
      note: duplicates[0].reason || "Another listing looks the same.",
    });
  }
  if (/no longer (accepting|available)|position (has been )?filled|job has expired|listing expired|this requisition is closed/i.test(blob)) {
    flags.push({ code: "expired", label: "Listing may be expired", note: "The description suggests the listing may be closed." });
  }
  if (/send (your )?(ssn|social security|bank details|western union)|pay (a )?fee to apply|crypto(currency)? payment/i.test(blob)) {
    flags.push({ code: "suspicious", label: "Review recommended", note: "Suspicious payment or identity language was found." });
  }
  const max = Number(job.salary_max || job.salaryMax || 0);
  const min = Number(job.salary_min || job.salaryMin || 0);
  if ((max && max > 400000) || (min && min > 350000)) {
    flags.push({ code: "salary", label: "Needs review", note: "Salary is unusually high." });
  }
  if ((max && max > 0 && max < 15000) || (min && min > 0 && min < 10000)) {
    flags.push({ code: "salary_low", label: "Needs review", note: "Salary looks unusually low for a full-time role." });
  }
  const host = (() => {
    try {
      return new URL(String(job.source_url || job.apply_url || "")).hostname.toLowerCase();
    } catch {
      return "";
    }
  })();
  if (host && /\.ru$|\.tk$|bit\.ly|tinyurl\.com|forms\.gle/i.test(host)) {
    flags.push({ code: "domain", label: "Review recommended", note: "Source domain looks unusual for a careers page." });
  }

  const priority = [
    "Review recommended",
    "Listing may be expired",
    "Possible duplicate",
    "Third-party recruiter",
    "Needs review",
    "Active",
  ];
  let verification = "Active";
  let note = "Passed the listing checks.";
  if (flags.length) {
    flags.sort((a, b) => priority.indexOf(a.label) - priority.indexOf(b.label));
    verification = flags[0].label;
    note = flags.map((item) => item.note).filter(Boolean).join(" ");
  } else if (text(job.source_url) || text(job.apply_url)) {
    note = "Source URL present; listing passed local authenticity checks.";
  }
  return {
    verification: VERIFICATIONS.includes(verification) ? verification : "Needs review",
    note,
    flags,
    duplicates,
  };
}

export const JOB_VERIFICATIONS = VERIFICATIONS;
