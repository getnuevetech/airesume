/** Employer account, candidate search, and hiring pipeline routes. */

import { db, id, hashPassword, publicUser } from "./db.mjs";
import { searchCandidates } from "./employer-search.mjs";
import {
  PIPELINE_STATUSES,
  canTransition,
  normalizePipelineStatus,
  publicPipelineEntry,
  sortPipeline,
  summarizePipeline,
} from "./employer-pipeline.mjs";

function publicEmployer(row) {
  if (!row) return null;
  return {
    companyName: row.company_name || "",
    website: row.website || "",
    blurb: row.blurb || "",
    updatedAt: row.updated_at || null,
  };
}

function candidateIsPublic(candidateUserId) {
  const row = db
    .prepare(
      `SELECT profiles.user_id, profiles.slug, users.status, users.role, plans.features AS plan_features
       FROM profiles
       JOIN users ON users.id = profiles.user_id
       LEFT JOIN plans ON plans.id = COALESCE(users.plan_id, 'free')
       WHERE profiles.user_id = ?`,
    )
    .get(candidateUserId);
  if (!row || row.role !== "user" || row.status !== "active" || !row.slug) return null;
  let features = {};
  try {
    features = JSON.parse(row.plan_features || "{}");
  } catch {
    features = {};
  }
  if (features.public_profile === false) return null;
  return row;
}

function loadPipelineRow(employerUserId, pipelineId) {
  return db
    .prepare(
      `SELECT employer_pipeline.*, profiles.slug, profiles.headline, profiles.summary, profiles.skills,
              profiles.photo_url, profiles.preferences, users.name, users.email, users.phone, users.city
       FROM employer_pipeline
       JOIN users ON users.id = employer_pipeline.candidate_user_id
       JOIN profiles ON profiles.user_id = employer_pipeline.candidate_user_id
       WHERE employer_pipeline.id = ? AND employer_pipeline.employer_user_id = ?`,
    )
    .get(pipelineId, employerUserId);
}

