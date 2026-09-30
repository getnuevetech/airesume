import { db, id } from "./db.mjs";
import { completeJson } from "./ai-run.mjs";
import { migrate, publicPlan } from "./schema.mjs";
import { deliverMail } from "./mail.mjs";
import { fetchFeedListings, localPrimary, normalizeFeedUrl, publicFeedConfig, resolvePrimary } from "./feeds.mjs";
import { holdJobDraft, reviewJobIntake } from "./job-intake.mjs";
import { extractRequirements, matchJob } from "./match.mjs";
import { authenticitySignals, normalizeJobListing } from "./job-schema.mjs";
import { extractJobRequirements } from "./job-requirements.mjs";
import { computeApplicationReadiness } from "./readiness.mjs";
import { claimsSupported, tailoredDocument, normalizeResumePath, tailoringPreview } from "./resume-guard.mjs";
import { buildClarificationRecommendations } from "./upscale-clarify.mjs";
import { buildResumeInsights } from "./resume-upscale.mjs";
import { TRACKER_STATUSES, startOfUtcDay } from "./apply-rules.mjs";
import { draftQuestions } from "./questions.mjs";
import { registerBilling } from "./routes-billing.mjs";
import { registerResume } from "./routes-resume.mjs";
import { registerApplications } from "./routes-applications.mjs";
import { registerJobsAdmin } from "./routes-jobs-admin.mjs";
import { registerDashboard } from "./routes-dashboard.mjs";
import { registerProfile } from "./routes-profile.mjs";
import { registerAdminAi } from "./routes-admin-ai.mjs";
import { registerAdminPlans } from "./routes-admin-plans.mjs";
import { registerCareer } from "./routes-career.mjs";
import { registerInterview } from "./routes-interview.mjs";
import { registerVoice } from "./routes-voice.mjs";
import { registerFollowUps } from "./routes-follow-ups.mjs";
import { registerExtension } from "./routes-extension.mjs";
import { autoApplyAuthorizationPayload } from "./auto-apply-auth.mjs";

migrate();

const CATEGORIES = ["Product", "Engineering", "Design", "Data", "Marketing", "Operations", "Sales"];

function parse(value, fallback) {
  try {
    return JSON.parse(value || "");
  } catch {
    return fallback;
  }
}

function policy() {
  return parse(db.prepare("SELECT value FROM settings WHERE key = 'billing_policy'").get()?.value, {
    allowUpgrade: true,
    allowDowngrade: true,
    allowProration: true,
    allowRefund: false,
  });
}

function planRow(planId) {
  return db.prepare("SELECT * FROM plans WHERE id = ?").get(planId || "free") || db.prepare("SELECT * FROM plans WHERE id = 'free'").get();
}

function featuresOf(user) {
  const plan = planRow(user.plan_id);
  return { plan: publicPlan(plan), features: parse(plan.features, {}) };
}

function requireFeature(user, key, res) {
  const access = featuresOf(user);
  if (!access.features[key]) {
    res.status(403).json({ error: `The ${access.plan.name} plan does not include this. An admin can change the plan matrix.` });
    return null;
  }
  return access;
}

function slugify(name, userId) {
  const base = String(name || "profile")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "profile";
  let slug = `${base}-${String(userId).slice(-4)}`;
  const taken = db.prepare("SELECT user_id FROM profiles WHERE slug = ? AND user_id != ?").get(slug, userId);
  if (taken) slug = `${base}-${id("s").slice(-6)}`;
  return slug;
}

function documentFromProfile(profile) {
  return {
    headline: profile.headline || "",
    summary: profile.summary || "",
    skills: parse(profile.skills, []),
    employment: parse(profile.employment, []),
    education: parse(profile.education, []),
  };
}

export function renderDocument(doc) {
  const lines = [doc.headline, "", doc.summary, "", "Experience"];
  for (const job of doc.employment || []) {
    lines.push([job.title, job.employer, job.dates].filter(Boolean).join(", "));
    for (const bullet of job.bullets || []) lines.push(`- ${bullet}`);
  }
  lines.push("", "Skills", (doc.skills || []).join(", "), "", "Education", ...(doc.education || []));
  return lines.filter((line, index, all) => line !== "" || all[index - 1] !== "").join("\n").trim();
}

