/** Employer account and candidate search routes. */

import { db, id, hashPassword, publicUser } from "./db.mjs";
import { searchCandidates } from "./employer-search.mjs";

function publicEmployer(row) {
  if (!row) return null;
  return {
    companyName: row.company_name || "",
    website: row.website || "",
    blurb: row.blurb || "",
    updatedAt: row.updated_at || null,
  };
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
    res.json({ candidates, total: candidates.length });
  });
}