export function registerEmployer(app, ctx) {
  const { requireUser, setSession } = ctx;

  function requireEmployer(req, res) {
    const user = requireUser(req, res);
    if (!user) return null;
    if (user.role !== "employer") {
      res.status(403).json({ error: "Employer access required." });
      return null;
    }
    return user;
  }

  app.post("/api/employer/register", (req, res) => {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const companyName = String(req.body.companyName || "").trim();
    if (name.length < 2 || !email.includes("@") || password.length < 8 || companyName.length < 2) {
      res.status(400).json({ error: "Name, work email, company, and an 8+ character password are required." });
      return;
    }
    if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
      res.status(409).json({ error: "That email already has an account. Sign in instead." });
      return;
    }
    const userId = id("usr");
    const now = Date.now();
    db.prepare(
      `INSERT INTO users (id, name, email, password_hash, provider, role, status, consent_at, created_at, plan_id)
       VALUES (?, ?, ?, ?, 'email', 'employer', 'active', ?, ?, 'free')`,
    ).run(userId, name, email, hashPassword(password), now, now);
    db.prepare(
      `INSERT INTO employer_profiles (user_id, company_name, website, blurb, updated_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(userId, companyName, String(req.body.website || "").trim(), String(req.body.blurb || "").trim(), now);
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    if (setSession) setSession(res, user.id, req);
    res.json({
      user: publicUser(user),
      employer: publicEmployer(db.prepare("SELECT * FROM employer_profiles WHERE user_id = ?").get(userId)),
    });
  });

  app.get("/api/employer/me", (req, res) => {
    const user = requireEmployer(req, res);
    if (!user) return;
    let profile = db.prepare("SELECT * FROM employer_profiles WHERE user_id = ?").get(user.id);
    if (!profile) {
      db.prepare(
        `INSERT INTO employer_profiles (user_id, company_name, website, blurb, updated_at)
         VALUES (?, ?, '', '', ?)`,
      ).run(user.id, user.name || "Company", Date.now());
      profile = db.prepare("SELECT * FROM employer_profiles WHERE user_id = ?").get(user.id);
    }
    res.json({ user: publicUser(user), employer: publicEmployer(profile) });
  });

  app.put("/api/employer/profile", (req, res) => {
    const user = requireEmployer(req, res);
    if (!user) return;
    const companyName = String(req.body.companyName || "").trim();
    if (companyName.length < 2) {
      res.status(400).json({ error: "Company name is required." });
      return;
    }
    const website = String(req.body.website || "").trim();
    const blurb = String(req.body.blurb || "").trim().slice(0, 500);
    const name = String(req.body.name || user.name).trim() || user.name;
    db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name, user.id);
    const existing = db.prepare("SELECT user_id FROM employer_profiles WHERE user_id = ?").get(user.id);
    if (existing) {
      db.prepare(
        "UPDATE employer_profiles SET company_name = ?, website = ?, blurb = ?, updated_at = ? WHERE user_id = ?",
      ).run(companyName, website, blurb, Date.now(), user.id);
    } else {
      db.prepare(
        `INSERT INTO employer_profiles (user_id, company_name, website, blurb, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(user.id, companyName, website, blurb, Date.now());
    }
    res.json({
      user: publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(user.id)),
      employer: publicEmployer(db.prepare("SELECT * FROM employer_profiles WHERE user_id = ?").get(user.id)),
    });
  });

  app.get("/api/employer/candidates", (req, res) => {
    const user = requireEmployer(req, res);
    if (!user) return;
    const rows = db
      .prepare(
        `SELECT profiles.user_id, profiles.slug, profiles.headline, profiles.summary, profiles.skills,
                profiles.photo_url, profiles.preferences, users.name, users.email, users.phone, users.city,
                users.status, plans.features AS plan_features
         FROM profiles
         JOIN users ON users.id = profiles.user_id
         LEFT JOIN plans ON plans.id = COALESCE(users.plan_id, 'free')
         WHERE users.role = 'user' AND users.status = 'active' AND profiles.slug != ''`,
      )
      .all();
    const candidates = searchCandidates(rows, {
      q: req.query.q,
      skill: req.query.skill,
      city: req.query.city,
      limit: req.query.limit,
    });
    const saved = new Set(
      db
        .prepare("SELECT candidate_user_id FROM employer_pipeline WHERE employer_user_id = ?")
        .all(user.id)
        .map((row) => row.candidate_user_id),
    );
    res.json({
      candidates: candidates.map((person) => ({ ...person, saved: saved.has(person.userId) })),
      total: candidates.length,
      statuses: PIPELINE_STATUSES,
    });
  });

  app.get("/api/employer/pipeline", (req, res) => {
    const user = requireEmployer(req, res);
    if (!user) return;
    const statusFilter = req.query.status ? normalizePipelineStatus(req.query.status, "") : "";
    const rows = db
      .prepare(
        `SELECT employer_pipeline.*, profiles.slug, profiles.headline, profiles.summary, profiles.skills,
                profiles.photo_url, profiles.preferences, users.name, users.email, users.phone, users.city
         FROM employer_pipeline
         JOIN users ON users.id = employer_pipeline.candidate_user_id
         JOIN profiles ON profiles.user_id = employer_pipeline.candidate_user_id
         WHERE employer_pipeline.employer_user_id = ?
         ORDER BY employer_pipeline.updated_at DESC`,
      )
      .all(user.id)
      .map(publicPipelineEntry)
      .filter(Boolean);
    const filtered = statusFilter ? rows.filter((row) => row.status === statusFilter) : rows;
    const entries = sortPipeline(filtered);
    res.json({
      entries,
      summary: summarizePipeline(rows),
      statuses: PIPELINE_STATUSES,
    });
  });

  app.post("/api/employer/pipeline", (req, res) => {
    const user = requireEmployer(req, res);
    if (!user) return;
    const candidateUserId = String(req.body.candidateUserId || "").trim();
    if (!candidateUserId) {
      res.status(400).json({ error: "candidateUserId is required." });
      return;
    }
    if (!candidateIsPublic(candidateUserId)) {
      res.status(400).json({ error: "Only public candidate profiles can be saved to the pipeline." });
      return;
    }
    const existing = db
      .prepare("SELECT id FROM employer_pipeline WHERE employer_user_id = ? AND candidate_user_id = ?")
      .get(user.id, candidateUserId);
    if (existing) {
      const row = loadPipelineRow(user.id, existing.id);
      res.json({ entry: publicPipelineEntry(row), created: false });
      return;
    }
    const now = Date.now();
    const entryId = id("pipe");
    const status = normalizePipelineStatus(req.body.status, "Saved");
    const roleTitle = String(req.body.roleTitle || "").trim().slice(0, 120);
    const notes = String(req.body.notes || "").trim().slice(0, 2000);
    db.prepare(
      `INSERT INTO employer_pipeline
        (id, employer_user_id, candidate_user_id, status, role_title, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(entryId, user.id, candidateUserId, status, roleTitle, notes, now, now);
    res.json({ entry: publicPipelineEntry(loadPipelineRow(user.id, entryId)), created: true });
  });

  app.put("/api/employer/pipeline/:id", (req, res) => {
    const user = requireEmployer(req, res);
    if (!user) return;
    const current = db
      .prepare("SELECT * FROM employer_pipeline WHERE id = ? AND employer_user_id = ?")
      .get(req.params.id, user.id);
    if (!current) {
      res.status(404).json({ error: "Pipeline entry not found." });
      return;
    }
    const nextStatus = req.body.status != null ? normalizePipelineStatus(req.body.status, current.status) : current.status;
    if (!canTransition(current.status, nextStatus)) {
      res.status(400).json({ error: `Cannot move from ${current.status} to ${nextStatus}.` });
      return;
    }
    const roleTitle =
      req.body.roleTitle != null ? String(req.body.roleTitle || "").trim().slice(0, 120) : current.role_title || "";
    const notes = req.body.notes != null ? String(req.body.notes || "").trim().slice(0, 2000) : current.notes || "";
    db.prepare(
      "UPDATE employer_pipeline SET status = ?, role_title = ?, notes = ?, updated_at = ? WHERE id = ?",
    ).run(nextStatus, roleTitle, notes, Date.now(), current.id);
    res.json({ entry: publicPipelineEntry(loadPipelineRow(user.id, current.id)) });
  });

  app.delete("/api/employer/pipeline/:id", (req, res) => {
    const user = requireEmployer(req, res);
    if (!user) return;
    const current = db
      .prepare("SELECT id FROM employer_pipeline WHERE id = ? AND employer_user_id = ?")
      .get(req.params.id, user.id);
    if (!current) {
      res.status(404).json({ error: "Pipeline entry not found." });
      return;
    }
    db.prepare("DELETE FROM employer_pipeline WHERE id = ?").run(current.id);
    res.json({ ok: true });
  });
}
