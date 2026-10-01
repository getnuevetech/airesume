/** Follow-up reminder routes for the candidate tracker. */

import { recordApplicationCheck } from "./application-check.mjs";
import { db } from "./db.mjs";
import {
  ensureFollowUpReminder,
  followUpMetrics,
  listFollowUpReminders,
  syncFollowUpsForUser,
  updateFollowUpReminder,
} from "./follow-ups.mjs";

export function registerFollowUps(app, ctx) {
  const { requireUser, requireFeature } = ctx;

  app.get("/api/follow-ups", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    if (!requireFeature(user, "manual_apply", res)) return;
    const applications = db.prepare("SELECT * FROM applications WHERE user_id = ?").all(user.id);
    const jobs = db.prepare("SELECT id, title, company, primary_company FROM jobs").all();
    const jobsById = new Map(jobs.map((job) => [job.id, job]));
    syncFollowUpsForUser(user.id, applications, jobsById);
    const includeDone = String(req.query.includeDone || "") === "1";
    res.json({
      reminders: listFollowUpReminders(user.id, { includeDone }),
      metrics: followUpMetrics(user.id),
    });
  });

  app.post("/api/applications/:id/follow-ups", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    if (!requireFeature(user, "manual_apply", res)) return;
    const row = db.prepare("SELECT * FROM applications WHERE id = ? AND user_id = ?").get(req.params.id, user.id);
    if (!row) {
      res.status(404).json({ error: "Application not found." });
      return;
    }
    const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(row.job_id);
    const reminder = ensureFollowUpReminder({
      userId: user.id,
      applicationId: row.id,
      status: String(req.body.status || row.status),
      company: row.target_company || job?.primary_company || job?.company || "",
      title: job?.title || "",
    });
    if (!reminder) {
      res.status(400).json({ error: "No follow-up template for that application status." });
      return;
    }
    res.json({ reminder, metrics: followUpMetrics(user.id) });
  });

  app.post("/api/follow-ups/:id/check-in", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    if (!requireFeature(user, "manual_apply", res)) return;
    try {
      const result = recordApplicationCheck({
        userId: user.id,
        reminderId: req.params.id,
        answer: req.body?.answer,
      });
      if (result.error) {
        res.status(400).json({ error: result.error });
        return;
      }
      res.json({ ...result, metrics: followUpMetrics(user.id) });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Could not save that check-in." });
    }
  });

  app.post("/api/follow-ups/:id/:action", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    if (!requireFeature(user, "manual_apply", res)) return;
    const result = updateFollowUpReminder(user.id, req.params.id, req.params.action, {
      snoozeDays: req.body?.snoozeDays,
    });
    if (result.error) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ reminder: result.reminder, metrics: followUpMetrics(user.id) });
  });
}
