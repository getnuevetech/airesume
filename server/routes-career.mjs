/** Career intelligence insights for the authenticated candidate. */

import { db } from "./db.mjs";
import { buildCareerInsights } from "./career-intel.mjs";
import { confirmInsightGap, confirmListedSkill, confirmedSkillMessage } from "./confirm-skill.mjs";
import { storeConfirmedSkill } from "./confirm-skill-store.mjs";
import { answerJobCoach } from "./job-coach.mjs";
import { followUpMetrics } from "./follow-ups.mjs";
import { recordAccount } from "./user-activity.mjs";

export function registerCareer(app, ctx) {
  const {
    requireUser,
    requireFeature,
    featuresOf,
    syncProfileVersion,
    activeVersion,
    parse,
    renderDocument,
    audit,
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

  app.post("/api/career/confirm-skill", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    if (!requireFeature(user, "job_browse", res)) return;
    if (!requireFeature(user, "profile_edit", res)) return;
    const loaded = loadInsightContext(user);
    const version = loaded ? activeVersion(user.id) : null;
    if (!loaded || !version) {
      res.status(400).json({ error: "Upload a resume before confirming a skill." });
      return;
    }
    let canonical = "";
    try {
      canonical = confirmInsightGap({ gaps: loaded.insights.gaps, skill: req.body?.skill });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Could not confirm that skill." });
      return;
    }
    let result;
    try {
      result = confirmListedSkill({
        profile: {
          summary: loaded.profile.summary || "",
          skills: parse(loaded.profile.skills, []),
          employment: parse(loaded.profile.employment, []),
          education: parse(loaded.profile.education, []),
        },
        facts: parse(loaded.profile.facts, []),
        document: loaded.doc,
        missing: [canonical],
        skill: canonical,
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Could not confirm that skill." });
      return;
    }
    const preferences = parse(loaded.profile.preferences, {});
    const stored = result.already
      ? { prepared: 0, jobIds: [] }
      : storeConfirmedSkill({
          userId: user.id,
          result,
          preferences,
          versionId: version.id,
          renderDocument,
        });
    if (!result.already) {
      recordAccount(user.id, "skill", `Confirmed ${result.skill}.`);
      audit?.({
        userId: user.id,
        functionName: "confirm_skill",
        provider: "rules",
        model: "fact-ledger",
        status: "stored",
        detail: result.fact?.fact_id || result.skill,
      });
    }
    res.json({
      ok: true,
      already: Boolean(result.already),
      prepared: stored.prepared,
      skill: result.skill,
      message: confirmedSkillMessage({
        already: result.already,
        skill: result.skill,
        prepared: stored.prepared,
        preparedThisJob: false,
      }),
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
