/** Application tracker, paste-a-job, and autopilot queue routes. */

import { db, id } from "./db.mjs";
import { matchJob } from "./match.mjs";
import { TRACKER_STATUSES, autoDecision } from "./apply-rules.mjs";
import { fetchJobUrl, parseJobPaste } from "./job-import.mjs";

export function registerApplications(app, ctx) {
  const {
    requireUser,
    requireFeature,
    featuresOf,
    createApplication,
    activeVersion,
    parse,
    categorizeAndVerify,
    saveJob,
    employerDelivery,
    autoCapUsed,
    canAutoApply,
  } = ctx;

  app.post("/api/applications", async (req, res) => {
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
    const action = String(req.body.action || "prepare");
    const status =
      action === "track" ? "Found" : action === "skip" ? "Skipped" : action === "apply" ? "Applied" : "Ready";
    const result = await createApplication(
      user,
      job,
      "manual",
      parse(version.document, {}),
      parse(profile.preferences, {}),
      parse(profile.facts, []),
      { status, deliver: status === "Applied" },
    );
    res.json({ ok: true, score: result.score, status: result.status, questions: result.questions });
  });

  app.post("/api/jobs/paste", async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    if (!requireFeature(user, "job_browse", res)) return;
    try {
      let text = String(req.body.text || "");
      let sourceUrl = String(req.body.url || "").trim();
      if (sourceUrl) {
        const fetched = await fetchJobUrl(sourceUrl);
        sourceUrl = fetched.url;
        text = text ? `${text}\n\n${fetched.text}` : fetched.text;
      }
      const draft = parseJobPaste({
        text,
        url: sourceUrl,
        title: req.body.title,
        company: req.body.company,
        location: req.body.location,
      });
      let source = db.prepare("SELECT * FROM job_sources WHERE kind = 'paste' LIMIT 1").get();
      if (!source) {
        const sourceId = id("src");
        db.prepare(
          "INSERT INTO job_sources (id, name, kind, config, enabled, created_at) VALUES (?, 'Pasted jobs', 'paste', '{}', 1, ?)",
        ).run(sourceId, Date.now());
        source = db.prepare("SELECT * FROM job_sources WHERE id = ?").get(sourceId);
      }
      const siblings = db.prepare("SELECT id, title, company FROM jobs").all();
      const checked = await categorizeAndVerify(draft, siblings);
      const jobId = saveJob(source.id, {
        ...draft,
        externalKey: `paste-${user.id}-${Date.now()}`,
        category: checked.category,
        role: checked.role || draft.role,
        verification: checked.verification,
        note: checked.note,
        primaryCompany: draft.company,
        primaryUrl: draft.sourceUrl || "",
      });
      const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(user.id);
      const version = profile ? activeVersion(user.id) : null;
      const doc = version ? parse(version.document, {}) : { skills: [], employment: [], education: [] };
      const preferences = profile ? parse(profile.preferences, {}) : {};
      const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId);
      const match = matchJob(doc, preferences, job);
      const action = String(req.body.action || "");
      const track = action === "prepare" || action === "track";
      let application = null;
      const access = featuresOf(user);
      if (track && profile && version && access.features.manual_apply) {
        const status = action === "track" ? "Found" : "Ready";
        application = await createApplication(user, job, "manual", doc, preferences, parse(profile.facts, []), {
          status,
          deliver: false,
        });
      }
      res.json({
        job: {
          id: job.id,
          title: job.title,
          company: job.company,
          location: job.location,
          remoteType: job.remote_type,
          description: job.description,
          skills: parse(job.skills, []),
          requirements: parse(job.requirements, {}),
          verification: job.verification,
          sourceUrl: job.source_url,
          score: match.score,
          label: match.label,
          explanation: match.explanation,
          matched: match.matched,
          missing: match.missing,
        },
        application,
      });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Could not import that job." });
    }
  });

  app.put("/api/applications/:id/questions", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const row = db.prepare("SELECT * FROM applications WHERE id = ? AND user_id = ?").get(req.params.id, user.id);
    if (!row) {
      res.status(404).json({ error: "Application not found." });
      return;
    }
    const incoming = Array.isArray(req.body.questions) ? req.body.questions : [];
    const current = parse(row.questions, []);
    const byId = new Map(current.map((item) => [item.id, item]));
    const next = incoming.map((item, index) => {
      const id = String(item.id || `custom-${index}`);
      const prev = byId.get(id) || {};
      const prompt = String(item.prompt || prev.prompt || "").trim();
      if (!prompt) return null;
      const sensitive = /salary|compensation|disability|veteran|race|gender|sponsor|authorization|criminal/i.test(prompt);
      return {
        id,
        prompt,
        kind: item.kind === "draft" || item.kind === "user" ? item.kind : prev.kind || "user",
        answer: String(item.answer ?? prev.answer ?? ""),
        blankReason: String(item.blankReason || prev.blankReason || (sensitive && !String(item.answer || "") ? "Sensitive — fill this yourself." : "")),
        hint: String(item.hint || prev.hint || ""),
        source: String(prev.source || item.source || "user"),
      };
    }).filter(Boolean);
    db.prepare("UPDATE applications SET questions = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(next), Date.now(), row.id);
    res.json({ questions: next });
  });

  app.post("/api/applications/:id/submit", async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const access = featuresOf(user);
    if (!access.features.manual_apply && !access.features.auto_apply) {
      res.status(403).json({ error: "Submitting applications is not on your plan." });
      return;
    }
    const row = db.prepare("SELECT * FROM applications WHERE id = ? AND user_id = ?").get(req.params.id, user.id);
    if (!row) {
      res.status(404).json({ error: "Application not found." });
      return;
    }
    if (!["Ready", "Review required", "Resume preparing"].includes(row.status)) {
      res.status(400).json({ error: "Only ready or review-required applications can be submitted." });
      return;
    }
    const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(row.job_id);
    const version = row.version_id
      ? db.prepare("SELECT * FROM resume_versions WHERE id = ? AND user_id = ?").get(row.version_id, user.id)
      : null;
    if (!job || !version) {
      res.status(400).json({ error: "Prepare a tailored resume before submitting." });
      return;
    }
    const delivery = await employerDelivery(user, job, version.rendered || "");
    db.prepare("UPDATE applications SET status = 'Applied', delivery = ?, updated_at = ? WHERE id = ?").run(delivery, Date.now(), row.id);
    res.json({ ok: true, status: "Applied", delivery });
  });

  app.post("/api/applications/auto", async (req, res) => {
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
    const facts = parse(profile.facts, []);
    const existing = new Set(db.prepare("SELECT job_id FROM applications WHERE user_id = ?").all(user.id).map((item) => item.job_id));
    const dailyCap = Math.max(1, Math.min(25, Number(user.auto_daily_cap ?? 5) || 5));
    let used = autoCapUsed(user.id);
    const summary = { ready: 0, reviewRequired: 0, skipped: 0, capped: false };
    const candidates = db
      .prepare("SELECT * FROM jobs WHERE active = 1")
      .all()
      .filter((job) => !existing.has(job.id))
      .map((job) => ({ job, ...matchJob(doc, preferences, job) }))
      .sort((a, b) => b.score - a.score);

    for (const item of candidates) {
      if (used >= dailyCap) {
        summary.capped = true;
        break;
      }
      let decision = autoDecision(item.job, item, preferences, user);
      if (decision.action === "skip") {
        summary.skipped += 1;
        continue;
      }
      if (decision.action === "ready" && !canAutoApply(item.job)) {
        decision = { action: "review", reason: "Listing is not cleared for autopilot submit." };
      }
      const status = decision.action === "ready" ? "Ready" : "Review required";
      await createApplication(user, item.job, "auto", doc, preferences, facts, {
        status,
        deliver: false,
        reason: decision.reason,
      });
      used += 1;
      if (status === "Ready") summary.ready += 1;
      else summary.reviewRequired += 1;
    }
    res.json({ ...summary, applied: 0, queued: summary.ready + summary.reviewRequired });
  });

  app.patch("/api/applications/:id", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const status = TRACKER_STATUSES.includes(req.body.status) ? req.body.status : "";
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
    const dailyCap = Math.max(1, Math.min(25, Number(req.body.dailyCap) || user.auto_daily_cap || 5));
    db.prepare("UPDATE users SET auto_apply = ?, auto_min = ?, auto_daily_cap = ? WHERE id = ?").run(
      req.body.enabled ? 1 : 0,
      minMatch,
      dailyCap,
      user.id,
    );
    const profile = db.prepare("SELECT preferences FROM profiles WHERE user_id = ?").get(user.id);
    if (profile) {
      const preferences = {
        ...parse(profile.preferences, {}),
        excludeCompanies: String(req.body.excludeCompanies || ""),
        excludeKeywords: String(req.body.excludeKeywords || ""),
      };
      db.prepare("UPDATE profiles SET preferences = ?, updated_at = ? WHERE user_id = ?").run(JSON.stringify(preferences), Date.now(), user.id);
    }
    res.json({ ok: true });
  });
}