export function syncProfileVersion(userId) {
  const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(userId);
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!profile || !user) return;
  if (!profile.slug) {
    db.prepare("UPDATE profiles SET slug = ? WHERE user_id = ?").run(slugify(user.name, userId), userId);
  }
  if (!profile.headline) {
    const employment = parse(profile.employment, []);
    const headline = employment[0]?.title || "";
    if (headline) db.prepare("UPDATE profiles SET headline = ? WHERE user_id = ?").run(headline, userId);
  }
  const existing = db.prepare("SELECT id FROM resume_versions WHERE user_id = ? LIMIT 1").get(userId);
  if (existing) return;
  const fresh = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(userId);
  const document = documentFromProfile(fresh);
  db.prepare(
    `INSERT INTO resume_versions (id, user_id, label, kind, document, rendered, parent_id, active, created_at)
     VALUES (?, ?, 'Uploaded resume', 'upload', ?, ?, NULL, 1, ?)`,
  ).run(id("ver"), userId, JSON.stringify(document), renderDocument(document), Date.now());
}

function activeVersion(userId) {
  return (
    db.prepare("SELECT * FROM resume_versions WHERE user_id = ? AND active = 1 ORDER BY created_at DESC LIMIT 1").get(userId) ||
    db.prepare("SELECT * FROM resume_versions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").get(userId)
  );
}

function sourceText(doc) {
  return JSON.stringify(doc);
}

function diagnose(doc) {
  const insight = buildResumeInsights(doc);
  const recommendations = [...insight.recommendations];
  const clarifications = buildClarificationRecommendations(doc);
  for (const item of clarifications.recommendations) {
    if (!recommendations.some((existing) => existing.id === item.id)) recommendations.push(item);
  }
  return { rating: insight.rating, feedback: insight.feedback, recommendations };
}

