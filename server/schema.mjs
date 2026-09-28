import { db, id } from "./db.mjs";
import { extractRequirements } from "./match.mjs";

export const SCHEMA_VERSION = 4;

export const AI_FUNCTIONS = [
  { key: "career_extraction", label: "Career extraction", detail: "Reads a resume into a structured profile." },
  { key: "resume_diagnostic", label: "Resume review", detail: "Rates the resume and writes recommendations." },
  { key: "resume_upscale", label: "Resume upscale", detail: "Rewrites accepted recommendations into a new version." },
  { key: "resume_verify", label: "Fact check", detail: "Rejects resume claims that are not in the profile." },
  { key: "job_categorize", label: "Job categorization", detail: "Assigns a category and role to each job." },
  { key: "job_verify", label: "Job verification", detail: "Checks whether a listing looks active, duplicate, or unclear." },
  { key: "job_primary", label: "Primary recruiter", detail: "Finds the hiring company in a feed listing when the poster is an aggregator." },
  { key: "job_match", label: "Job match", detail: "Explains how a job fits the career profile." },
  { key: "image_enhance", label: "Photo enhancement", detail: "Chooses safe contrast, color, and sharpness for a headshot." },
];

export const RESUME_TEMPLATES = [
  { id: "classic", name: "Classic", detail: "Single column with a green accent." },
  { id: "sidebar", name: "Sidebar", detail: "Navy rail for contact and skills." },
  { id: "signal", name: "Signal", detail: "Mint header and open spacing." },
  { id: "executive", name: "Executive", detail: "Centered name and formal rules." },
  { id: "compact", name: "Compact", detail: "Two columns on one page." },
  { id: "bold", name: "Bold", detail: "Dark header and high contrast." },
];

export function templateLimitOf(features) {
  const value = Number(features?.template_limit);
  if (!Number.isFinite(value)) return 2;
  return Math.max(1, Math.min(RESUME_TEMPLATES.length, Math.round(value)));
}

export function resolveTemplate(templateId, limit) {
  const index = RESUME_TEMPLATES.findIndex((item) => item.id === templateId);
  if (index < 0 || index >= limit) return RESUME_TEMPLATES[0].id;
  return RESUME_TEMPLATES[index].id;
}

export const FEATURES = [
  { key: "profile_edit", label: "Edit profile" },
  { key: "resume_review", label: "Resume review" },
  { key: "resume_upscale", label: "Resume upscale and versions" },
  { key: "job_browse", label: "Tailored jobs" },
  { key: "manual_apply", label: "Manual apply" },
  { key: "auto_apply", label: "Auto apply" },
  { key: "public_profile", label: "Public resume link" },
  { key: "image_enhance", label: "Photo enhancement" },
];

const CATALOG = [
  ["Senior Product Manager", "Northstar", "Remote", "remote", 150000, 180000, "Product", "Product Manager", ["Product management", "SQL", "Roadmapping", "A/B testing"], "Own the activation roadmap, partner with design, and use SQL to judge experiments."],
  ["Product Manager", "Harbor", "Houston, TX", "hybrid", 120000, 145000, "Product", "Product Manager", ["Product management", "User research", "Figma"], "Lead discovery and write briefs for a B2B onboarding product."],
  ["Data Analyst", "Lumen", "Austin, TX", "hybrid", 90000, 115000, "Data", "Data Analyst", ["SQL", "Data analysis", "Excel"], "Build dashboards and explain experiment results to product teams."],
  ["Product Designer", "Fieldnote", "Remote", "remote", 110000, 140000, "Design", "Product Designer", ["Figma", "User research"], "Design onboarding flows and test them with customers."],
  ["Software Engineer", "Relay", "Dallas, TX", "onsite", 130000, 160000, "Engineering", "Software Engineer", ["JavaScript", "TypeScript", "React"], "Ship the web app used by operations teams."],
  ["Marketing Manager", "Brightpath", "Remote", "remote", 95000, 120000, "Marketing", "Marketing Manager", ["Marketing", "A/B testing"], "Run lifecycle campaigns and report on conversion."],
  ["Implementation Manager", "Copper", "Houston, TX", "hybrid", 100000, 125000, "Operations", "Implementation Manager", ["Leadership", "Communication"], "Guide customer rollouts and keep projects on schedule."],
  ["Growth Product Manager", "Kindred", "Remote", "remote", 140000, 170000, "Product", "Product Manager", ["Product management", "A/B testing", "SQL", "Data analysis"], "Run the experiment program for a consumer subscription product."],
  ["Recruiter", "Staffing Hub", "Remote", "remote", 70000, 90000, "Operations", "Recruiter", ["Communication"], "Source candidates for contract roles. Third-party staffing firm."],
  ["Analytics Engineer", "Northwind", "Chicago, IL", "hybrid", 125000, 155000, "Data", "Analytics Engineer", ["SQL", "Python", "Data analysis"], "Model product events and keep metric definitions consistent."],
  ["Design Manager", "Paper", "New York, NY", "hybrid", 150000, 185000, "Design", "Design Manager", ["Figma", "Leadership", "User research"], "Lead a small product design group."],
  ["Technical Program Manager", "Atlas", "Remote", "remote", 135000, 165000, "Operations", "Program Manager", ["Leadership", "Roadmapping", "Communication"], "Coordinate engineering and design launches."],
];

