/** Employer hiring pipeline helpers for shortlisted public candidates. */

export const PIPELINE_STATUSES = [
  "Saved",
  "Reviewing",
  "Interviewing",
  "Offer",
  "Hired",
  "Passed",
];

const STATUS_RANK = Object.fromEntries(PIPELINE_STATUSES.map((status, index) => [status, index]));

export function normalizePipelineStatus(value, fallback = "Saved") {
  const raw = String(value || "").trim();
  if (PIPELINE_STATUSES.includes(raw)) return raw;
  const match = PIPELINE_STATUSES.find((status) => status.toLowerCase() === raw.toLowerCase());
  return match || fallback;
}

export function canTransition(from, to) {
  const current = normalizePipelineStatus(from);
  const next = normalizePipelineStatus(to);
  if (current === next) return true;
  if (next === "Passed" || next === "Hired") return true;
  if (current === "Passed" || current === "Hired") return next === "Reviewing" || next === "Saved";
  return STATUS_RANK[next] >= STATUS_RANK[current] - 1;
}

/**
 * Summarize pipeline rows for the employer dashboard.
 */
export function summarizePipeline(rows = []) {
  const counts = Object.fromEntries(PIPELINE_STATUSES.map((status) => [status, 0]));
  for (const row of rows) {
    const status = normalizePipelineStatus(row.status);
    counts[status] += 1;
  }
  return {
    total: rows.length,
    counts,
    active: rows.filter((row) => !["Hired", "Passed"].includes(normalizePipelineStatus(row.status))).length,
  };
}

/**
 * Sort pipeline entries: active stages first, then recently updated.
 */
export function sortPipeline(rows = []) {
  return [...rows].sort((a, b) => {
    const aDone = ["Hired", "Passed"].includes(normalizePipelineStatus(a.status)) ? 1 : 0;
    const bDone = ["Hired", "Passed"].includes(normalizePipelineStatus(b.status)) ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    const rankDiff = (STATUS_RANK[normalizePipelineStatus(b.status)] || 0) - (STATUS_RANK[normalizePipelineStatus(a.status)] || 0);
    if (rankDiff) return rankDiff;
    return Number(b.updatedAt || b.updated_at || 0) - Number(a.updatedAt || a.updated_at || 0);
  });
}

/**
 * Build a public pipeline card from a DB join row. Contact follows candidate share settings.
 */
export function publicPipelineEntry(row) {
  if (!row) return null;
  let preferences = {};
  try {
    preferences = JSON.parse(row.preferences || "{}");
  } catch {
    preferences = {};
  }
  let skills = [];
  try {
    skills = JSON.parse(row.skills || "[]");
  } catch {
    skills = [];
  }
  const shareContact = preferences.shareContact !== false;
  return {
    id: row.id,
    candidateUserId: row.candidate_user_id,
    status: normalizePipelineStatus(row.status),
    roleTitle: row.role_title || "",
    notes: row.notes || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    candidate: {
      userId: row.candidate_user_id,
      name: row.name || "",
      headline: row.headline || "",
      summary: String(row.summary || "").slice(0, 280),
      skills: (Array.isArray(skills) ? skills : []).map(String).slice(0, 12),
      city: row.city || "",
      photoUrl: row.photo_url || "",
      slug: row.slug || "",
      resumeUrl: row.slug ? `/resume/${row.slug}` : "",
      email: shareContact ? String(row.email || "") : "",
      phone: shareContact ? String(row.phone || "") : "",
    },
  };
}