async function reviewDocument(user, version) {
  const doc = parse(version.document, {});
  const local = diagnose(doc);
  const profile = db.prepare("SELECT facts FROM profiles WHERE user_id = ?").get(user.id);
  const facts = parse(profile?.facts, []);
  const ai = await completeJson(
    "resume_diagnostic",
    "Review this resume JSON. Return JSON {rating, feedback: string[], recommendations: [{id, title, detail, kind, path, proposed}]}. kind is note or rewrite. Never invent employers, tools, dates, or numbers. proposed must only rephrase text already present. Prefer paths like employment.0.bullets.0.",
    JSON.stringify(doc).slice(0, 12000),
  );
  let result = local;
  if (ai.json && Array.isArray(ai.json.recommendations)) {
    const source = sourceText(doc);
    const aiRecommendations = ai.json.recommendations
      .filter((item) => item && item.title)
      .map((item, index) => ({
        id: String(item.id || `ai-${index}`),
        title: String(item.title),
        detail: String(item.detail || ""),
        kind: item.kind === "rewrite" ? "rewrite" : "note",
        path: normalizeResumePath(item.path || ""),
        proposed: item.proposed ? String(item.proposed) : "",
      }))
      .filter((item) => item.kind !== "rewrite" || (item.proposed && item.path && claimsSupported(item.proposed, source, facts)));

    const localRewrites = local.recommendations.filter((item) => item.kind === "rewrite");
    const localClarify = local.recommendations.filter((item) => item.kind === "clarify");
    const aiRewrites = aiRecommendations.filter((item) => item.kind === "rewrite");
    const aiNotes = aiRecommendations.filter((item) => item.kind !== "rewrite");
    const recommendations = [
      ...localRewrites,
      ...aiRewrites.filter((item) => !localRewrites.some((localItem) => localItem.path === item.path)),
      ...aiNotes,
    ];
    for (const item of localClarify) {
      if (!recommendations.some((existing) => existing.id === item.id)) recommendations.push(item);
    }
    result = {
      rating: Math.max(1, Math.min(100, Number(ai.json.rating) || local.rating)),
      feedback: Array.isArray(ai.json.feedback) && ai.json.feedback.length ? ai.json.feedback.map(String) : local.feedback,
      recommendations: recommendations.length ? recommendations : local.recommendations,
    };
  }
  const reviewId = id("rev");
  db.prepare(
    `INSERT INTO resume_reviews (id, user_id, version_id, rating, feedback, recommendations, provider, model, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    reviewId,
    user.id,
    version.id,
    result.rating,
    JSON.stringify(result.feedback),
    JSON.stringify(result.recommendations),
    ai.provider || "Built-in rules",
    ai.model || "rules-v1",
    Date.now(),
  );
  return {
    id: reviewId,
    ...result,
    provider: ai.provider || "Built-in rules",
    model: ai.model || "rules-v1",
    versionId: version.id,
    costMicros: ai.costMicros || 0,
  };
}

function setPath(doc, path, value) {
  const parts = normalizeResumePath(path).split(".").filter(Boolean);
  if (!parts.length) return false;
  let cursor = doc;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = Number.isInteger(Number(parts[index])) && String(Number(parts[index])) === parts[index] ? Number(parts[index]) : parts[index];
    cursor = cursor?.[key];
  }
  if (!cursor) return false;
  const last = parts[parts.length - 1];
  const key = Number.isInteger(Number(last)) && String(Number(last)) === last ? Number(last) : last;
  if (cursor[key] === undefined) return false;
  cursor[key] = value;
  return true;
}

function categorizeText(title, description) {
  const blob = `${title} ${description}`.toLowerCase();
  const rules = [
    ["Product", /product manager|product management/],
    ["Design", /designer|figma|ux|ui\b/],
    ["Data", /data analyst|analytics|warehouse|sql/],
    ["Marketing", /marketing|campaign|brand/],
    ["Engineering", /engineer|developer|software|frontend|backend/],
    ["Sales", /sales|account executive/],
  ];
  const found = rules.find(([, pattern]) => pattern.test(blob));
  return found ? found[0] : "Operations";
}

function verifyJob(job, siblings) {
  return authenticitySignals(
    {
      id: job.id,
      title: job.title,
      company: job.company,
      location: job.location,
      description: job.description,
      source_url: job.sourceUrl || job.source_url,
      apply_url: job.applyUrl || job.primaryUrl,
      salary_min: job.salaryMin ?? job.salary_min,
      salary_max: job.salaryMax ?? job.salary_max,
    },
    siblings,
  );
}

async function categorizeAndVerify(job, siblings) {
  const localCategory = job.category && CATEGORIES.includes(job.category) ? job.category : categorizeText(job.title, job.description);
  const local = verifyJob({ ...job, category: localCategory }, siblings);
  const ai = await completeJson(
    "job_categorize",
    `Return JSON {"category","role"}. category must be one of: ${CATEGORIES.join(", ")}. Do not invent a company.`,
    `${job.title}\n${job.company}\n${job.description || ""}`,
  );
  const category = CATEGORIES.includes(ai.json?.category) ? ai.json.category : localCategory;
  const role = String(ai.json?.role || job.role || job.title).slice(0, 80);
  const check = await completeJson(
    "job_verify",
    'Return JSON {"verification","note"}. verification must be one of: Active, Possible duplicate, Needs review, Third-party recruiter, Listing may be expired, Review recommended.',
    JSON.stringify({ title: job.title, company: job.company, local: local.verification, note: local.note, flags: local.flags || [] }),
  );
  const allowed = ["Active", "Possible duplicate", "Needs review", "Third-party recruiter", "Listing may be expired", "Review recommended"];
  const verification = allowed.includes(check.json?.verification) ? check.json.verification : local.verification;
  return {
    category,
    role,
    verification,
    note: String(check.json?.note || local.note),
    authenticity: {
      flags: local.flags || [],
      duplicates: local.duplicates || [],
    },
    costMicros: (ai.costMicros || 0) + (check.costMicros || 0),
  };
}

function categorizeAndVerifyLocal(job, siblings) {
  const localCategory = job.category && CATEGORIES.includes(job.category) ? job.category : categorizeText(job.title, job.description);
  const local = verifyJob({ ...job, category: localCategory }, siblings);
  return {
    category: localCategory,
    role: String(job.role || job.title || "").slice(0, 80),
    verification: local.verification,
    note: local.note,
    authenticity: {
      flags: local.flags || [],
      duplicates: local.duplicates || [],
    },
    costMicros: 0,
  };
}

function jobKey(raw) {
  return String(raw.externalKey || `${raw.company}-${raw.title}`).slice(0, 180);
}

async function saveJob(sourceId, raw) {
  const normalized = normalizeJobListing(raw, { company: raw.company, employer: raw.employer, source_type: raw.source_type });
  const key = jobKey({ ...raw, ...normalized, externalKey: raw.externalKey || normalized.externalKey });
  const existing = db.prepare("SELECT * FROM jobs WHERE source_id = ? AND external_key = ?").get(sourceId, key);
  const skills = Array.isArray(raw.skills) ? raw.skills.map(String).slice(0, 12) : normalized.skills.slice(0, 12);
  let requirements = raw.requirements && typeof raw.requirements === "object"
    ? raw.requirements
    : null;
  let reqMeta = { costMicros: 0, source: "deterministic" };
  if (!requirements || !Array.isArray(requirements.mandatory)) {
    const extracted = await extractJobRequirements({
      title: normalized.title || raw.title,
      company: normalized.company || raw.company,
      description: normalized.description || raw.description,
      skills,
      role: normalized.role || raw.role,
      category: raw.category || normalized.category,
    });
    requirements = extracted.requirements;
    reqMeta = extracted;
  }
  const primaryCompany = String(raw.primaryCompany || normalized.primaryCompany || normalized.company || "");
  const primaryUrl = String(raw.primaryUrl || normalized.primaryUrl || "");
  const primaryEmail = String(raw.primaryEmail || normalized.primaryEmail || "");
  const authenticity = JSON.stringify(raw.authenticity || { flags: [], duplicates: [] });
  if (existing) {
    db.prepare(
      `UPDATE jobs SET title = ?, company = ?, location = ?, remote_type = ?, salary_min = ?, salary_max = ?, description = ?, skills = ?, requirements = ?, category = ?, role = ?, source_url = ?, verification = ?, verification_note = ?, primary_company = ?, primary_url = ?, primary_email = ?, authenticity = ?, active = 1
       WHERE id = ?`,
    ).run(
      normalized.title || raw.title,
      normalized.company || raw.company,
      normalized.location || raw.location || "",
      normalized.remote_type || raw.remoteType || "",
      normalized.salary_min ?? raw.salaryMin ?? null,
      normalized.salary_max ?? raw.salaryMax ?? null,
      normalized.description || raw.description || "",
      JSON.stringify(skills),
      JSON.stringify(requirements),
      raw.category || normalized.category || "",
      raw.role || normalized.role || "",
      normalized.source_url || raw.sourceUrl || "",
      raw.verification,
      raw.note,
      primaryCompany,
      primaryUrl,
      primaryEmail,
      authenticity,
      existing.id,
    );
    return { id: existing.id, requirementsCostMicros: reqMeta.costMicros || 0 };
  }
  const jobId = id("job");
  db.prepare(
    `INSERT INTO jobs (id, source_id, external_key, title, company, location, remote_type, employment_type, salary_min, salary_max, description, skills, requirements, category, role, source_url, verification, verification_note, primary_company, primary_url, primary_email, authenticity, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
  ).run(
    jobId,
    sourceId,
    key,
    normalized.title || raw.title,
    normalized.company || raw.company,
    normalized.location || raw.location || "",
    normalized.remote_type || raw.remoteType || "",
    normalized.employment_type || "full-time",
    normalized.salary_min ?? raw.salaryMin ?? null,
    normalized.salary_max ?? raw.salaryMax ?? null,
    normalized.description || raw.description || "",
    JSON.stringify(skills),
    JSON.stringify(requirements),
    raw.category || normalized.category || "",
    raw.role || normalized.role || "",
    normalized.source_url || raw.sourceUrl || "",
    raw.verification,
    raw.note,
    primaryCompany,
    primaryUrl,
    primaryEmail,
    authenticity,
    Date.now(),
  );
  return { id: jobId, requirementsCostMicros: reqMeta.costMicros || 0 };
}

async function pullSource(source) {
  const config = parse(source.config, {});
  let rows = [];
  if (source.kind === "catalog") {
    rows = db.prepare("SELECT * FROM jobs WHERE source_id = ?").all(source.id).map((job) => ({
      externalKey: job.external_key,
      title: job.title,
      company: job.company,
      employer: job.primary_company && job.primary_company !== job.company ? job.primary_company : "",
      location: job.location,
      remoteType: job.remote_type,
      salaryMin: job.salary_min,
      salaryMax: job.salary_max,
      description: job.description,
      skills: parse(job.skills, []),
      category: job.category,
      role: job.role,
      sourceUrl: job.source_url,
      applyUrl: job.primary_url || "",
    }));
    if (!rows.length) {
      recordPullResult(source.id, "empty", "Catalog has no jobs to refresh yet.");
      return 0;
    }
  } else if (source.kind === "json" || source.kind === "rss") {
    if (!config.url) {
      throw new Error("Add a feed URL before pulling.");
    }
    rows = await fetchFeedListings(source, config);
  } else {
    throw new Error(`This source kind (“${source.kind}”) cannot be pulled. Use a JSON, RSS, or HTML careers URL feed.`);
  }

  const siblings = rows.map((row, index) => ({ id: String(index), title: row.title, company: row.company }));
  const seen = new Set();
  const saveErrors = [];
  let held = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const row = { ...rows[index], id: String(index) };
    try {
      const review = await reviewJobIntake(row);
      if (!review.useful) {
        holdJobDraft({
          sourceId: source.id,
          origin: "feed",
          draft: row,
          reason: review.reasons[0] || "This listing is not a useful job.",
          provider: review.provider,
          model: review.model,
        });
        seen.add(jobKey(row));
        held += 1;
        continue;
      }
      // Pull stays local/fast so feeds do not hang on per-job AI calls.
      const primary = localPrimary(row);
      const checked = categorizeAndVerifyLocal(row, siblings);
      if (primary.primaryCompany && primary.primaryCompany.toLowerCase() !== String(row.company).toLowerCase()) {
        checked.note = `Apply to ${primary.primaryCompany}. ${checked.note}`;
      }
      const requirements = extractRequirements({
        title: row.title,
        description: row.description || "",
        skills: Array.isArray(row.skills) ? row.skills : [],
        role: row.role || row.title,
        category: checked.category,
      });
      seen.add(jobKey(row));
      await saveJob(source.id, {
        ...row,
        ...checked,
        ...primary,
        note: checked.note,
        authenticity: checked.authenticity,
        requirements,
      });
    } catch (error) {
      if (saveErrors.length < 3) {
        saveErrors.push(error instanceof Error ? error.message : "Could not save a listing.");
      }
    }
  }

  if (!seen.size) {
    const detail = saveErrors.length ? ` ${saveErrors.join(" · ")}` : "";
    throw new Error(`Fetched ${rows.length} listing${rows.length === 1 ? "" : "s"} but none could be saved.${detail}`);
  }

  if (source.kind !== "catalog") {
    const existing = db.prepare("SELECT id, external_key FROM jobs WHERE source_id = ? AND active = 1").all(source.id);
    for (const job of existing) {
      if (!seen.has(job.external_key)) db.prepare("UPDATE jobs SET active = 0 WHERE id = ?").run(job.id);
    }
  }

  const skipped = rows.length - seen.size;
  const heldNote = held > 0 ? ` ${held} listing${held === 1 ? "" : "s"} held for admin review.` : "";
  const message =
    skipped > 0
      ? `Pulled ${seen.size - held} job${seen.size - held === 1 ? "" : "s"} (${skipped} listing${skipped === 1 ? "" : "s"} skipped).${heldNote}`
      : `Pulled ${seen.size - held} job${seen.size - held === 1 ? "" : "s"}.${heldNote}`;
  recordPullResult(source.id, "ok", message);
  return seen.size;
}

