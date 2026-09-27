import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, extname } from "node:path";
import { db, id, uploadsDir } from "./db.mjs";
import { completeJson } from "./ai-run.mjs";
import { AI_FUNCTIONS, FEATURES, migrate, publicPlan } from "./schema.mjs";

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

function claimsSupported(proposed, source) {
  const numbers = String(proposed).match(/\d[\d,.]*/g) || [];
  return numbers.every((number) => source.includes(number));
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
  return { id: reviewId, ...result, provider: ai.provider, model: ai.model, versionId: version.id };
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

function matchJob(doc, preferences, job) {
  const skills = (doc.skills || []).map((skill) => skill.toLowerCase());
  const required = parse(job.skills, []);
  const matched = required.filter((skill) => skills.some((owned) => owned.includes(skill.toLowerCase()) || skill.toLowerCase().includes(owned)));
  const skillScore = required.length ? matched.length / required.length : 0.45;
  const titles = (doc.employment || []).map((item) => `${item.title || ""} ${item.employer || ""}`.toLowerCase());
  const role = `${job.title} ${job.role}`.toLowerCase();
  const titleScore = titles.some((title) => title && (role.includes(title.split(",")[0]) || title.includes(String(job.role || "").toLowerCase()))) ? 1 : 0.35;
  let locationScore = 0.7;
  const places = String(preferences.locations || "").toLowerCase();
  if (places) locationScore = places.split(/[,/]/).some((place) => job.location.toLowerCase().includes(place.trim()) || job.remote_type === "remote") ? 1 : 0.4;
  const score = Math.round(skillScore * 60 + titleScore * 25 + locationScore * 15);
  return { score: Math.max(1, Math.min(99, score)), matched, missing: required.filter((skill) => !matched.includes(skill)) };
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
  return { category, role, verification, note: String(check.json?.note || local.note) };
}

function saveJob(sourceId, raw) {
  const key = String(raw.externalKey || `${raw.company}-${raw.title}`).slice(0, 180);
  const existing = db.prepare("SELECT * FROM jobs WHERE source_id = ? AND external_key = ?").get(sourceId, key);
  const skills = Array.isArray(raw.skills) ? raw.skills.map(String).slice(0, 12) : [];
  if (existing) {
    db.prepare(
      `UPDATE jobs SET title = ?, company = ?, location = ?, remote_type = ?, salary_min = ?, salary_max = ?, description = ?, skills = ?, category = ?, role = ?, source_url = ?, verification = ?, verification_note = ?, active = 1
       WHERE id = ?`,
    ).run(raw.title, raw.company, raw.location || "", raw.remoteType || "", raw.salaryMin || null, raw.salaryMax || null, raw.description || "", JSON.stringify(skills), raw.category || "", raw.role || "", raw.sourceUrl || "", raw.verification, raw.note, existing.id);
    return existing.id;
  }
  const jobId = id("job");
  db.prepare(
    `INSERT INTO jobs (id, source_id, external_key, title, company, location, remote_type, employment_type, salary_min, salary_max, description, skills, category, role, source_url, verification, verification_note, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'full-time', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
  ).run(jobId, sourceId, key, raw.title, raw.company, raw.location || "", raw.remoteType || "", raw.salaryMin || null, raw.salaryMax || null, raw.description || "", JSON.stringify(skills), raw.category || "", raw.role || "", raw.sourceUrl || "", raw.verification, raw.note, Date.now());
  return jobId;
}

async function pullSource(source) {
  const rows = [];
  if (source.kind === "catalog") {
    rows.push(...db.prepare("SELECT * FROM jobs WHERE source_id = ?").all(source.id).map((job) => ({
      externalKey: job.external_key,
      title: job.title,
      company: job.company,
      location: job.location,
      remoteType: job.remote_type,
      salaryMin: job.salary_min,
      salaryMax: job.salary_max,
      description: job.description,
      skills: parse(job.skills, []),
      category: job.category,
      role: job.role,
      sourceUrl: job.source_url,
    })));
  }
  if (source.kind === "json") {
    const config = parse(source.config, {});
    if (!config.url) throw new Error("Add a JSON feed URL.");
    const response = await fetch(config.url);
    if (!response.ok) throw new Error(`Feed returned ${response.status}.`);
    const body = await response.json();
    const list = Array.isArray(body) ? body : body.jobs || [];
    for (const item of list) {
      if (!item.title || !item.company) continue;
      rows.push({
        externalKey: item.id || `${item.company}-${item.title}`,
        title: String(item.title),
        company: String(item.company),
        location: String(item.location || ""),
        remoteType: String(item.remote_type || item.remoteType || ""),
        salaryMin: Number(item.salary_min || item.salaryMin) || null,
        salaryMax: Number(item.salary_max || item.salaryMax) || null,
        description: String(item.description || item.job_description || ""),
        skills: item.skills || [],
        category: String(item.category || ""),
        role: String(item.role || ""),
        sourceUrl: String(item.url || item.source_url || config.url),
      });
    }
  }
  const siblings = rows.map((row, index) => ({ id: String(index), title: row.title, company: row.company }));
  let count = 0;
  for (let index = 0; index < rows.length; index += 1) {
    const row = { ...rows[index], id: String(index) };
    const checked = await categorizeAndVerify(row, siblings);
    saveJob(source.id, { ...row, ...checked, note: checked.note });
    count += 1;
  }
  db.prepare("UPDATE job_sources SET last_pulled_at = ? WHERE id = ?").run(Date.now(), source.id);
  return count;
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

function tailoredDocument(doc, job, match) {
  const skills = [...(doc.skills || [])];
  skills.sort((a, b) => Number(match.matched.some((skill) => skill.toLowerCase() === b.toLowerCase())) - Number(match.matched.some((skill) => skill.toLowerCase() === a.toLowerCase())));
  return { ...doc, skills };
}

function createApplication(user, job, mode, doc, preferences) {
  const match = matchJob(doc, preferences, job);
  const versionDoc = tailoredDocument(doc, job, match);
  const versionId = id("ver");
  db.prepare(
    `INSERT INTO resume_versions (id, user_id, label, kind, document, rendered, parent_id, active, created_at)
     VALUES (?, ?, ?, 'application', ?, ?, ?, 0, ?)`,
  ).run(versionId, user.id, `For ${job.company} — ${job.title}`, JSON.stringify(versionDoc), renderDocument(versionDoc), activeVersion(user.id)?.id || null, Date.now());
  const now = Date.now();
  db.prepare(
    `INSERT INTO applications (id, user_id, job_id, version_id, mode, status, match_score, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'Applied', ?, ?, ?)
     ON CONFLICT(user_id, job_id) DO UPDATE SET version_id = excluded.version_id, mode = excluded.mode, status = 'Applied', match_score = excluded.match_score, updated_at = excluded.updated_at`,
  ).run(id("app"), user.id, job.id, versionId, mode, match.score, now, now);
  return match.score;
}

function profilePayload(profile, user) {
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
    shareContact: parse(profile.preferences, {}).shareContact !== false,
  };
}

function money(cents) {
  return `$${(cents / 100).toFixed(2)}`;
}

export function registerPlatform(app, { requireUser, requireAdmin, audit, upload, originOf }) {
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
    const applications = db.prepare("SELECT * FROM applications WHERE user_id = ?").all(user.id);
    const appliedIds = new Set(applications.map((item) => item.job_id));
    let ranked = jobs
      .map((job) => ({ job, ...matchJob(doc, preferences, job) }))
      .sort((a, b) => b.score - a.score);
    if (access.features.job_limit) ranked = ranked.slice(0, access.features.job_limit);
    if (!access.features.job_browse) ranked = [];
    const review = db.prepare("SELECT * FROM resume_reviews WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").get(user.id);
    const versions = db.prepare("SELECT * FROM resume_versions WHERE user_id = ? ORDER BY created_at DESC").all(user.id).map(publicVersion);
    const responded = applications.filter((item) => ["Responded", "Interview", "Offer"].includes(item.status)).length;
    res.json({
      profile: profilePayload(profile, user),
      plan: access.plan,
      features: access.features,
      policy: policy(),
      plans: db.prepare("SELECT * FROM plans WHERE active = 1 ORDER BY sort_order").all().map(publicPlan),
      gateways: db.prepare("SELECT id, name, kind, enabled, mode FROM payment_gateways WHERE enabled = 1").all(),
      autoApply: Boolean(user.auto_apply),
      autoMin: user.auto_min || 85,
      stats: {
        resumeRating: review ? review.rating : null,
        applied: applications.length,
        responded,
        available: ranked.length,
        recommended: ranked.filter((item) => item.score >= 70).length,
        versions: versions.length,
      },
      jobs: ranked.map((item) => ({
        id: item.job.id,
        title: item.job.title,
        company: item.job.company,
        location: item.job.location,
        remoteType: item.job.remote_type,
        salaryMin: item.job.salary_min,
        salaryMax: item.job.salary_max,
        category: item.job.category,
        role: item.job.role,
        verification: item.job.verification,
        description: item.job.description,
        score: item.score,
        matched: item.matched,
        missing: item.missing,
        applied: appliedIds.has(item.job.id),
      })),
      applications: applications.map((item) => {
        const job = jobs.find((row) => row.id === item.job_id);
        return { id: item.id, jobId: item.job_id, title: job?.title || "Role", company: job?.company || "", status: item.status, mode: item.mode, match: item.match_score, versionId: item.version_id };
      }),
      review: review
        ? { id: review.id, rating: review.rating, feedback: parse(review.feedback, []), recommendations: parse(review.recommendations, []), provider: review.provider, model: review.model }
        : null,
      versions,
    });
  });

  app.put("/api/profile", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const access = requireFeature(user, "profile_edit", res);
    if (!access) return;
    const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(user.id);
    if (!profile) {
      res.status(400).json({ error: "Upload a resume before editing a profile." });
      return;
    }
    const name = String(req.body.name || user.name).trim();
    const phone = String(req.body.phone || "").trim();
    const address = String(req.body.address || "").trim();
    const city = String(req.body.city || "").trim();
    const headline = String(req.body.headline || "").trim();
    const summary = String(req.body.summary || "").trim();
    const skills = Array.isArray(req.body.skills) ? req.body.skills.map((skill) => String(skill).trim()).filter(Boolean).slice(0, 24) : [];
    const employment = Array.isArray(req.body.employment) ? req.body.employment.slice(0, 12) : [];
    const education = Array.isArray(req.body.education) ? req.body.education.map(String).filter(Boolean).slice(0, 8) : [];
    let slug = String(req.body.slug || profile.slug || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
    if (!slug) slug = slugify(name, user.id);
    const clash = db.prepare("SELECT user_id FROM profiles WHERE slug = ? AND user_id != ?").get(slug, user.id);
    if (clash) {
      res.status(409).json({ error: "That public link is already in use." });
      return;
    }
    const preferences = {
      ...parse(profile.preferences, {}),
      salary: String(req.body.salary || ""),
      workArrangement: String(req.body.workArrangement || ""),
      locations: String(req.body.locations || ""),
      workAuthorization: String(req.body.workAuthorization || ""),
      shareContact: Boolean(req.body.shareContact),
    };
    const facts = [
      { fact_id: "ID-001", statement: `Name: ${name}`, verified_by_user: true },
      phone ? { fact_id: "ID-003", statement: `Phone: ${phone}`, verified_by_user: true } : null,
      city ? { fact_id: "ID-004", statement: `Location: ${city}`, verified_by_user: true } : null,
      ...employment.map((job, index) => ({ fact_id: `EXP-${index + 1}`, statement: `${job.title || "Role"}${job.employer ? ` at ${job.employer}` : ""}`, verified_by_user: true })),
      ...skills.map((skill, index) => ({ fact_id: `SKILL-${index + 1}`, statement: skill, verified_by_user: true })),
    ].filter(Boolean);
    db.prepare("UPDATE users SET name = ?, phone = ?, address = ?, city = ? WHERE id = ?").run(name, phone, address, city, user.id);
    db.prepare(
      "UPDATE profiles SET headline = ?, summary = ?, skills = ?, employment = ?, education = ?, facts = ?, preferences = ?, slug = ?, updated_at = ? WHERE user_id = ?",
    ).run(headline, summary, JSON.stringify(skills), JSON.stringify(employment), JSON.stringify(education), JSON.stringify(facts), JSON.stringify(preferences), slug, Date.now(), user.id);
    const document = { headline, summary, skills, employment, education };
    const current = activeVersion(user.id);
    if (current) {
      db.prepare("UPDATE resume_versions SET document = ?, rendered = ? WHERE id = ?").run(JSON.stringify(document), renderDocument(document), current.id);
    }
    res.json({ ok: true, slug });
  });

  app.post("/api/profile/photo", upload.single("photo"), (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    if (!req.file) {
      res.status(400).json({ error: "Choose an image." });
      return;
    }
    const extension = extname(req.file.originalname || "").toLowerCase();
    if (![".png", ".jpg", ".jpeg", ".webp"].includes(extension)) {
      res.status(400).json({ error: "Use a PNG, JPG, or WEBP photo." });
      return;
    }
    const name = `${id("photo")}${extension}`;
    writeFileSync(join(uploadsDir, name), req.file.buffer);
    db.prepare("UPDATE profiles SET photo_url = ?, updated_at = ? WHERE user_id = ?").run(`/uploads/${name}`, Date.now(), user.id);
    res.json({ photoUrl: `/uploads/${name}` });
  });

  app.post("/api/profile/photo/enhance", async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    if (!requireFeature(user, "image_enhance", res)) return;
    const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(user.id);
    if (!profile?.photo_url) {
      res.status(400).json({ error: "Upload a photo first." });
      return;
    }
    const ai = await completeJson(
      "image_enhance",
      "Return JSON {contrast, color, sharpness} as numbers from 1 to 1.35. These tune the existing photo. Do not describe a different person.",
      "Tune this resume headshot.",
    );
    const contrast = clamp(ai.json?.contrast, 1.08);
    const color = clamp(ai.json?.color, 1.05);
    const sharpness = clamp(ai.json?.sharpness, 1.25);
    const source = join(uploadsDir, profile.photo_url.replace(/^\/uploads\//, ""));
    const nextName = `${id("photo")}.jpg`;
    const dest = join(uploadsDir, nextName);
    try {
      const dir = mkdtempSync(join(tmpdir(), "photo-"));
      const script = join(dir, "enhance.py");
      writeFileSync(
        script,
        `from PIL import Image, ImageEnhance\nim = Image.open(${JSON.stringify(source)}).convert("RGB")\nim = ImageEnhance.Contrast(im).enhance(${contrast})\nim = ImageEnhance.Color(im).enhance(${color})\nim = ImageEnhance.Sharpness(im).enhance(${sharpness})\nim.save(${JSON.stringify(dest)}, quality=92)\n`,
      );
      execFileSync("python3", [script], { timeout: 20000 });
    } catch {
      res.status(500).json({ error: "The photo could not be enhanced." });
      return;
    }
    db.prepare("UPDATE profiles SET photo_url = ?, updated_at = ? WHERE user_id = ?").run(`/uploads/${nextName}`, Date.now(), user.id);
    audit({ userId: user.id, functionName: "image_enhance", provider: ai.provider, model: ai.model, status: "applied", detail: `${contrast},${color},${sharpness}` });
    res.json({ photoUrl: `/uploads/${nextName}`, provider: ai.provider, model: ai.model });
  });

  app.post("/api/resume/review", async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    if (!requireFeature(user, "resume_review", res)) return;
    syncProfileVersion(user.id);
    const version = activeVersion(user.id);
    if (!version) {
      res.status(400).json({ error: "There is no resume to review yet." });
      return;
    }
    const review = await reviewDocument(user, version);
    audit({ userId: user.id, functionName: "resume_diagnostic", provider: review.provider, model: review.model, status: "ready", detail: String(review.rating) });
    res.json({ review });
  });

  app.post("/api/resume/apply", async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    if (!requireFeature(user, "resume_upscale", res)) return;
    const review = db.prepare("SELECT * FROM resume_reviews WHERE id = ? AND user_id = ?").get(String(req.body.reviewId || ""), user.id);
    const version = review ? db.prepare("SELECT * FROM resume_versions WHERE id = ? AND user_id = ?").get(review.version_id, user.id) : null;
    if (!review || !version) {
      res.status(400).json({ error: "Run a review before applying recommendations." });
      return;
    }
    const selected = new Set((req.body.recommendationIds || []).map(String));
    const recommendations = parse(review.recommendations, []).filter((item) => selected.has(item.id) && item.kind === "rewrite" && item.proposed && item.path);
    if (!recommendations.length) {
      res.status(400).json({ error: "Select at least one rewrite. Notes are guidance and are not inserted." });
      return;
    }
    const doc = parse(version.document, {});
    const source = sourceText(doc);
    const applied = [];
    for (const item of recommendations) {
      if (!claimsSupported(item.proposed, source)) continue;
      if (setPath(doc, item.path, item.proposed)) applied.push(item.id);
    }
    if (!applied.length) {
      res.status(400).json({ error: "Those recommendations could not be applied without adding unsupported claims." });
      return;
    }
    const count = db.prepare("SELECT COUNT(*) AS count FROM resume_versions WHERE user_id = ? AND kind = 'upscale'").get(user.id).count + 1;
    const versionId = id("ver");
    db.prepare(
      `INSERT INTO resume_versions (id, user_id, label, kind, document, rendered, parent_id, active, created_at)
       VALUES (?, ?, ?, 'upscale', ?, ?, ?, 0, ?)`,
    ).run(versionId, user.id, `Upscale ${count}`, JSON.stringify(doc), renderDocument(doc), version.id, Date.now());
    audit({ userId: user.id, functionName: "resume_upscale", provider: review.provider, model: review.model, status: "version", detail: versionId });
    res.json({ versionId, applied });
  });

  app.post("/api/resume/versions/:id/activate", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const version = db.prepare("SELECT * FROM resume_versions WHERE id = ? AND user_id = ?").get(req.params.id, user.id);
    if (!version) {
      res.status(404).json({ error: "Version not found." });
      return;
    }
    const doc = parse(version.document, {});
    db.prepare("UPDATE resume_versions SET active = 0 WHERE user_id = ?").run(user.id);
    db.prepare("UPDATE resume_versions SET active = 1 WHERE id = ?").run(version.id);
    db.prepare("UPDATE profiles SET headline = ?, summary = ?, skills = ?, employment = ?, education = ?, updated_at = ? WHERE user_id = ?").run(
      doc.headline || "",
      doc.summary || "",
      JSON.stringify(doc.skills || []),
      JSON.stringify(doc.employment || []),
      JSON.stringify(doc.education || []),
      Date.now(),
      user.id,
    );
    res.json({ ok: true });
  });

  app.post("/api/applications", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    if (!requireFeature(user, "manual_apply", res)) return;
    const job = db.prepare("SELECT * FROM jobs WHERE id = ? AND active = 1").get(String(req.body.jobId || ""));
    const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(user.id);
    const version = activeVersion(user.id);
    if (!job || !profile || !version) {
      res.status(400).json({ error: "That job is not available." });
      return;
    }
    const score = createApplication(user, job, "manual", parse(version.document, {}), parse(profile.preferences, {}));
    res.json({ ok: true, score });
  });

  app.post("/api/applications/auto", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    if (!requireFeature(user, "auto_apply", res)) return;
    if (!user.auto_apply) {
      res.status(400).json({ error: "Turn on auto apply in your account first." });
      return;
    }
    const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(user.id);
    const version = activeVersion(user.id);
    if (!profile || !version) {
      res.status(400).json({ error: "A resume is required before auto apply." });
      return;
    }
    const doc = parse(version.document, {});
    const preferences = parse(profile.preferences, {});
    const existing = new Set(db.prepare("SELECT job_id FROM applications WHERE user_id = ?").all(user.id).map((item) => item.job_id));
    const ready = db
      .prepare("SELECT * FROM jobs WHERE active = 1 AND verification = 'Active'")
      .all()
      .map((job) => ({ job, ...matchJob(doc, preferences, job) }))
      .filter((item) => item.score >= (user.auto_min || 85) && !existing.has(item.job.id))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    for (const item of ready) createApplication(user, item.job, "auto", doc, preferences);
    res.json({ applied: ready.length });
  });

  app.patch("/api/applications/:id", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const allowed = ["Applied", "Responded", "Interview", "Offer", "Rejected", "Withdrawn"];
    const status = allowed.includes(req.body.status) ? req.body.status : "";
    if (!status) {
      res.status(400).json({ error: "Choose a status from the tracker." });
      return;
    }
    const result = db.prepare("UPDATE applications SET status = ?, updated_at = ? WHERE id = ? AND user_id = ?").run(status, Date.now(), req.params.id, user.id);
    if (!result.changes) {
      res.status(404).json({ error: "Application not found." });
      return;
    }
    res.json({ ok: true });
  });

  app.put("/api/account/auto-apply", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    if (req.body.enabled && !requireFeature(user, "auto_apply", res)) return;
    const minMatch = Math.max(50, Math.min(99, Number(req.body.minMatch) || 85));
    db.prepare("UPDATE users SET auto_apply = ?, auto_min = ? WHERE id = ?").run(req.body.enabled ? 1 : 0, minMatch, user.id);
    res.json({ ok: true });
  });

  app.get("/api/public/resume/:slug", (req, res) => {
    const profile = db.prepare("SELECT * FROM profiles WHERE slug = ?").get(req.params.slug);
    if (!profile) {
      res.status(404).json({ error: "This resume link is not public." });
      return;
    }
    const user = db.prepare("SELECT * FROM users WHERE id = ? AND status = 'active'").get(profile.user_id);
    if (!user || !featuresOf(user).features.public_profile) {
      res.status(404).json({ error: "This resume link is not public." });
      return;
    }
    const version = activeVersion(user.id);
    const doc = version ? parse(version.document, {}) : documentFromProfile(profile);
    const preferences = parse(profile.preferences, {});
    res.json({
      name: user.name,
      headline: doc.headline || profile.headline || "",
      summary: doc.summary || "",
      skills: doc.skills || [],
      employment: doc.employment || [],
      education: doc.education || [],
      photoUrl: profile.photo_url || "",
      city: user.city || "",
      email: preferences.shareContact === false ? "" : user.email,
      phone: preferences.shareContact === false ? "" : user.phone || "",
    });
  });

  app.post("/api/billing/checkout", async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const plan = db.prepare("SELECT * FROM plans WHERE id = ? AND active = 1").get(String(req.body.planId || ""));
    const gateway = db.prepare("SELECT * FROM payment_gateways WHERE id = ? AND enabled = 1").get(String(req.body.gatewayId || ""));
    if (!plan || !gateway) {
      res.status(400).json({ error: "Choose an active plan and an enabled payment gateway." });
      return;
    }
    if (plan.id === (user.plan_id || "free")) {
      res.status(400).json({ error: "You are already on that plan." });
      return;
    }
    const rules = policy();
    const current = planRow(user.plan_id);
    const upgrade = plan.sort_order >= (current?.sort_order || 0);
    if (upgrade && !rules.allowUpgrade) {
      res.status(403).json({ error: "Upgrades are turned off by an admin." });
      return;
    }
    if (!upgrade && !rules.allowDowngrade) {
      res.status(403).json({ error: "Downgrades are turned off by an admin." });
      return;
    }
    const cycle = req.body.cycle === "yearly" ? "yearly" : "monthly";
    const credit = creditFor(user);
    const amount = Math.max(0, priceFor(plan, cycle) - (rules.allowProration ? credit : 0));
    if (gateway.kind === "manual" || amount === 0) {
      applyPlan(user, plan, gateway, cycle, "", amount, rules.allowProration ? credit : 0);
      res.json({ applied: true, amount, credit });
      return;
    }
    const checkoutId = id("chk");
    if (gateway.kind === "stripe") {
      const body = new URLSearchParams({
        mode: "payment",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][product_data][name]": `${plan.name} ${cycle}`,
        "line_items[0][price_data][unit_amount]": String(amount),
        "line_items[0][quantity]": "1",
        success_url: `${originOf(req)}/dashboard?checkout=success&checkout_id=${checkoutId}`,
        cancel_url: `${originOf(req)}/dashboard?checkout=cancel`,
        client_reference_id: user.id,
      });
      const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: { Authorization: `Bearer ${gateway.secret_key}`, "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const session = await response.json();
      if (!response.ok) {
        res.status(400).json({ error: session.error?.message || "Stripe did not start checkout." });
        return;
      }
      db.prepare(
        "INSERT INTO checkouts (id, user_id, plan_id, gateway_id, cycle, amount_cents, credit_cents, status, external_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)",
      ).run(checkoutId, user.id, plan.id, gateway.id, cycle, amount, credit, session.id, Date.now());
      res.json({ url: session.url, checkoutId });
      return;
    }
    if (gateway.kind === "paypal") {
      const base = gateway.mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
      const tokenResponse = await fetch(`${base}/v1/oauth2/token`, {
        method: "POST",
        headers: { Authorization: `Basic ${Buffer.from(`${gateway.public_key}:${gateway.secret_key}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: "grant_type=client_credentials",
      });
      const token = await tokenResponse.json();
      if (!token.access_token) {
        res.status(400).json({ error: "PayPal did not accept those credentials." });
        return;
      }
      const orderResponse = await fetch(`${base}/v2/checkout/orders`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [{ amount: { currency_code: "USD", value: (amount / 100).toFixed(2) }, description: plan.name }],
          application_context: { return_url: `${originOf(req)}/dashboard?checkout=success&checkout_id=${checkoutId}`, cancel_url: `${originOf(req)}/dashboard?checkout=cancel` },
        }),
      });
      const order = await orderResponse.json();
      const approve = order.links?.find((link) => link.rel === "approve")?.href;
      if (!approve) {
        res.status(400).json({ error: "PayPal did not return a checkout link." });
        return;
      }
      db.prepare(
        "INSERT INTO checkouts (id, user_id, plan_id, gateway_id, cycle, amount_cents, credit_cents, status, external_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)",
      ).run(checkoutId, user.id, plan.id, gateway.id, cycle, amount, credit, order.id, Date.now());
      res.json({ url: approve, checkoutId });
      return;
    }
    res.status(400).json({ error: "That gateway is not supported." });
  });

  app.post("/api/billing/confirm", async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const checkout = db.prepare("SELECT * FROM checkouts WHERE id = ? AND user_id = ?").get(String(req.body.checkoutId || ""), user.id);
    if (!checkout) {
      res.status(404).json({ error: "Checkout not found." });
      return;
    }
    if (checkout.status === "paid") {
      res.json({ applied: true });
      return;
    }
    const gateway = db.prepare("SELECT * FROM payment_gateways WHERE id = ?").get(checkout.gateway_id);
    const plan = db.prepare("SELECT * FROM plans WHERE id = ?").get(checkout.plan_id);
    let paid = false;
    if (gateway?.kind === "stripe") {
      const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${checkout.external_id}`, { headers: { Authorization: `Bearer ${gateway.secret_key}` } });
      const session = await response.json();
      paid = session.payment_status === "paid";
    }
    if (gateway?.kind === "paypal") {
      const base = gateway.mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
      const tokenResponse = await fetch(`${base}/v1/oauth2/token`, {
        method: "POST",
        headers: { Authorization: `Basic ${Buffer.from(`${gateway.public_key}:${gateway.secret_key}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: "grant_type=client_credentials",
      });
      const token = await tokenResponse.json();
      const capture = await fetch(`${base}/v2/checkout/orders/${checkout.external_id}/capture`, { method: "POST", headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" } });
      const body = await capture.json();
      paid = body.status === "COMPLETED";
    }
    if (!paid) {
      res.status(400).json({ error: "The payment is not complete yet." });
      return;
    }
    applyPlan(user, plan, gateway, checkout.cycle, checkout.external_id, checkout.amount_cents, checkout.credit_cents);
    db.prepare("UPDATE checkouts SET status = 'paid' WHERE id = ?").run(checkout.id);
    res.json({ applied: true });
  });

  app.get("/api/admin/ai", (req, res) => {
    if (!requireAdmin(req, res)) return;
    res.json({
      functions: AI_FUNCTIONS,
      providers: db.prepare("SELECT * FROM ai_providers ORDER BY created_at").all().map(publicProvider),
      assignments: db.prepare("SELECT * FROM ai_assignments").all(),
    });
  });

  app.post("/api/admin/ai/providers", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const kind = ["openai", "anthropic", "google", "deterministic"].includes(req.body.kind) ? req.body.kind : "";
    const name = String(req.body.name || "").trim();
    const model = String(req.body.model || "").trim();
    if (!kind || name.length < 2 || model.length < 2) {
      res.status(400).json({ error: "Name, kind, and model are required." });
      return;
    }
    const providerId = id("ai");
    db.prepare("INSERT INTO ai_providers (id, name, kind, model, api_key, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      providerId,
      name,
      kind,
      model,
      kind === "deterministic" ? "" : String(req.body.apiKey || ""),
      req.body.enabled === false ? 0 : 1,
      Date.now(),
    );
    res.json({ provider: publicProvider(db.prepare("SELECT * FROM ai_providers WHERE id = ?").get(providerId)) });
  });

  app.patch("/api/admin/ai/providers/:id", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const provider = db.prepare("SELECT * FROM ai_providers WHERE id = ?").get(req.params.id);
    if (!provider) {
      res.status(404).json({ error: "Provider not found." });
      return;
    }
    const apiKey = req.body.apiKey && !String(req.body.apiKey).startsWith("••••") ? String(req.body.apiKey) : provider.api_key;
    db.prepare("UPDATE ai_providers SET name = ?, model = ?, api_key = ?, enabled = ? WHERE id = ?").run(
      String(req.body.name || provider.name),
      String(req.body.model || provider.model),
      apiKey,
      req.body.enabled === false ? 0 : 1,
      provider.id,
    );
    res.json({ provider: publicProvider(db.prepare("SELECT * FROM ai_providers WHERE id = ?").get(provider.id)) });
  });

  app.put("/api/admin/ai/assignments", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const functionKey = AI_FUNCTIONS.some((item) => item.key === req.body.functionKey) ? req.body.functionKey : "";
    const provider = db.prepare("SELECT id FROM ai_providers WHERE id = ?").get(String(req.body.providerId || ""));
    if (!functionKey || !provider) {
      res.status(400).json({ error: "Choose a known function and provider." });
      return;
    }
    db.prepare(
      "INSERT INTO ai_assignments (function_key, provider_id, enabled) VALUES (?, ?, ?) ON CONFLICT(function_key) DO UPDATE SET provider_id = excluded.provider_id, enabled = excluded.enabled",
    ).run(functionKey, provider.id, req.body.enabled === false ? 0 : 1);
    res.json({ ok: true });
  });

  app.get("/api/admin/plans", (req, res) => {
    if (!requireAdmin(req, res)) return;
    res.json({
      features: FEATURES,
      plans: db.prepare("SELECT * FROM plans ORDER BY sort_order").all().map(publicPlan),
      policy: policy(),
      events: db.prepare("SELECT * FROM billing_events ORDER BY created_at DESC LIMIT 40").all(),
    });
  });

  app.put("/api/admin/plans/:id", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const plan = db.prepare("SELECT * FROM plans WHERE id = ?").get(req.params.id);
    if (!plan) {
      res.status(404).json({ error: "Plan not found." });
      return;
    }
    const current = parse(plan.features, {});
    const features = { ...current };
    for (const feature of FEATURES) {
      if (req.body.features && Object.prototype.hasOwnProperty.call(req.body.features, feature.key)) features[feature.key] = Boolean(req.body.features[feature.key]);
    }
    if (req.body.features && Object.prototype.hasOwnProperty.call(req.body.features, "job_limit")) features.job_limit = Math.max(0, Number(req.body.features.job_limit) || 0);
    db.prepare("UPDATE plans SET name = ?, blurb = ?, monthly_cents = ?, yearly_cents = ?, features = ?, popular = ?, active = ? WHERE id = ?").run(
      String(req.body.name || plan.name),
      String(req.body.blurb ?? plan.blurb),
      Math.max(0, Number(req.body.monthlyCents ?? plan.monthly_cents) || 0),
      Math.max(0, Number(req.body.yearlyCents ?? plan.yearly_cents) || 0),
      JSON.stringify(features),
      req.body.popular ? 1 : 0,
      req.body.active === false ? 0 : 1,
      plan.id,
    );
    res.json({ plan: publicPlan(db.prepare("SELECT * FROM plans WHERE id = ?").get(plan.id)) });
  });

  app.put("/api/admin/billing-policy", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const next = {
      allowUpgrade: Boolean(req.body.allowUpgrade),
      allowDowngrade: Boolean(req.body.allowDowngrade),
      allowProration: Boolean(req.body.allowProration),
      allowRefund: Boolean(req.body.allowRefund),
    };
    db.prepare("INSERT INTO settings (key, value) VALUES ('billing_policy', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(JSON.stringify(next));
    res.json({ policy: next });
  });

  app.get("/api/admin/gateways", (req, res) => {
    if (!requireAdmin(req, res)) return;
    res.json({ gateways: db.prepare("SELECT * FROM payment_gateways ORDER BY created_at").all().map(publicProviderGateway) });
  });

  app.post("/api/admin/gateways", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const kind = ["stripe", "paypal", "manual"].includes(req.body.kind) ? req.body.kind : "";
    const name = String(req.body.name || "").trim();
    if (!kind || name.length < 2) {
      res.status(400).json({ error: "Name and gateway type are required." });
      return;
    }
    const gatewayId = id("gw");
    db.prepare("INSERT INTO payment_gateways (id, name, kind, enabled, public_key, secret_key, mode, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
      gatewayId,
      name,
      kind,
      req.body.enabled ? 1 : 0,
      String(req.body.publicKey || ""),
      String(req.body.secretKey || ""),
      req.body.mode === "live" ? "live" : "test",
      Date.now(),
    );
    res.json({ gateway: publicProviderGateway(db.prepare("SELECT * FROM payment_gateways WHERE id = ?").get(gatewayId)) });
  });

  app.patch("/api/admin/gateways/:id", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const gateway = db.prepare("SELECT * FROM payment_gateways WHERE id = ?").get(req.params.id);
    if (!gateway) {
      res.status(404).json({ error: "Gateway not found." });
      return;
    }
    const secret = req.body.secretKey && !String(req.body.secretKey).startsWith("••••") ? String(req.body.secretKey) : gateway.secret_key;
    db.prepare("UPDATE payment_gateways SET name = ?, enabled = ?, public_key = ?, secret_key = ?, mode = ? WHERE id = ?").run(
      String(req.body.name || gateway.name),
      req.body.enabled ? 1 : 0,
      String(req.body.publicKey ?? gateway.public_key),
      secret,
      req.body.mode === "live" ? "live" : "test",
      gateway.id,
    );
    res.json({ ok: true });
  });

  app.get("/api/admin/jobs", (req, res) => {
    if (!requireAdmin(req, res)) return;
    res.json({
      sources: db.prepare("SELECT * FROM job_sources ORDER BY created_at").all().map((source) => ({ ...source, config: parse(source.config, {}), enabled: Boolean(source.enabled) })),
      jobs: db.prepare("SELECT * FROM jobs ORDER BY created_at DESC LIMIT 100").all().map((job) => ({ ...job, skills: parse(job.skills, []) })),
    });
  });

  app.post("/api/admin/job-sources", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const kind = ["json", "manual"].includes(req.body.kind) ? req.body.kind : "";
    const name = String(req.body.name || "").trim();
    if (!kind || name.length < 2) {
      res.status(400).json({ error: "Name the source and choose JSON feed or manual entry." });
      return;
    }
    db.prepare("INSERT INTO job_sources (id, name, kind, config, enabled, created_at) VALUES (?, ?, ?, ?, 1, ?)").run(
      id("src"),
      name,
      kind,
      JSON.stringify({ url: String(req.body.url || "") }),
      Date.now(),
    );
    res.json({ ok: true });
  });

  app.post("/api/admin/jobs/pull", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const sources = db.prepare("SELECT * FROM job_sources WHERE enabled = 1 AND kind != 'manual'").all();
    const results = [];
    for (const source of sources) {
      try {
        const count = await pullSource(source);
        results.push({ id: source.id, name: source.name, count });
        audit({ functionName: "job_categorize", provider: "pipeline", model: "pull", status: "done", detail: source.name });
      } catch (error) {
        results.push({ id: source.id, name: source.name, error: error instanceof Error ? error.message : "Pull failed" });
      }
    }
    res.json({ results });
  });

  app.post("/api/admin/jobs", async (req, res) => {
    if (!requireAdmin(req, res)) return;
    const title = String(req.body.title || "").trim();
    const company = String(req.body.company || "").trim();
    if (!title || !company) {
      res.status(400).json({ error: "Title and company are required." });
      return;
    }
    let source = db.prepare("SELECT * FROM job_sources WHERE kind = 'manual' LIMIT 1").get();
    if (!source) {
      const sourceId = id("src");
      db.prepare("INSERT INTO job_sources (id, name, kind, config, enabled, created_at) VALUES (?, 'Manual entries', 'manual', '{}', 1, ?)").run(sourceId, Date.now());
      source = db.prepare("SELECT * FROM job_sources WHERE id = ?").get(sourceId);
    }
    const draft = {
      title,
      company,
      location: String(req.body.location || ""),
      description: String(req.body.description || ""),
      skills: String(req.body.skills || "").split(",").map((skill) => skill.trim()).filter(Boolean),
      category: String(req.body.category || ""),
      role: String(req.body.role || ""),
    };
    const checked = await categorizeAndVerify(draft, db.prepare("SELECT id, title, company FROM jobs").all());
    const jobId = saveJob(source.id, { ...draft, remoteType: String(req.body.remoteType || ""), salaryMin: Number(req.body.salaryMin) || null, salaryMax: Number(req.body.salaryMax) || null, sourceUrl: String(req.body.sourceUrl || ""), externalKey: `${company}-${title}-${Date.now()}`, ...checked, note: checked.note });
    res.json({ id: jobId });
  });

  app.get("/api/admin/billing-events", (req, res) => {
    if (!requireAdmin(req, res)) return;
    res.json({ events: db.prepare("SELECT * FROM billing_events ORDER BY created_at DESC LIMIT 50").all() });
  });
}

function publicVersion(row) {
  return { id: row.id, label: row.label, kind: row.kind, active: Boolean(row.active), rendered: row.rendered, createdAt: row.created_at };
}

function publicProvider(row) {
  return { id: row.id, name: row.name, kind: row.kind, model: row.model, enabled: Boolean(row.enabled), apiKey: maskSecret(row.api_key), hasKey: Boolean(row.api_key) };
}

function publicProviderGateway(row) {
  return { id: row.id, name: row.name, kind: row.kind, enabled: Boolean(row.enabled), mode: row.mode, publicKey: row.public_key || "", secretKey: maskSecret(row.secret_key) };
}

function clamp(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(1.35, Math.max(1, number));
}

export { money };
