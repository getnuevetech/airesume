/** Public plans and authenticated dashboard aggregate. */

import { db } from "./db.mjs";
import { matchJob } from "./match.mjs";
import { TRACKER_STATUSES } from "./apply-rules.mjs";
import { allowExplanation, explanationQuota, redactMatch, reviewQuota } from "./quota.mjs";
import { publicPlan, resolveTemplate, templateLimitOf, RESUME_TEMPLATES } from "./schema.mjs";
import { applyKitMetrics } from "./apply-kit-metrics.mjs";
import { followUpMetrics, syncFollowUpsForUser } from "./follow-ups.mjs";
import { autoApplyAuthorizationPayload } from "./auto-apply-auth.mjs";
import { billingDisclosurePayload } from "./billing-disclosure.mjs";
import { iceConfigSummary, resolveIceServers } from "./webrtc-signaling.mjs";

function publicVersion(row) {
  return { id: row.id, label: row.label, kind: row.kind, active: Boolean(row.active), rendered: row.rendered, createdAt: row.created_at };
}

function profilePayload(profile, user, parse) {
  if (!profile) return null;
  return {
    headline: profile.headline || "",
    summary: profile.summary || "",
    skills: parse(profile.skills, []),
    employment: parse(profile.employment, []),
    education: parse(profile.education, []),
    facts: parse(profile.facts, []),
    preferences: parse(profile.preferences, {}),
    resumeName: profile.resume_name || "",
    photoUrl: profile.photo_url || "",
    slug: profile.slug || "",
    city: user?.city || "",
    address: user?.address || "",
    shareContact: parse(profile.preferences, {}).shareContact !== false,
  };
}

function jobCard(job, match, sourceNames, applied) {
  const applyCompany = job.primary_company || job.company;
  const via = applyCompany.toLowerCase() !== String(job.company).toLowerCase() ? job.company : "";
  const locked = Boolean(match.explanationLocked);
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    applyCompany,
    viaCompany: via,
    sourceName: sourceNames.get(job.source_id) || "",
    primaryUrl: job.primary_url || "",
    location: job.location,
    remoteType: job.remote_type,
    salaryMin: job.salary_min,
    salaryMax: job.salary_max,
    category: job.category,
    role: job.role,
    verification: job.verification,
    description: job.description,
    score: match.score,
    label: locked ? "" : match.label || "",
    explanation: locked ? "" : match.explanation || "",
    matched: locked ? [] : match.matched,
    missing: locked ? [] : match.missing,
    preferredMatched: locked ? [] : match.preferredMatched || [],
    explanationLocked: locked,
    applied,
  };
}

