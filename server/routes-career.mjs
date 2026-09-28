/** Career intelligence insights for the authenticated candidate. */

import { db } from "./db.mjs";
import { buildCareerInsights } from "./career-intel.mjs";
import { answerJobCoach } from "./job-coach.mjs";
import { followUpMetrics } from "./follow-ups.mjs";

export function registerCareer(app, ctx) {
  const {
    requireUser,
    requireFeature,
    featuresOf,
    syncProfileVersion,
    activeVersion,
    parse,
  } = ctx;

  function loadInsightContext(user) {
    syncProfileVersion(user.id);
    const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(user.id);
    if (!profile) return null;
    const access = featuresOf(user);
    const version = activeVersion(user.id);
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
    const jobs = db.prepare("SELECT * FROM jobs WHERE active = 1").all().map((job) => ({
      ...job,
      skills: parse(job.skills, []),
      requirements: parse(job.requirements, {}),
    }));
    const applications = db.prepare("SELECT * FROM applications WHERE user_id = ?").all(user.id);
    const skillLimit = access.features.job_limit ? 5 : 10;
    const insights = buildCareerInsights({
      doc,
      preferences,
      jobs,
      applications,
      options: {
        jobLimit: access.features.job_limit || 0,
        skillLimit,
      },
    });
    return {
      profile,
      access,
      doc,
      insights,
      followUps: followUpMetrics(user.id),
    };
  }

  app.get("/api/career/insights", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    if (!requireFeature(user, "job_browse", res)) return;
    const ctxData = loadInsightContext(user);
    if (!ctxData) {
      res.status(400).json({ error: "Upload a resume before opening career insights." });
      return;
    }
    res.json({
      insights: ctxData.insights,
      plan: ctxData.access.plan,
      limited: Boolean(ctxData.access.features.job_limit),
    });
  });

  app.post("/api/career/coach", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    if (!requireFeature(user, "job_browse", res)) return;
    const ctxData = loadInsightContext(user);
    if (!ctxData) {
      res.status(400).json({ error: "Upload a resume before asking the Job Coach." });
      return;
    }
    const question = String(req.body.question || "").slice(0, 500);
    const reply = answerJobCoach({
      question,
      insights: ctxData.insights,
      followUps: ctxData.followUps,
      profileSkills: ctxData.doc.skills || parse(ctxData.profile.skills, []),
    });
    res.json({ question, ...reply });
  });
}
