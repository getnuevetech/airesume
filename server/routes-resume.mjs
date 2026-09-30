/** Resume review, upscale apply, clarification → Fact Ledger, and version activation routes. */

import { db, id } from "./db.mjs";
import { completeJson } from "./ai-run.mjs";
import { reviewQuota } from "./quota.mjs";
import { applyClarificationAnswer, markRecommendationAnswered } from "./upscale-clarify.mjs";
import { applyAcceptedRewrites, mergeUpscaleDocument } from "./resume-upscale.mjs";

export function registerResume(app, ctx) {
  const {
    requireUser,
    requireFeature,
    featuresOf,
    syncProfileVersion,
    activeVersion,
    reviewDocument,
    audit,
    parse,
    setPath,
    renderDocument,
  } = ctx;

  app.post("/api/resume/review", async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    if (!requireFeature(user, "resume_review", res)) return;
    const access = featuresOf(user);
    const quota = reviewQuota(user.id, access.features);
    if (!quota.unlimited && quota.remaining <= 0) {
      res.status(403).json({
        error: `Weekly resume review limit reached (${quota.limit}/week). Resets ${new Date(quota.resetsAt).toISOString().slice(0, 10)}.`,
        reviewQuota: {
          limit: quota.limit,
          used: quota.used,
          remaining: 0,
          unlimited: false,
          resetsAt: quota.resetsAt,
        },
      });
      return;
    }
    syncProfileVersion(user.id);
    const version = activeVersion(user.id);
    if (!version) {
      res.status(400).json({ error: "There is no resume to review yet." });
      return;
    }
    const review = await reviewDocument(user, version);
    audit({
      userId: user.id,
      functionName: "resume_diagnostic",
      provider: review.provider,
      model: review.model,
      status: "ready",
      detail: String(review.rating),
      costMicros: review.costMicros || 0,
    });
    const nextQuota = reviewQuota(user.id, access.features);
    res.json({
      review: {
        id: review.id,
        rating: review.rating,
        feedback: review.feedback,
        recommendations: review.recommendations,
        versionId: review.versionId,
      },
      reviewQuota: {
        limit: nextQuota.limit,
        used: nextQuota.used,
        remaining: nextQuota.unlimited ? null : nextQuota.remaining,
        unlimited: nextQuota.unlimited,
        resetsAt: nextQuota.resetsAt,
      },
    });
  });

  app.post("/api/resume/clarify", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    if (!requireFeature(user, "resume_review", res)) return;
    const review = db.prepare("SELECT * FROM resume_reviews WHERE id = ? AND user_id = ?").get(String(req.body.reviewId || ""), user.id);
    if (!review) {
      res.status(400).json({ error: "Run a review before answering clarifications." });
      return;
    }
    const recommendations = parse(review.recommendations, []);
    const recommendation = recommendations.find((item) => String(item.id) === String(req.body.recommendationId || ""));
    if (!recommendation || (recommendation.kind !== "clarify" && recommendation.kind !== "note")) {
      res.status(400).json({ error: "Choose a clarification from the review." });
      return;
    }
    if (recommendation.answered) {
      res.status(400).json({ error: "That clarification is already saved to the Fact Ledger." });
      return;
    }
    const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(user.id);
    if (!profile) {
      res.status(400).json({ error: "Profile not found." });
      return;
    }
    let result;
    try {
      result = applyClarificationAnswer({
        profile: {
          summary: profile.summary || "",
          skills: parse(profile.skills, []),
          employment: parse(profile.employment, []),
          education: parse(profile.education, []),
        },
        facts: parse(profile.facts, []),
        recommendation: {
          ...recommendation,
          clarifyType: recommendation.clarifyType || (String(recommendation.id || "").includes("skill") ? "skill" : "metric"),
        },
        answer: req.body.answer,
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : "Could not save clarification." });
      return;
    }

    db.prepare(
      "UPDATE profiles SET summary = ?, skills = ?, employment = ?, facts = ?, updated_at = ? WHERE user_id = ?",
    ).run(
      result.profile.summary,
      JSON.stringify(result.profile.skills),
      JSON.stringify(result.profile.employment),
      JSON.stringify(result.facts),
      Date.now(),
      user.id,
    );

    const version = review.version_id
      ? db.prepare("SELECT * FROM resume_versions WHERE id = ? AND user_id = ?").get(review.version_id, user.id)
      : activeVersion(user.id);
    if (version && result.documentPatch?.path) {
      const doc = parse(version.document, {});
      if (setPath(doc, result.documentPatch.path, result.documentPatch.value)) {
        db.prepare("UPDATE resume_versions SET document = ?, rendered = ? WHERE id = ?").run(
          JSON.stringify(doc),
          renderDocument(doc),
          version.id,
        );
      }
    }

    const nextRecommendations = markRecommendationAnswered(recommendations, recommendation.id, req.body.answer);
    db.prepare("UPDATE resume_reviews SET recommendations = ? WHERE id = ?").run(JSON.stringify(nextRecommendations), review.id);
    audit({
      userId: user.id,
      functionName: "resume_clarify",
      provider: "rules",
      model: "fact-ledger",
      status: "stored",
      detail: result.fact.fact_id,
    });
    syncProfileVersion(user.id);
    res.json({
      ok: true,
      fact: result.fact,
      recommendations: nextRecommendations,
      message: "Saved to Fact Ledger. Upscale can now use this verified fact.",
    });
  });

  app.post("/api/resume/apply", async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    if (!requireFeature(user, "resume_upscale", res)) return;
    try {
      const review = db.prepare("SELECT * FROM resume_reviews WHERE id = ? AND user_id = ?").get(String(req.body.reviewId || ""), user.id);
      const version = review
        ? db.prepare("SELECT * FROM resume_versions WHERE id = ? AND user_id = ?").get(review.version_id, user.id)
        : null;
      if (!review || !version) {
        res.status(400).json({ error: "Run a review before applying recommendations." });
        return;
      }
      const selectedIds = Array.isArray(req.body.recommendationIds) ? req.body.recommendationIds.map(String) : [];
      const selected = new Set(selectedIds);
      const recommendations = parse(review.recommendations, []).filter(
        (item) => selected.has(String(item.id)) && item.kind === "rewrite" && item.proposed && item.path,
      );
      if (!recommendations.length) {
        res.status(400).json({
          error: "Select at least one rewrite. Clarifications save to the Fact Ledger first; notes stay guidance-only.",
        });
        return;
      }
      const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(user.id);
      const facts = profile ? parse(profile.facts, []) : [];
      const doc = parse(version.document, {});
      const deterministic = applyAcceptedRewrites(doc, recommendations, facts);
      if (!deterministic.applied.length) {
        if (deterministic.skippedPaths.length && !deterministic.skippedClaims.length) {
          res.status(400).json({
            error: "Those recommendations point at resume lines that are no longer on this version. Run Analyze again, then retry Upscale.",
          });
          return;
        }
        res.status(400).json({
          error:
            "Those recommendations could not be applied without adding unsupported claims. Answer clarifications to add verified numbers to the Fact Ledger first.",
        });
        return;
      }
      const ai = await completeJson(
        "resume_upscale",
        "Rewrite the accepted recommendations into an updated resume JSON. Return strict JSON {document} with the same employers, titles, dates, and bullet counts. Never invent employers, tools, dates, metrics, or contact details.",
        JSON.stringify({ document: doc, accepted: recommendations }).slice(0, 12000),
      );
      const merged = mergeUpscaleDocument(doc, deterministic.document, ai.json?.document, facts);
      const label = `Upscale ${db.prepare("SELECT COUNT(*) AS count FROM resume_versions WHERE user_id = ? AND kind = 'upscale'").get(user.id).count + 1}`;
      const versionId = id("ver");
      const rendered = renderDocument(merged.document);
      db.prepare(
        `INSERT INTO resume_versions (id, user_id, label, kind, document, rendered, parent_id, active, created_at)
         VALUES (?, ?, ?, 'upscale', ?, ?, ?, 0, ?)`,
      ).run(versionId, user.id, label, JSON.stringify(merged.document), rendered, version.id, Date.now());
      audit({
        userId: user.id,
        functionName: "resume_upscale",
        provider: ai.provider || "Built-in rules",
        model: ai.model || "rules-v1",
        status: "version",
        detail: versionId,
        costMicros: ai.costMicros || 0,
      });
      res.json({
        versionId,
        label,
        rendered,
        applied: deterministic.applied,
        changes: merged.changes,
        skippedClaims: deterministic.skippedClaims,
        skippedPaths: deterministic.skippedPaths,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : "Could not create the Upscale version.",
      });
    }
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
}
