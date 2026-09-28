/** Employer job postings and outbound invite helpers. */

export const POSTING_STATUSES = ["draft", "open", "closed"];
export const INVITE_STATUSES = ["pending", "viewed", "accepted", "declined"];

function lower(value) {
  return String(value || "").toLowerCase();
}

function unique(items = []) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = lower(item).trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(String(item).trim());
  }
  return out;
}

function parseJson(value, fallback) {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function normalizePostingStatus(value, fallback = "draft") {
  const raw = lower(value).trim();
  return POSTING_STATUSES.includes(raw) ? raw : fallback;
}

export function normalizeInviteStatus(value, fallback = "pending") {
  const raw = lower(value).trim();
  return INVITE_STATUSES.includes(raw) ? raw : fallback;
}

export function canChangePostingStatus(from, to) {
  const current = normalizePostingStatus(from);
  const next = normalizePostingStatus(to);
  if (current === next) return true;
  if (current === "draft" && (next === "open" || next === "closed")) return true;
  if (current === "open" && (next === "closed" || next === "draft")) return true;
  if (current === "closed" && (next === "open" || next === "draft")) return true;
  return false;
}

export function canChangeInviteStatus(from, to) {
  const current = normalizeInviteStatus(from);
  const next = normalizeInviteStatus(to);
  if (current === next) return true;
  if (current === "pending" && ["viewed", "accepted", "declined"].includes(next)) return true;
  if (current === "viewed" && ["accepted", "declined"].includes(next)) return true;
  return false;
}

/**
 * Normalize posting input from an employer form.
 */
export function normalizePostingInput(body = {}, companyFallback = "") {
  const title = String(body.title || "").trim().slice(0, 160);
  const company = String(body.company || companyFallback || "").trim().slice(0, 160);
  const skills = unique(
    Array.isArray(body.skills)
      ? body.skills
      : String(body.skills || "")
          .split(",")
          .map((skill) => skill.trim()),
  ).slice(0, 24);
  const salaryMin = Number(body.salaryMin);
  const salaryMax = Number(body.salaryMax);
  return {
    title,
    company,
    location: String(body.location || "").trim().slice(0, 120),
    remoteType: String(body.remoteType || "").trim().slice(0, 40),
    employmentType: String(body.employmentType || "full-time").trim().slice(0, 40) || "full-time",
    salaryMin: Number.isFinite(salaryMin) && salaryMin > 0 ? Math.round(salaryMin) : null,
    salaryMax: Number.isFinite(salaryMax) && salaryMax > 0 ? Math.round(salaryMax) : null,
    description: String(body.description || "").trim().slice(0, 8000),
    skills,
    category: String(body.category || "").trim().slice(0, 80),
    role: String(body.role || title).trim().slice(0, 120),
    applyUrl: String(body.applyUrl || "").trim().slice(0, 500),
    status: normalizePostingStatus(body.status, "draft"),
  };
}

export function validatePosting(input) {
  if (!input.title || input.title.length < 2) return "Title is required.";
  if (!input.company || input.company.length < 2) return "Company is required.";
  if (input.status === "open" && input.description.length < 20) {
    return "Open postings need a short description (20+ characters).";
  }
  return "";
}

/**
 * Rank how well a public candidate overlaps a posting's skills.
 * Uses only listed skills — never invents matches.
 */
export function scoreCandidateForPosting(candidate = {}, posting = {}) {
  const needed = unique(posting.skills || []);
  const have = unique(candidate.skills || []);
  if (!needed.length) {
    return { score: have.length ? 40 : 10, matched: [], missing: [] };
  }
  const matched = needed.filter((skill) =>
    have.some((item) => lower(item).includes(lower(skill)) || lower(skill).includes(lower(item))),
  );
  const missing = needed.filter((skill) => !matched.includes(skill));
  const score = Math.round((matched.length / needed.length) * 100);
  return { score, matched, missing };
}

export function summarizePostings(rows = []) {
  const counts = Object.fromEntries(POSTING_STATUSES.map((status) => [status, 0]));
  for (const row of rows) {
    counts[normalizePostingStatus(row.status)] += 1;
  }
  return { total: rows.length, counts, open: counts.open || 0 };
}

export function summarizeInvites(rows = []) {
  const counts = Object.fromEntries(INVITE_STATUSES.map((status) => [status, 0]));
  for (const row of rows) {
    counts[normalizeInviteStatus(row.status)] += 1;
  }
  return {
    total: rows.length,
    counts,
    open: (counts.pending || 0) + (counts.viewed || 0),
  };
}

export function publicPosting(row) {
  if (!row) return null;
  return {
    id: row.id,
    employerUserId: row.employer_user_id,
    title: row.title,
    company: row.company,
    location: row.location || "",
    remoteType: row.remote_type || "",
    employmentType: row.employment_type || "full-time",
    salaryMin: row.salary_min,
    salaryMax: row.salary_max,
    description: row.description || "",
    skills: parseJson(row.skills, []),
    requirements: parseJson(row.requirements, {}),
    category: row.category || "",
    role: row.role || "",
    applyUrl: row.apply_url || "",
    status: normalizePostingStatus(row.status),
    jobId: row.job_id || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function inviteMessageDefault({ posting, employerName = "" } = {}) {
  const role = posting?.title || "a role";
  const company = posting?.company || "our team";
  const who = employerName ? `${employerName} at ${company}` : company;
  return `${who} invited you to consider ${role}. Review the posting and respond when you are ready.`;
}
