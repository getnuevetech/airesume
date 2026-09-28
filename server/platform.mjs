import { db, id } from "./db.mjs";
import { completeJson } from "./ai-run.mjs";
import { migrate, publicPlan } from "./schema.mjs";
import { deliverMail } from "./mail.mjs";
import { fetchFeedListings, normalizeFeedUrl, publicFeedConfig, resolvePrimary } from "./feeds.mjs";
import { extractRequirements, matchJob } from "./match.mjs";
import { claimsSupported, tailoredDocument } from "./resume-guard.mjs";
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

migrate();

const CATEGORIES = ["Product", "Engineering", "Design", "Data", "Marketing", "Operations", "Sales"];
const WEAK = [
  [/^\s*responsible for\s+/i, "Owned "],
  [/^\s*duties included\s+/i, "Delivered "],
  [/^\s*helped with\s+/i, "Supported "],
  [/^\s*helped\s+/i, "Supported "],
  [/^\s*assisted with\s+/i, "Supported "],
  [/^\s*worked on\s+/i, "Delivered "],
];

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
  const feedback = [];
  const recommendations = [];
  let rating = 78;
  const summary = String(doc.summary || "").trim();
  if (summary.length < 40) {
    rating -= 12;
    feedback.push("The summary is too short to show the shape of your work.");
    recommendations.push({
      id: "summary-length",
      title: "Lengthen the summary with facts you already have",
      detail: "Add a sentence from your existing roles. The review will not invent one.",
      kind: "note",
    });
  } else {
    feedback.push("The summary is long enough to use as the opening.");
  }
  let weakCount = 0;
  (doc.employment || []).forEach((job, jobIndex) => {
    (job.bullets || []).forEach((bullet, bulletIndex) => {
      const rule = WEAK.find(([pattern]) => pattern.test(bullet));
      if (!rule) return;
      weakCount += 1;
      const proposed = bullet.replace(rule[0], rule[1]);
      if (proposed === bullet || !claimsSupported(proposed, bullet)) return;
      recommendations.push({
        id: `bullet-${jobIndex}-${bulletIndex}`,
        title: `Strengthen “${bullet.slice(0, 48)}”`,
        detail: "This keeps the same duty and replaces a weak opening verb.",
        kind: "rewrite",
        path: `employment.${jobIndex}.bullets.${bulletIndex}`,
        proposed,
      });
    });
  });
  if (weakCount) {
    rating -= Math.min(18, weakCount * 6);
    feedback.push(`${weakCount} bullet${weakCount === 1 ? "" : "s"} open with a weak verb.`);
  } else {
    feedback.push("Experience lines already use direct verbs.");
  }
  const blob = renderDocument(doc);
  if (!/\d/.test(blob)) {
    rating -= 8;
    feedback.push("No measurable figure is on the resume. Add only numbers you can confirm in the profile editor.");
    recommendations.push({
      id: "metrics",
      title: "Add a verified number",
      detail: "Scope, team size, or a result you can stand behind. Nothing is inserted automatically.",
      kind: "note",
    });
  }
  rating = Math.max(35, Math.min(96, rating));
  return { rating, feedback, recommendations };
}

async function reviewDocument(user, version) {
  const doc = parse(version.document, {});
  const local = diagnose(doc);
  const ai = await completeJson(
    "resume_diagnostic",
    "Review this resume JSON. Return JSON {rating, feedback: string[], recommendations: [{id, title, detail, kind, path, proposed}]}. kind is note or rewrite. Never invent employers, tools, dates, or numbers. proposed must only rephrase text already present.",
    JSON.stringify(doc).slice(0, 12000),
  );
  let result = local;
  if (ai.json && Array.isArray(ai.json.recommendations)) {
    const source = sourceText(doc);
    const recommendations = ai.json.recommendations
      .filter((item) => item && item.title)
      .map((item, index) => ({
        id: String(item.id || `ai-${index}`),
        title: String(item.title),
        detail: String(item.detail || ""),
        kind: item.kind === "rewrite" ? "rewrite" : "note",
        path: String(item.path || ""),
        proposed: item.proposed ? String(item.proposed) : "",
      }))
      .filter((item) => item.kind !== "rewrite" || (item.proposed && claimsSupported(item.proposed, source)));
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
  ).run(reviewId, user.id, version.id, result.rating, JSON.stringify(result.feedback), JSON.stringify(result.recommendations), ai.provider, ai.model, Date.now());
  return { id: reviewId, ...result, provider: ai.provider, model: ai.model, versionId: version.id, costMicros: ai.costMicros || 0 };
}

