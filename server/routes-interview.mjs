/** Interview prep routes for tracked applications. */

import { db } from "./db.mjs";
import { matchJob } from "./match.mjs";
import { buildInterviewPrep } from "./interview-prep.mjs";

const PREP_STATUSES = ["Ready", "Review required", "Applied", "Responded", "Interview", "Offer"];

export function registerInterview(app, ctx) {
  const {
    requireUser,
    requireFeature,
    syncProfileVersion,
    activeVersion,
    parse,
  } = ctx;

  app.get("/api/applications/:id/interview-prep", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    if (!requireFeature(user, "job_browse", res)) return;
    const row = db.prepare("SELECT * FROM applications WHERE id = ? AND user_id = ?").get(req.params.id, user.id);
    if (!row) {
      res.status(404).json({ error: "Application not found." });
      return;
    }
    if (!PREP_STATUSES.includes(row.status)) {
      res.status(400).json({ error: "Interview prep unlocks once an application is Ready, Applied, or further along." });
      return;
    }
    syncProfileVersion(user.id);
    const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(user.id);
    const version = row.version_id
      ? db.prepare("SELECT * FROM resume_versions WHERE id = ? AND user_id = ?").get(row.version_id, user.id)
      : activeVersion(user.id);
    const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(row.job_id);
    if (!profile || !job) {
      res.status(400).json({ error: "A profile and job are required for interview prep." });
      return;
    }
    const doc = version
      ? parse(version.document, {})
      : {
          skills: parse(profile.skills, []),
          employment: parse(profile.employment, []),
          education: parse(profile.education, []),
          summary: profile.summary || "",
          headline: profile.headline || "",
        };
    const preferences = parse(profile.preferences, {});
    const match = matchJob(doc, preferences, {
      ...job,
      skills: parse(job.skills, []),
      requirements: parse(job.requirements, {}),
    });
    const prep = buildInterviewPrep({
      job,
      doc,
      match,
      application: row,
    });
    res.json({ prep });
  });
}
