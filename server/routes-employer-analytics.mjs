/** Employer analytics and SLA routes. */

import { db } from "./db.mjs";
import {
  DEFAULT_SLA,
  buildEmployerAnalytics,
  buildEmployerInsights,
  findSlaBreaches,
  normalizeSlaSettings,
} from "./employer-analytics.mjs";

function loadSla(employerUserId) {
  const row = db.prepare("SELECT * FROM employer_sla_settings WHERE employer_user_id = ?").get(employerUserId);
  if (!row) return { ...DEFAULT_SLA, updatedAt: null };
  return {
    ...normalizeSlaSettings(row),
    updatedAt: row.updated_at || null,
  };
}

function publicCandidateName(candidateUserId) {
  const row = db.prepare("SELECT name FROM users WHERE id = ?").get(candidateUserId);
  return row?.name || "Candidate";
}

export function registerEmployerAnalytics(app, ctx) {
  const { requireUser } = ctx;

  function requireEmployer(req, res) {
    const user = requireUser(req, res);
    if (!user) return null;
    if (user.role !== "employer") {
      res.status(403).json({ error: "Employer access required." });
      return null;
    }
    return user;
  }

  app.get("/api/employer/analytics", (req, res) => {
    const user = requireEmployer(req, res);
    if (!user) return;
    const now = Date.now();
    const pipeline = db.prepare("SELECT * FROM employer_pipeline WHERE employer_user_id = ?").all(user.id);
    const invites = db.prepare("SELECT * FROM employer_invites WHERE employer_user_id = ?").all(user.id);
    const postings = db.prepare("SELECT * FROM employer_postings WHERE employer_user_id = ?").all(user.id);
    const rooms = db.prepare("SELECT * FROM interview_rooms WHERE employer_user_id = ?").all(user.id);
    const voiceSessions = db.prepare("SELECT * FROM employer_voice_sessions WHERE employer_user_id = ?").all(user.id);
    const sla = loadSla(user.id);
    const analytics = buildEmployerAnalytics({ pipeline, invites, postings, rooms, voiceSessions, now });
    const breaches = findSlaBreaches({ pipeline, invites, rooms, voiceSessions, sla, now }).map((item) => ({
      ...item,
      candidateName: item.candidateUserId ? publicCandidateName(item.candidateUserId) : "",
    }));
    res.json({
      analytics,
      sla,
      breaches,
      insights: buildEmployerInsights(analytics, breaches),
    });
  });

  app.get("/api/employer/sla", (req, res) => {
    const user = requireEmployer(req, res);
    if (!user) return;
    res.json({ sla: loadSla(user.id), defaults: DEFAULT_SLA });
  });

  app.put("/api/employer/sla", (req, res) => {
    const user = requireEmployer(req, res);
    if (!user) return;
    const sla = normalizeSlaSettings(req.body || {});
    const now = Date.now();
    const existing = db.prepare("SELECT employer_user_id FROM employer_sla_settings WHERE employer_user_id = ?").get(user.id);
    if (existing) {
      db.prepare(
        `UPDATE employer_sla_settings
         SET review_hours = ?, invite_hours = ?, interview_hours = ?, updated_at = ?
         WHERE employer_user_id = ?`,
      ).run(sla.reviewHours, sla.inviteHours, sla.interviewHours, now, user.id);
    } else {
      db.prepare(
        `INSERT INTO employer_sla_settings (employer_user_id, review_hours, invite_hours, interview_hours, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).run(user.id, sla.reviewHours, sla.inviteHours, sla.interviewHours, now);
    }
    res.json({ sla: loadSla(user.id) });
  });
}
