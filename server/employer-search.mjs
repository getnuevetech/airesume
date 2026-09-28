/** Search public candidate profiles for employer accounts. */

function lower(value) {
  return String(value || "").toLowerCase();
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

function hasPublicProfile(featuresRaw) {
  const features = parseJson(featuresRaw, {});
  return features.public_profile !== false;
}

function skillHit(skills, needle) {
  const target = lower(needle);
  if (!target) return true;
  return skills.some((skill) => lower(skill).includes(target) || target.includes(lower(skill)));
}

/**
 * Rank public candidates for an employer query.
 * Only includes active users with a public slug and public_profile enabled.
 */
export function searchCandidates(rows = [], query = {}) {
  const q = lower(query.q || "").trim();
  const skill = lower(query.skill || "").trim();
  const city = lower(query.city || "").trim();
  const limit = Math.max(1, Math.min(50, Number(query.limit) || 20));

  const scored = [];
  for (const row of rows) {
    if (!row.slug || row.status !== "active") continue;
    if (!hasPublicProfile(row.plan_features)) continue;
    const skills = parseJson(row.skills, []).map(String);
    const headline = String(row.headline || "");
    const summary = String(row.summary || "");
    const name = String(row.name || "");
    const blob = lower([name, headline, summary, skills.join(" "), row.city || ""].join(" "));
    if (skill && !skillHit(skills, skill)) continue;
    if (city && !lower(row.city || "").includes(city)) continue;
    if (q) {
      const tokens = q.split(/\s+/).filter(Boolean);
      if (!tokens.every((token) => blob.includes(token))) continue;
    }
    let score = 10;
    if (skill) score += skills.filter((item) => skillHit([item], skill)).length * 8;
    if (q) {
      for (const token of q.split(/\s+/).filter(Boolean)) {
        if (lower(headline).includes(token)) score += 6;
        if (skills.some((item) => lower(item).includes(token))) score += 4;
        if (lower(name).includes(token)) score += 3;
      }
    }
    if (row.photo_url) score += 1;
    const preferences = parseJson(row.preferences, {});
    scored.push({
      score,
      candidate: {
        userId: row.user_id,
        name,
        headline,
        summary: summary.slice(0, 280),
        skills: skills.slice(0, 12),
        city: String(row.city || ""),
        photoUrl: String(row.photo_url || ""),
        slug: row.slug,
        resumeUrl: `/resume/${row.slug}`,
        email: preferences.shareContact === false ? "" : String(row.email || ""),
        phone: preferences.shareContact === false ? "" : String(row.phone || ""),
      },
    });
  }

  return scored
    .sort((a, b) => b.score - a.score || a.candidate.name.localeCompare(b.candidate.name))
    .slice(0, limit)
    .map((item) => item.candidate);
}