function setPath(doc, path, value) {
  const parts = path.split(".");
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
  const duplicate = siblings.some((other) => other.id !== job.id && other.company.toLowerCase() === job.company.toLowerCase() && other.title.toLowerCase() === job.title.toLowerCase());
  if (!job.company || !job.title) return { verification: "Needs review", note: "Missing a title or company." };
  if (/staffing|recruit/i.test(job.company)) return { verification: "Third-party recruiter", note: "Company name looks like a staffing firm." };
  if (duplicate) return { verification: "Possible duplicate", note: "Another listing has the same company and title." };
  if (job.salary_max && job.salary_max > 400000) return { verification: "Needs review", note: "Salary is unusually high." };
  return { verification: "Active", note: "Passed the listing checks." };
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
    'Return JSON {"verification","note"}. verification must be one of: Active, Possible duplicate, Needs review, Third-party recruiter.',
    JSON.stringify({ title: job.title, company: job.company, local: local.verification, note: local.note }),
  );
  const allowed = ["Active", "Possible duplicate", "Needs review", "Third-party recruiter"];
  const verification = allowed.includes(check.json?.verification) ? check.json.verification : local.verification;
  return {
    category,
    role,
    verification,
    note: String(check.json?.note || local.note),
    costMicros: (ai.costMicros || 0) + (check.costMicros || 0),
  };
}

function jobKey(raw) {
  return String(raw.externalKey || `${raw.company}-${raw.title}`).slice(0, 180);
}

