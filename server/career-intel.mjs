/** Deterministic career intelligence from profile facts and the job catalog. */

import { matchJob } from "./match.mjs";
import { isOutcomeStatus, isSubmittedStatus } from "./apply-rules.mjs";

function lower(value) {
  return String(value || "").toLowerCase().trim();
}

function parseRequirements(job) {
  if (job.requirements && typeof job.requirements === "object") return job.requirements;
  try {
    return JSON.parse(job.requirements || "{}");
  } catch {
    return {};
  }
}

function ownedSkills(doc = {}) {
  return (doc.skills || []).map((skill) => String(skill).trim()).filter(Boolean);
}

function skillOwned(owned, skill) {
  const needle = lower(skill);
  return owned.some((item) => lower(item).includes(needle) || needle.includes(lower(item)));
}

function countMapIncrement(map, key, weight = 1) {
  if (!key) return;
  const normalized = String(key).trim();
  if (!normalized) return;
  const existing = map.get(lower(normalized)) || { label: normalized, count: 0 };
  existing.count += weight;
  if (normalized.length > existing.label.length) existing.label = normalized;
  map.set(lower(normalized), existing);
}

function topEntries(map, limit) {
  return [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)).slice(0, limit);
}

/**
 * Build career insights without AI. Only uses resume skills and catalog requirements.
 */