export function registerDashboard(app, ctx) {
  const {
    requireUser,
    syncProfileVersion,
    featuresOf,
    activeVersion,
    parse,
    policy,
    autoCapUsed,
  } = ctx;

  app.get("/api/plans", (_req, res) => {
    const plans = db.prepare("SELECT * FROM plans WHERE active = 1 ORDER BY sort_order").all().map(publicPlan);
    res.json({ plans, policy: policy() });
  });

  app.get("/api/dashboard", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    syncProfileVersion(user.id);
    const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(user.id);
    const access = featuresOf(user);
    const version = profile ? activeVersion(user.id) : null;
    const doc = version ? parse(version.document, {}) : { skills: [], employment: [], education: [] };
    const preferences = profile ? parse(profile.preferences, {}) : {};
    const jobs = db.prepare("SELECT * FROM jobs WHERE active = 1").all();
    const sourceNames = new Map(db.prepare("SELECT id, name FROM job_sources").all().map((source) => [source.id, source.name]));
    const applications = db.prepare("SELECT * FROM applications WHERE user_id = ?").all(user.id);
    const appliedIds = new Set(applications.map((item) => item.job_id));
    let ranked = jobs
      .map((job) => ({ job, ...matchJob(doc, preferences, job) }))
      .sort((a, b) => b.score - a.score);
    if (access.features.job_limit) ranked = ranked.slice(0, access.features.job_limit);
    if (!access.features.job_browse) ranked = [];
    const quota = explanationQuota(user.id, access.features);
    ranked = ranked.map((item) => (allowExplanation(user.id, item.job.id, quota) ? item : redactMatch(item)));
    const reviews = reviewQuota(user.id, access.features);
    const review = db.prepare("SELECT * FROM resume_reviews WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").get(user.id);
    const versions = db.prepare("SELECT * FROM resume_versions WHERE user_id = ? ORDER BY created_at DESC").all(user.id).map(publicVersion);
    const responded = applications.filter((item) => ["Responded", "Interview", "Offer"].includes(item.status)).length;
    const submitted = applications.filter((item) => item.status === "Applied" || ["Responded", "Interview", "Offer", "Rejected", "Withdrawn"].includes(item.status)).length;
    const readyCount = applications.filter((item) => item.status === "Ready").length;
    const reviewCount = applications.filter((item) => item.status === "Review required").length;
    const kitStats = applyKitMetrics({ userId: user.id });
    const jobsById = new Map(jobs.map((job) => [job.id, job]));
    syncFollowUpsForUser(user.id, applications, jobsById);
    const followUps = followUpMetrics(user.id);
    const versionLabels = new Map(versions.map((item) => [item.id, item.label]));
    res.json({
      profile: profilePayload(profile, user, parse),
      plan: access.plan,
      features: access.features,
      policy: policy(),
      plans: db.prepare("SELECT * FROM plans WHERE active = 1 ORDER BY sort_order").all().map(publicPlan),
      gateways: db.prepare("SELECT id, name, kind, enabled, mode FROM payment_gateways WHERE enabled = 1").all(),
      autoApply: Boolean(user.auto_apply),
      autoMin: user.auto_min || 85,
      autoDailyCap: user.auto_daily_cap ?? 5,
      autoCapUsed: autoCapUsed(user.id),
      autoApplyAuthorization: autoApplyAuthorizationPayload(user),
      billingDisclosure: billingDisclosurePayload(user),
      media: iceConfigSummary(resolveIceServers()),
      matchQuota: {
        limit: quota.limit,
        used: quota.used,
        remaining: quota.unlimited ? null : quota.remaining,
        unlimited: quota.unlimited,
        resetsAt: quota.resetsAt,
      },
      reviewQuota: {
        limit: reviews.limit,
        used: reviews.used,
        remaining: reviews.unlimited ? null : reviews.remaining,
        unlimited: reviews.unlimited,
        resetsAt: reviews.resetsAt,
      },
      statuses: TRACKER_STATUSES,
      stats: {
        resumeRating: review ? review.rating : null,
        applied: submitted,
        tracked: applications.length,
        ready: readyCount,
        reviewRequired: reviewCount,
        responded,
        available: ranked.length,
        recommended: ranked.filter((item) => item.score >= 70 || item.label === "strong" || item.label === "good").length,
        versions: versions.length,
        kitOpened: kitStats.kitsOpened,
        kitCompleted: kitStats.kitsCompleted,
        kitCompletionRate: kitStats.completionRate,
        followUpsDue: followUps.due,
        followUpsOpen: followUps.open,
      },
      jobs: ranked.map((item) => jobCard(item.job, item, sourceNames, appliedIds.has(item.job.id))),
      applications: applications.map((item) => {
        const job = jobs.find((row) => row.id === item.job_id) || db.prepare("SELECT * FROM jobs WHERE id = ?").get(item.job_id);
        const target = item.target_company || job?.primary_company || job?.company || "";
        const poster = job?.company || "";
        return {
          id: item.id,
          jobId: item.job_id,
          title: job?.title || "Role",
          company: target || poster,
          viaCompany: target && poster && target.toLowerCase() !== poster.toLowerCase() ? poster : "",
          sourceName: job ? sourceNames.get(job.source_id) || "" : "",
          targetUrl: item.target_url || "",
          delivery: item.delivery || "",
          status: item.status,
          mode: item.mode,
          match: item.match_score,
          versionId: item.version_id,
          versionLabel: versionLabels.get(item.version_id) || "",
          questions: parse(item.questions, []),
        };
      }),
      review: review
        ? { id: review.id, rating: review.rating, feedback: parse(review.feedback, []), recommendations: parse(review.recommendations, []) }
        : null,
      versions,
      template: resolveTemplate(profile?.template, templateLimitOf(access.features)),
      templateLimit: templateLimitOf(access.features),
      templates: RESUME_TEMPLATES,
    });
  });
}