function saveJob(sourceId, raw) {
  const key = jobKey(raw);
  const existing = db.prepare("SELECT * FROM jobs WHERE source_id = ? AND external_key = ?").get(sourceId, key);
  const skills = Array.isArray(raw.skills) ? raw.skills.map(String).slice(0, 12) : [];
  const requirements = raw.requirements && typeof raw.requirements === "object"
    ? raw.requirements
    : extractRequirements({
      title: raw.title,
      description: raw.description,
      skills,
      role: raw.role,
      category: raw.category,
    });
  const primaryCompany = String(raw.primaryCompany || raw.company || "");
  const primaryUrl = String(raw.primaryUrl || "");
  const primaryEmail = String(raw.primaryEmail || "");
  if (existing) {
    db.prepare(
      `UPDATE jobs SET title = ?, company = ?, location = ?, remote_type = ?, salary_min = ?, salary_max = ?, description = ?, skills = ?, requirements = ?, category = ?, role = ?, source_url = ?, verification = ?, verification_note = ?, primary_company = ?, primary_url = ?, primary_email = ?, active = 1
       WHERE id = ?`,
    ).run(raw.title, raw.company, raw.location || "", raw.remoteType || "", raw.salaryMin || null, raw.salaryMax || null, raw.description || "", JSON.stringify(skills), JSON.stringify(requirements), raw.category || "", raw.role || "", raw.sourceUrl || "", raw.verification, raw.note, primaryCompany, primaryUrl, primaryEmail, existing.id);
    return existing.id;
  }
  const jobId = id("job");
  db.prepare(
    `INSERT INTO jobs (id, source_id, external_key, title, company, location, remote_type, employment_type, salary_min, salary_max, description, skills, requirements, category, role, source_url, verification, verification_note, primary_company, primary_url, primary_email, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'full-time', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
  ).run(jobId, sourceId, key, raw.title, raw.company, raw.location || "", raw.remoteType || "", raw.salaryMin || null, raw.salaryMax || null, raw.description || "", JSON.stringify(skills), JSON.stringify(requirements), raw.category || "", raw.role || "", raw.sourceUrl || "", raw.verification, raw.note, primaryCompany, primaryUrl, primaryEmail, Date.now());
  return jobId;
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
  } else if (source.kind === "json" || source.kind === "rss") {
    rows = await fetchFeedListings(source, config);
  } else {
    return 0;
  }
  const siblings = rows.map((row, index) => ({ id: String(index), title: row.title, company: row.company }));
  const seen = new Set();
  for (let index = 0; index < rows.length; index += 1) {
    const row = { ...rows[index], id: String(index) };
    const primary = await resolvePrimary(row);
    const checked = await categorizeAndVerify(row, siblings);
    if (primary.primaryCompany && primary.primaryCompany.toLowerCase() !== String(row.company).toLowerCase()) {
      checked.note = `Apply to ${primary.primaryCompany}. ${checked.note}`;
    }
    seen.add(jobKey(row));
    saveJob(source.id, { ...row, ...checked, ...primary, note: checked.note });
  }
  if (source.kind !== "catalog") {
    const existing = db.prepare("SELECT id, external_key FROM jobs WHERE source_id = ? AND active = 1").all(source.id);
    for (const job of existing) {
      if (!seen.has(job.external_key)) db.prepare("UPDATE jobs SET active = 0 WHERE id = ?").run(job.id);
    }
  }
  db.prepare("UPDATE job_sources SET last_pulled_at = ? WHERE id = ?").run(Date.now(), source.id);
  return seen.size;
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
  const status = TRACKER_STATUSES.includes(options.status) ? options.status : "Ready";
  const shouldDeliver = Boolean(options.deliver) || status === "Applied";
  const needsVersion = !["Found", "Skipped"].includes(status);
  let versionId = null;
  let rendered = "";
  let delivery = "";
  const targetCompany = job.primary_company || job.company;
  if (needsVersion) {
    const versionDoc = tailoredDocument(doc, job, match, facts);
    rendered = renderDocument(versionDoc);
    versionId = id("ver");
    const kind = status === "Resume preparing" ? "application" : "application";
    db.prepare(
      `INSERT INTO resume_versions (id, user_id, label, kind, document, rendered, parent_id, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    ).run(versionId, user.id, `For ${targetCompany} — ${job.title}`, kind, JSON.stringify(versionDoc), rendered, activeVersion(user.id)?.id || null, Date.now());
  }
  if (shouldDeliver && rendered) {
    delivery = await employerDelivery(user, job, rendered);
  } else if (status === "Ready") {
    delivery = "Tailored resume ready for your review. Submit when you want it sent.";
  } else if (status === "Review required") {
    delivery = options.reason || "Needs your review before submit.";
  } else if (status === "Found") {
    delivery = "Saved to your tracker.";
  } else if (status === "Skipped") {
    delivery = "Skipped.";
  }
  if (options.reason && status === "Review required") {
    delivery = options.reason;
  }
  const questions = draftQuestions(job, doc, preferences, match);
  const now = Date.now();
  db.prepare(
    `INSERT INTO applications (id, user_id, job_id, version_id, mode, status, match_score, target_company, target_url, target_email, delivery, questions, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, job_id) DO UPDATE SET version_id = COALESCE(excluded.version_id, applications.version_id), mode = excluded.mode, status = excluded.status, match_score = excluded.match_score, target_company = excluded.target_company, target_url = excluded.target_url, target_email = excluded.target_email, delivery = excluded.delivery, questions = excluded.questions, updated_at = excluded.updated_at`,
  ).run(
    id("app"),
    user.id,
    job.id,
    versionId,
    mode,
    status,
    match.score,
    targetCompany,
    job.primary_url || job.source_url || "",
    job.primary_email || "",
    delivery,
    JSON.stringify(questions),
    now,
    now,
  );
  return { score: match.score, status, match, questions };
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
}

function publicProviderGateway(row) {
  return { id: row.id, name: row.name, kind: row.kind, enabled: Boolean(row.enabled), mode: row.mode, publicKey: row.public_key || "", secretKey: maskSecret(row.secret_key) };
}

export { money };