function recordPullResult(sourceId, status, message) {
  db.prepare("UPDATE job_sources SET last_pulled_at = ?, last_pull_status = ?, last_pull_message = ? WHERE id = ?").run(
    Date.now(),
    String(status || ""),
    String(message || "").slice(0, 500),
    sourceId,
  );
}

function feedUrlTaken(url, exceptId = "") {
  let key = "";
  try {
    key = normalizeFeedUrl(url);
  } catch {
    return false;
  }
  const rows = db.prepare("SELECT id, config FROM job_sources").all();
  return rows.some((row) => {
    if (row.id === exceptId) return false;
    const config = parse(row.config, {});
    if (!config.url) return false;
    try {
      return normalizeFeedUrl(config.url) === key;
    } catch {
      return false;
    }
  });
}

function publicSource(source) {
  const config = parse(source.config, {});
  return {
    id: source.id,
    name: source.name,
    kind: source.kind,
    enabled: Boolean(source.enabled),
    lastPulledAt: source.last_pulled_at,
    lastPullStatus: source.last_pull_status || "",
    lastPullMessage: source.last_pull_message || "",
    config: publicFeedConfig(config),
  };
}

async function employerDelivery(user, job, rendered) {
  const target = job.primary_company || job.company;
  const email = String(job.primary_email || "").trim();
  const different = job.primary_company && job.primary_company.toLowerCase() !== String(job.company).toLowerCase();
  const lead = different ? `Tracked for ${target}, the employer named in the listing.` : `Tracked for ${target}.`;
  if (!email) return job.primary_url ? `${lead} Employer link saved.` : lead;
  const result = await deliverMail({
    to: email,
    subject: `Application: ${job.title}`,
    body: `${user.name} (${user.email}) is applying for ${job.title} at ${target}.\n\n${rendered}`,
  });
  if (result.sent) return `Sent to ${email} at ${target}.`;
  return `${lead} The listing includes ${email}, but it was not sent. ${result.error}`;
}