function addColumn(table, name, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((column) => column.name === name)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
  }
}

export function migrate() {
  addColumn("users", "plan_id", "TEXT DEFAULT 'free'");
  addColumn("users", "auto_apply", "INTEGER DEFAULT 0");
  addColumn("users", "auto_min", "INTEGER DEFAULT 85");
  addColumn("users", "auto_daily_cap", "INTEGER DEFAULT 5");
  addColumn("users", "password_must_change", "INTEGER DEFAULT 0");
  addColumn("profiles", "headline", "TEXT DEFAULT ''");
  addColumn("profiles", "photo_url", "TEXT DEFAULT ''");
  addColumn("profiles", "slug", "TEXT DEFAULT ''");
  addColumn("profiles", "template", "TEXT DEFAULT 'classic'");
  addColumn("mail_outbox", "status", "TEXT DEFAULT 'stored'");
  addColumn("mail_outbox", "error", "TEXT DEFAULT ''");
  db.exec(`
    CREATE TABLE IF NOT EXISTS ai_providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      model TEXT NOT NULL,
      api_key TEXT DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ai_assignments (
      function_key TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS resume_versions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      label TEXT NOT NULL,
      kind TEXT NOT NULL,
      document TEXT NOT NULL,
      rendered TEXT NOT NULL,
      parent_id TEXT,
      active INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS resume_reviews (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      version_id TEXT NOT NULL,
      rating INTEGER NOT NULL,
      feedback TEXT NOT NULL,
      recommendations TEXT NOT NULL,
      provider TEXT DEFAULT '',
      model TEXT DEFAULT '',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      blurb TEXT DEFAULT '',
      monthly_cents INTEGER NOT NULL,
      yearly_cents INTEGER NOT NULL,
      features TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      popular INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS payment_gateways (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 0,
      public_key TEXT DEFAULT '',
      secret_key TEXT DEFAULT '',
      mode TEXT NOT NULL DEFAULT 'test',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS subscriptions (
      user_id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      gateway_id TEXT DEFAULT '',
      status TEXT NOT NULL,
      period_start INTEGER,
      period_end INTEGER,
      external_id TEXT DEFAULT '',
      cycle TEXT DEFAULT 'monthly'
    );
    CREATE TABLE IF NOT EXISTS billing_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      from_plan TEXT DEFAULT '',
      to_plan TEXT DEFAULT '',
      amount_cents INTEGER NOT NULL DEFAULT 0,
      gateway_id TEXT DEFAULT '',
      note TEXT DEFAULT '',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS checkouts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      gateway_id TEXT NOT NULL,
      cycle TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      credit_cents INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      external_id TEXT DEFAULT '',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS job_sources (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      config TEXT NOT NULL DEFAULT '{}',
      enabled INTEGER NOT NULL DEFAULT 1,
      last_pulled_at INTEGER,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      source_id TEXT DEFAULT '',
      external_key TEXT DEFAULT '',
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      location TEXT DEFAULT '',
      remote_type TEXT DEFAULT '',
      employment_type TEXT DEFAULT 'full-time',
      salary_min INTEGER,
      salary_max INTEGER,
      description TEXT DEFAULT '',
      skills TEXT DEFAULT '[]',
      requirements TEXT DEFAULT '{}',
      category TEXT DEFAULT '',
      role TEXT DEFAULT '',
      source_url TEXT DEFAULT '',
      verification TEXT DEFAULT 'Needs review',
      verification_note TEXT DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      version_id TEXT DEFAULT '',
      mode TEXT NOT NULL,
      status TEXT NOT NULL,
      match_score INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(user_id, job_id)
    );
  `);
  addColumn("jobs", "primary_company", "TEXT DEFAULT ''");
  addColumn("jobs", "primary_url", "TEXT DEFAULT ''");
  addColumn("jobs", "primary_email", "TEXT DEFAULT ''");
  addColumn("jobs", "requirements", "TEXT DEFAULT '{}'");
  addColumn("applications", "target_company", "TEXT DEFAULT ''");
  addColumn("applications", "target_url", "TEXT DEFAULT ''");
  addColumn("applications", "target_email", "TEXT DEFAULT ''");
  addColumn("applications", "delivery", "TEXT DEFAULT ''");
  addColumn("applications", "questions", "TEXT DEFAULT '[]'");

  const provider = db.prepare("SELECT id FROM ai_providers LIMIT 1").get();
  if (!provider) {
    const providerId = id("ai");
    db.prepare(
      "INSERT INTO ai_providers (id, name, kind, model, api_key, enabled, created_at) VALUES (?, 'Built-in rules', 'deterministic', 'rules-v1', '', 1, ?)",
    ).run(providerId, Date.now());
    const assign = db.prepare("INSERT INTO ai_assignments (function_key, provider_id, enabled) VALUES (?, ?, 1)");
    for (const item of AI_FUNCTIONS) assign.run(item.key, providerId);
  }

  if (!db.prepare("SELECT id FROM plans LIMIT 1").get()) {
    const insert = db.prepare(
      "INSERT INTO plans (id, name, blurb, monthly_cents, yearly_cents, features, sort_order, popular, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)",
    );
    const rows = [
      ["free", "Free", "Profile, review, and a short job list.", 0, 0, { profile_edit: true, resume_review: true, resume_upscale: false, job_browse: true, job_limit: 5, manual_apply: false, auto_apply: false, public_profile: true, image_enhance: false, template_limit: 2 }, 1, 0],
      ["starter", "Starter", "Upscale the resume and apply yourself.", 799, 7900, { profile_edit: true, resume_review: true, resume_upscale: true, job_browse: true, job_limit: 15, manual_apply: true, auto_apply: false, public_profile: true, image_enhance: false, template_limit: 3 }, 2, 0],
      ["pro", "Pro", "Every tailored version and the full job list.", 1499, 9900, { profile_edit: true, resume_review: true, resume_upscale: true, job_browse: true, job_limit: 0, manual_apply: true, auto_apply: false, public_profile: true, image_enhance: true, template_limit: 4 }, 3, 1],
      ["autopilot", "Autopilot", "Auto-apply when the match clears your bar.", 2499, 19900, { profile_edit: true, resume_review: true, resume_upscale: true, job_browse: true, job_limit: 0, manual_apply: true, auto_apply: true, public_profile: true, image_enhance: true, template_limit: 6 }, 4, 0],
    ];
    for (const row of rows) insert.run(row[0], row[1], row[2], row[3], row[4], JSON.stringify(row[5]), row[6], row[7]);
  }

  if (!db.prepare("SELECT value FROM settings WHERE key = 'billing_policy'").get()) {
    db.prepare("INSERT INTO settings (key, value) VALUES ('billing_policy', ?)").run(
      JSON.stringify({ allowUpgrade: true, allowDowngrade: true, allowProration: true, allowRefund: false }),
    );
  }

  if (!db.prepare("SELECT id FROM payment_gateways LIMIT 1").get()) {
    db.prepare(
      "INSERT INTO payment_gateways (id, name, kind, enabled, public_key, secret_key, mode, created_at) VALUES (?, 'Manual ledger', 'manual', 1, '', '', 'test', ?)",
    ).run(id("gw"), Date.now());
  }

  if (!db.prepare("SELECT id FROM job_sources LIMIT 1").get()) {
    const sourceId = id("src");
    db.prepare(
      "INSERT INTO job_sources (id, name, kind, config, enabled, created_at) VALUES (?, 'JobPilot catalog', 'catalog', '{}', 1, ?)",
    ).run(sourceId, Date.now());
    const insert = db.prepare(
      `INSERT INTO jobs (id, source_id, external_key, title, company, location, remote_type, employment_type, salary_min, salary_max, description, skills, requirements, category, role, source_url, verification, verification_note, active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'full-time', ?, ?, ?, ?, ?, ?, ?, '', ?, ?, 1, ?)`,
    );
    CATALOG.forEach((job, index) => {
      const staffing = /staffing|recruit/i.test(job[1]);
      const skills = job[8];
      const requirements = extractRequirements({
        title: job[0],
        description: job[9],
        skills,
        role: job[7],
        category: job[6],
      });
      insert.run(
        id("job"),
        sourceId,
        `catalog-${index}`,
        job[0],
        job[1],
        job[2],
        job[3],
        job[4],
        job[5],
        job[9],
        JSON.stringify(skills),
        JSON.stringify(requirements),
        job[6],
        job[7],
        staffing ? "Third-party recruiter" : "Active",
        staffing ? "Company name looks like a staffing firm." : "Listed in the JobPilot catalog.",
        Date.now(),
      );
    });
  }

  const fallbackProvider = db.prepare("SELECT id FROM ai_providers WHERE enabled = 1 ORDER BY created_at LIMIT 1").get();
  if (fallbackProvider) {
    const assignMissing = db.prepare("INSERT INTO ai_assignments (function_key, provider_id, enabled) VALUES (?, ?, 1)");
    for (const item of AI_FUNCTIONS) {
      if (!db.prepare("SELECT function_key FROM ai_assignments WHERE function_key = ?").get(item.key)) {
        assignMissing.run(item.key, fallbackProvider.id);
      }
    }
  }

  for (const job of db.prepare("SELECT id, title, description, skills, role, category, requirements FROM jobs").all()) {
    let needs = false;
    try {
      const parsed = JSON.parse(job.requirements || "{}");
      needs = !parsed || !Array.isArray(parsed.mandatory);
    } catch {
      needs = true;
    }
    if (!needs) continue;
    const skills = (() => {
      try {
        return JSON.parse(job.skills || "[]");
      } catch {
        return [];
      }
    })();
    const requirements = extractRequirements({
      title: job.title,
      description: job.description,
      skills,
      role: job.role,
      category: job.category,
    });
    db.prepare("UPDATE jobs SET requirements = ? WHERE id = ?").run(JSON.stringify(requirements), job.id);
  }

  const templateDefaults = { free: 2, starter: 3, pro: 4, autopilot: 6 };
  for (const plan of db.prepare("SELECT id, features FROM plans").all()) {
    const features = JSON.parse(plan.features || "{}");
    if (features.template_limit == null) {
      features.template_limit = templateDefaults[plan.id] ?? 2;
      db.prepare("UPDATE plans SET features = ? WHERE id = ?").run(JSON.stringify(features), plan.id);
    }
  }

  const versionRow = db.prepare("SELECT version FROM schema_version LIMIT 1").get();
  if (!versionRow) {
    db.prepare("INSERT INTO schema_version (version) VALUES (?)").run(SCHEMA_VERSION);
  } else if (versionRow.version < SCHEMA_VERSION) {
    db.prepare("UPDATE schema_version SET version = ?").run(SCHEMA_VERSION);
  }
}

export function featureLabels(features) {
  const labels = [];
  if (features.profile_edit) labels.push("Editable career profile");
  if (features.resume_review) labels.push("Resume rating and recommendations");
  if (features.resume_upscale) labels.push("Resume versions from accepted edits");
  if (features.job_browse) labels.push(features.job_limit ? `${features.job_limit} tailored jobs` : "Full tailored job list");
  if (features.manual_apply) labels.push("Manual apply");
  if (features.auto_apply) labels.push("Auto apply");
  if (features.public_profile) labels.push("Shareable resume link");
  if (features.image_enhance) labels.push("Headshot enhancement");
  labels.push(`${templateLimitOf(features)} resume template${templateLimitOf(features) === 1 ? "" : "s"}`);
  return labels;
}

export function publicPlan(row) {
  const features = JSON.parse(row.features || "{}");
  return {
    id: row.id,
    name: row.name,
    blurb: row.blurb,
    monthlyCents: row.monthly_cents,
    yearlyCents: row.yearly_cents,
    features,
    featureLabels: featureLabels(features),
    sortOrder: row.sort_order,
    popular: Boolean(row.popular),
    active: Boolean(row.active),
  };
}