export function buildCareerInsights({ doc = {}, preferences = {}, jobs = [], applications = [], options = {} } = {}) {
  const skillLimit = Math.max(3, Number(options.skillLimit) || 8);
  const owned = ownedSkills(doc);
  const demand = new Map();
  const preferredDemand = new Map();
  const categories = new Map();
  const roles = new Map();

  for (const job of jobs) {
    const requirements = parseRequirements(job);
    for (const skill of requirements.mandatory || []) countMapIncrement(demand, skill, 2);
    const listedSkills = Array.isArray(job.skills) ? job.skills : [];
    for (const skill of listedSkills) countMapIncrement(demand, skill, 1);
    for (const skill of requirements.preferred || []) countMapIncrement(preferredDemand, skill, 1);
    if (job.category) countMapIncrement(categories, job.category, 1);
    if (job.role) countMapIncrement(roles, job.role, 1);
  }

  const strengths = topEntries(demand, 40)
    .filter((item) => skillOwned(owned, item.label))
    .slice(0, skillLimit)
    .map((item) => ({ skill: item.label, demand: item.count, kind: "strength" }));

  const gaps = topEntries(demand, 40)
    .filter((item) => !skillOwned(owned, item.label))
    .slice(0, skillLimit)
    .map((item) => ({ skill: item.label, demand: item.count, kind: "gap" }));

  const ranked = jobs
    .map((job) => ({ job, ...matchJob(doc, preferences, job) }))
    .sort((a, b) => b.score - a.score);
  const visible = options.jobLimit ? ranked.slice(0, options.jobLimit) : ranked;
  const strong = visible.filter((item) => item.score >= 70 || item.label === "strong" || item.label === "good");

  const categoryFit = new Map();
  for (const item of ranked) {
    const category = item.job.category || "Other";
    const row = categoryFit.get(category) || { category, count: 0, scoreSum: 0, strong: 0 };
    row.count += 1;
    row.scoreSum += item.score;
    if (item.score >= 70) row.strong += 1;
    categoryFit.set(category, row);
  }
  const categoryOutlook = [...categoryFit.values()]
    .map((row) => ({
      category: row.category,
      jobs: row.count,
      avgScore: Math.round(row.scoreSum / Math.max(1, row.count)),
      strong: row.strong,
    }))
    .sort((a, b) => b.avgScore - a.avgScore || b.strong - a.strong)
    .slice(0, 6);

  const statusCounts = {};
  for (const app of applications) {
    const status = String(app.status || "Unknown");
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  }
  const tracked = applications.length;
  const submitted = applications.filter((item) => isSubmittedStatus(item.status)).length;
  const responses = applications.filter((item) => isOutcomeStatus(item.status)).length;
  const interviews = applications.filter((item) => ["Interview", "Offer", "Hired"].includes(item.status)).length;
  const offers = applications.filter((item) => ["Offer", "Hired"].includes(item.status)).length;
  const hired = applications.filter((item) => item.status === "Hired").length;
  const rejected = applications.filter((item) => item.status === "Rejected").length;
  const ready = applications.filter((item) => item.status === "Ready").length;
  const reviewRequired = applications.filter((item) => item.status === "Review required").length;

  // Outcome learning: join tracker rows to catalog jobs when job_id is present.
  const jobsById = new Map(jobs.map((job) => [job.id, job]));
  const outcomeRows = applications
    .map((app) => {
      const job = jobsById.get(app.job_id || app.jobId) || null;
      const matchScore = Number(app.match_score ?? app.matchScore ?? 0);
      return { app, job, matchScore, status: String(app.status || "") };
    })
    .filter((row) => row.status);
  const advanced = outcomeRows.filter((row) => isOutcomeStatus(row.status));
  const stalled = outcomeRows.filter((row) => ["Applied", "Rejected", "Withdrawn"].includes(row.status));
  const winningDemand = new Map();
  const winningCategories = new Map();
  for (const row of advanced) {
    if (!row.job) continue;
    const requirements = parseRequirements(row.job);
    for (const skill of requirements.mandatory || []) countMapIncrement(winningDemand, skill, 2);
    const listedSkills = Array.isArray(row.job.skills) ? row.job.skills : [];
    for (const skill of listedSkills) countMapIncrement(winningDemand, skill, 1);
    if (row.job.category) countMapIncrement(winningCategories, row.job.category, 1);
  }
  const winningSkills = topEntries(winningDemand, skillLimit)
    .filter((item) => skillOwned(owned, item.label))
    .slice(0, Math.min(5, skillLimit))
    .map((item) => ({ skill: item.label, hits: item.count, kind: "outcome" }));
  const avg = (rows) =>
    rows.length ? Math.round(rows.reduce((sum, row) => sum + (row.matchScore || 0), 0) / rows.length) : null;
  const outcomes = {
    interviews,
    offers,
    hired,
    rejected,
    advanced: advanced.length,
    stalled: stalled.length,
    avgMatchAdvanced: avg(advanced),
    avgMatchStalled: avg(stalled.filter((row) => row.status === "Applied" || row.status === "Rejected")),
    winningCategories: topEntries(winningCategories, 4).map((item) => ({ label: item.label, count: item.count })),
    winningSkills,
    lessons: [],
  };
  if (winningSkills[0]) {
    outcomes.lessons.push({
      id: "skill-win",
      title: `${winningSkills[0].skill} shows up in roles that advanced`,
      detail: `Applications that reached a response or interview often list ${winningSkills[0].skill}. Keep that evidence prominent on tailored versions.`,
    });
  }
  if (outcomes.avgMatchAdvanced != null && outcomes.avgMatchStalled != null && outcomes.avgMatchAdvanced > outcomes.avgMatchStalled + 5) {
    outcomes.lessons.push({
      id: "match-bar",
      title: "Higher-match applications advance more often",
      detail: `Advanced applications average ${outcomes.avgMatchAdvanced}% match vs ${outcomes.avgMatchStalled}% for applied/rejected rows. Prefer preparing stronger fits first.`,
    });
  }
  if (offers) {
    outcomes.lessons.push({
      id: "offer",
      title: "You already have an offer signal",
      detail: "Reuse the resume version and talking points from the offer row when preparing similar roles.",
    });
  } else if (interviews && !responses) {
    outcomes.lessons.push({
      id: "interview-focus",
      title: "Interview prep is the bottleneck",
      detail: `${interviews} interview-stage row${interviews === 1 ? "" : "s"} — rehearse STAR answers from pinned resume bullets before the next loop.`,
    });
  } else if (submitted && !responses) {
    outcomes.lessons.push({
      id: "follow-up",
      title: "No responses yet — schedule follow-ups",
      detail: `${submitted} submitted application${submitted === 1 ? "" : "s"} with no response. Use follow-up reminders instead of spraying more weak applies.`,
    });
  }

  const focus = [];
  for (const lesson of outcomes.lessons.slice(0, 2)) {
    focus.push({ id: lesson.id, title: lesson.title, detail: lesson.detail });
  }
  if (gaps[0]) {
    focus.push({
      id: "gap-1",
      title: `Close the ${gaps[0].skill} gap`,
      detail: `${gaps[0].skill} shows up often in open roles and is not on your resume yet. Only add it if it is a real fact you can support.`,
    });
  }
  if (categoryOutlook[0] && categoryOutlook[0].avgScore >= 55) {
    focus.push({
      id: "category",
      title: `Lean into ${categoryOutlook[0].category}`,
      detail: `Your average match in ${categoryOutlook[0].category} is ${categoryOutlook[0].avgScore}% across ${categoryOutlook[0].jobs} roles.`,
    });
  }
  if (ready + reviewRequired > 0) {
    focus.push({
      id: "pipeline",
      title: "Clear the apply pipeline",
      detail: `${ready} ready and ${reviewRequired} review-required applications are waiting on you.`,
    });
  } else if (strong.length) {
    focus.push({
      id: "prepare",
      title: "Prepare a strong match",
      detail: `${strong[0].job.title} at ${strong[0].job.primary_company || strong[0].job.company} scores ${strong[0].score}%.`,
    });
  }
  if (!owned.length) {
    focus.unshift({
      id: "skills",
      title: "Confirm skills on your profile",
      detail: "Career insights need verified skills from your resume before demand gaps are useful.",
    });
  }

  return {
    summary: {
      catalogJobs: jobs.length,
      visibleJobs: visible.length,
      strongMatches: strong.length,
      tracked,
      submitted,
      responses,
      interviews,
      offers,
      hired,
      rejected,
      responseRate: submitted ? Math.round((responses / submitted) * 100) : null,
      interviewRate: submitted ? Math.round((interviews / submitted) * 100) : null,
      skillCount: owned.length,
    },
    strengths,
    gaps,
    risingPreferred: topEntries(preferredDemand, skillLimit)
      .filter((item) => !skillOwned(owned, item.label))
      .slice(0, Math.min(5, skillLimit))
      .map((item) => ({ skill: item.label, demand: item.count, kind: "preferred" })),
    categories: topEntries(categories, 6).map((item) => ({ label: item.label, count: item.count })),
    roles: topEntries(roles, 6).map((item) => ({ label: item.label, count: item.count })),
    categoryOutlook,
    tracker: statusCounts,
    outcomes,
    focus: focus.slice(0, 5),
    topMatches: strong.slice(0, 5).map((item) => ({
      id: item.job.id,
      title: item.job.title,
      company: item.job.primary_company || item.job.company,
      score: item.score,
      label: item.label,
      missing: (item.missing || []).slice(0, 4),
    })),
  };
}