function maskSecret(value) {
  if (!value) return "";
  return `••••${String(value).slice(-4)}`;
}

function priceFor(plan, cycle) {
  return cycle === "yearly" ? plan.yearly_cents : plan.monthly_cents;
}

function creditFor(user) {
  const rules = policy();
  if (!rules.allowProration) return 0;
  const sub = db.prepare("SELECT * FROM subscriptions WHERE user_id = ?").get(user.id);
  const current = planRow(user.plan_id);
  if (!sub || !current || !sub.period_end || sub.period_end < Date.now()) return 0;
  const price = priceFor(current, sub.cycle || "monthly");
  const span = Math.max(1, sub.period_end - (sub.period_start || sub.period_end - 1));
  const remaining = Math.max(0, Math.min(1, (sub.period_end - Date.now()) / span));
  return Math.round(price * remaining);
}

function applyPlan(user, plan, gateway, cycle, externalId, amount, credit) {
  const from = user.plan_id || "free";
  const now = Date.now();
  const period = cycle === "yearly" ? 365 : 30;
  db.prepare("UPDATE users SET plan_id = ? WHERE id = ?").run(plan.id, user.id);
  db.prepare(
    `INSERT INTO subscriptions (user_id, plan_id, gateway_id, status, period_start, period_end, external_id, cycle)
     VALUES (?, ?, ?, 'active', ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET plan_id = excluded.plan_id, gateway_id = excluded.gateway_id, status = 'active', period_start = excluded.period_start, period_end = excluded.period_end, external_id = excluded.external_id, cycle = excluded.cycle`,
  ).run(user.id, plan.id, gateway?.id || "", now, now + period * 24 * 60 * 60 * 1000, externalId || "", cycle);
  const direction = (plan.sort_order || 0) >= (planRow(from)?.sort_order || 0) ? "upgrade" : "downgrade";
  db.prepare(
    "INSERT INTO billing_events (id, user_id, type, from_plan, to_plan, amount_cents, gateway_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run(id("bill"), user.id, direction, from, plan.id, amount, gateway?.id || "", `${cycle} change`, now);
  if (credit > 0) {
    db.prepare(
      "INSERT INTO billing_events (id, user_id, type, from_plan, to_plan, amount_cents, gateway_id, note, created_at) VALUES (?, ?, 'proration', ?, ?, ?, ?, 'Unused time credited', ?)",
    ).run(id("bill"), user.id, from, plan.id, credit, gateway?.id || "", now);
  }
  const rules = policy();
  if (direction === "downgrade" && rules.allowRefund && credit > 0) {
    db.prepare(
      "INSERT INTO billing_events (id, user_id, type, from_plan, to_plan, amount_cents, gateway_id, note, created_at) VALUES (?, ?, 'refund', ?, ?, ?, ?, 'Refund recorded for the unused period', ?)",
    ).run(id("bill"), user.id, from, plan.id, credit, gateway?.id || "", now);
  }
}

async function createApplication(user, job, mode, doc, preferences, facts = [], options = {}) {
  const match = matchJob(doc, preferences, job);
  let status = TRACKER_STATUSES.includes(options.status) ? options.status : "Review required";
  const shouldDeliver = Boolean(options.deliver) || status === "Applied";
  const existing = db.prepare("SELECT * FROM applications WHERE user_id = ? AND job_id = ?").get(user.id, job.id);
  const keepPinned = Boolean(existing?.version_id) && !options.repin;
  const needsVersion = !["Found", "Skipped"].includes(status) && !keepPinned;
  let versionId = keepPinned ? existing.version_id : null;
  let rendered = "";
  let delivery = "";
  const targetCompany = job.primary_company || job.company;
  const applyMode = mode === "auto" ? "auto" : "assisted";
  if (keepPinned) {
    const pinned = db.prepare("SELECT * FROM resume_versions WHERE id = ? AND user_id = ?").get(versionId, user.id);
    rendered = String(pinned?.rendered || "");
  } else if (needsVersion) {
    const versionDoc = tailoredDocument(doc, job, match, facts);
    rendered = renderDocument(versionDoc);
    versionId = id("ver");
    db.prepare(
      `INSERT INTO resume_versions (id, user_id, label, kind, document, rendered, parent_id, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    ).run(versionId, user.id, `For ${targetCompany} — ${job.title}`, "application", JSON.stringify(versionDoc), rendered, activeVersion(user.id)?.id || null, Date.now());
  }
  const questions = draftQuestions(job, doc, preferences, match);
  const readiness = computeApplicationReadiness({
    match,
    application: { questions, match_score: match.score, status },
    version: versionId ? { rendered, document: "{}" } : null,
    preferences,
    verification: job.verification || "",
  });
  // Review-first Assisted Apply: never mark Ready while blockers remain.
  if ((status === "Ready" || status === "Resume preparing") && readiness.state === "USER_ACTION_REQUIRED" && !options.forceReady) {
    status = "Review required";
  }
  if (shouldDeliver && rendered) {
    delivery = await employerDelivery(user, job, rendered);
  } else if (status === "Ready") {
    delivery = "Assisted Apply packet ready. Review in browser, then mark Applied after you submit on the employer site.";
  } else if (status === "Review required") {
    delivery = options.reason || readiness.blockers[0] || "Needs your review before Assisted Apply can finish.";
  } else if (status === "Found") {
    delivery = "Saved to your tracker.";
  } else if (status === "Skipped") {
    delivery = "Skipped.";
  }
  if (options.reason && status === "Review required") {
    delivery = options.reason;
  }
  if (keepPinned && existing?.delivery && status === existing.status) {
    delivery = existing.delivery;
  }
  const now = Date.now();
  db.prepare(
    `INSERT INTO applications (id, user_id, job_id, version_id, mode, status, match_score, target_company, target_url, target_email, delivery, questions, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, job_id) DO UPDATE SET
       version_id = CASE WHEN length(COALESCE(applications.version_id, '')) > 0 AND ? = 0
         THEN applications.version_id ELSE COALESCE(excluded.version_id, applications.version_id) END,
       mode = excluded.mode,
       status = excluded.status,
       match_score = excluded.match_score,
       target_company = excluded.target_company,
       target_url = excluded.target_url,
       target_email = excluded.target_email,
       delivery = excluded.delivery,
       questions = excluded.questions,
       updated_at = excluded.updated_at`,
  ).run(
    id("app"),
    user.id,
    job.id,
    versionId,
    applyMode,
    status,
    match.score,
    targetCompany,
    job.primary_url || job.source_url || "",
    job.primary_email || "",
    delivery,
    JSON.stringify(questions),
    now,
    now,
    options.repin ? 1 : 0,
  );
  const row = db.prepare("SELECT * FROM applications WHERE user_id = ? AND job_id = ?").get(user.id, job.id);
  const version = row?.version_id
    ? db.prepare("SELECT * FROM resume_versions WHERE id = ? AND user_id = ?").get(row.version_id, user.id)
    : null;
  const siblings = version
    ? db.prepare("SELECT * FROM resume_versions WHERE user_id = ?").all(user.id)
    : [];
  return {
    id: row?.id,
    score: match.score,
    status: row?.status || status,
    match,
    questions: parse(row?.questions || "[]", questions),
    readiness,
    versionId: row?.version_id || versionId,
    versionLabel: version?.label || "",
    mode: row?.mode || applyMode,
    tailored: tailoringPreview(version, siblings),
  };
}

function canAutoApply(job) {
  if (job.verification === "Active") return true;
  const primary = String(job.primary_company || "");
  return job.verification === "Third-party recruiter" && primary && primary.toLowerCase() !== String(job.company).toLowerCase();
}

function autoCapUsed(userId, now = Date.now()) {
  const start = startOfUtcDay(now);
  return db
    .prepare("SELECT COUNT(*) AS count FROM applications WHERE user_id = ? AND mode = 'auto' AND created_at >= ?")
    .get(userId, start).count;
}

function money(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function registerPlatform(app, { requireUser, requireAdmin, audit, upload, originOf }) {
  registerBilling(app, {
    requireUser,
    requireAdmin,
    policy,
    planRow,
    creditFor,
    priceFor,
    applyPlan,
    originOf,
    publicProviderGateway,
    maskSecret,
  });
  registerResume(app, {
    requireUser,
    requireFeature,
    featuresOf,
    syncProfileVersion,
    activeVersion,
    reviewDocument,
    audit,
    parse,
    sourceText,
    claimsSupported,
    setPath,
    renderDocument,
  });
  registerApplications(app, {
    requireUser,
    requireFeature,
    featuresOf,
    createApplication,
    activeVersion,
    parse,
    categorizeAndVerify,
    saveJob,
    employerDelivery,
    autoCapUsed,
    canAutoApply,
    renderDocument,
    audit,
  });
  registerJobsAdmin(app, {
    requireAdmin,
    audit,
    parse,
    publicSource,
    feedUrlTaken,
    pullSource,
    categorizeAndVerify,
    saveJob,
  });
  registerDashboard(app, {
    requireUser,
    syncProfileVersion,
    featuresOf,
    activeVersion,
    parse,
    policy,
    autoCapUsed,
  });
  registerProfile(app, {
    requireUser,
    requireFeature,
    featuresOf,
    parse,
    slugify,
    activeVersion,
    renderDocument,
    documentFromProfile,
    audit,
    upload,
  });
  registerAdminAi(app, {
    requireAdmin,
    maskSecret,
  });
  registerAdminPlans(app, {
    requireAdmin,
    parse,
    policy,
  });
  registerCareer(app, {
    requireUser,
    requireFeature,
    featuresOf,
    syncProfileVersion,
    activeVersion,
    parse,
  });
  registerInterview(app, {
    requireUser,
    requireFeature,
    syncProfileVersion,
    activeVersion,
    parse,
  });
  registerVoice(app, {
    requireUser,
    requireFeature,
    syncProfileVersion,
    activeVersion,
  });
  registerFollowUps(app, {
    requireUser,
    requireFeature,
  });
  registerExtension(app, {
    requireUser,
    requireFeature,
    featuresOf,
    createApplication,
    activeVersion,
    parse,
    categorizeAndVerify,
    saveJob,
  });
}

function publicProviderGateway(row) {
  return { id: row.id, name: row.name, kind: row.kind, enabled: Boolean(row.enabled), mode: row.mode, publicKey: row.public_key || "", secretKey: maskSecret(row.secret_key) };
}

export { money };
