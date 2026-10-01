/** Browser extension token management and job capture routes. */

import { db, id } from "./db.mjs";
import { matchJob } from "./match.mjs";
import { buildApplyKit } from "./apply-kit.mjs";
import { applyKitMetrics, recordApplyKitEvent } from "./apply-kit-metrics.mjs";
import { recordSubmission } from "./application-check.mjs";
import {
  createExtensionToken,
  listExtensionTokens,
  normalizeExtensionCapture,
  resolveExtensionUser,
  revokeExtensionToken,
} from "./extension-tokens.mjs";
import { rateLimit } from "./security.mjs";
import { holdJobDraft, reviewJobIntake } from "./job-intake.mjs";

function bearerToken(req) {
  const header = String(req.headers.authorization || "");
  if (header.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  return String(req.headers["x-jobpilot-token"] || req.body?.token || "").trim();
}

export function registerExtension(app, ctx) {
  const {
    requireUser,
    requireFeature,
    featuresOf,
    createApplication,
    activeVersion,
    parse,
    categorizeAndVerify,
    saveJob,
  } = ctx;

  app.get("/api/extension/tokens", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    if (!requireFeature(user, "manual_apply", res)) return;
    res.json({ tokens: listExtensionTokens(user.id) });
  });

  app.post("/api/extension/tokens", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    if (!requireFeature(user, "manual_apply", res)) return;
    const limited = rateLimit(req, { key: "ext-token", limit: 10, windowMs: 60_000 });
    if (limited.limited) {
      res.status(429).json({ error: "Too many token requests. Try again shortly." });
      return;
    }
    const active = listExtensionTokens(user.id).filter((item) => item.active);
    if (active.length >= 5) {
      res.status(400).json({ error: "Revoke an unused extension token before creating another (max 5)." });
      return;
    }
    const created = createExtensionToken(user.id, req.body?.label);
    res.json({
      token: created,
      note: "Copy this token now. JobPilot only stores a hash and will not show the full value again.",
    });
  });

  app.delete("/api/extension/tokens/:id", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    if (!requireFeature(user, "manual_apply", res)) return;
    const ok = revokeExtensionToken(user.id, req.params.id);
    if (!ok) {
      res.status(404).json({ error: "Token not found or already revoked." });
      return;
    }
    res.json({ ok: true, tokens: listExtensionTokens(user.id) });
  });

  app.post("/api/extension/capture", async (req, res) => {
    const limited = rateLimit(req, { key: "ext-capture", limit: 30, windowMs: 60_000 });
    if (limited.limited) {
      res.status(429).json({ error: "Capture rate limit reached. Wait a minute and try again." });
      return;
    }
    const user = resolveExtensionUser(bearerToken(req)) || requireUser(req, res);
    if (!user) return;
    const access = featuresOf(user);
    if (!access.features.manual_apply && !access.features.job_browse) {
      res.status(403).json({ error: "Job capture is not on your plan." });
      return;
    }
    try {
      const draft = normalizeExtensionCapture(req.body || {});
      const review = await reviewJobIntake(draft);
      if (!review.useful) {
        const reason = review.reasons[0] || "That page is not a job listing.";
        holdJobDraft({
          sourceId: "",
          userId: user.id,
          origin: "extension",
          draft,
          reason,
          provider: review.provider,
          model: review.model,
        });
        res.json({
          held: true,
          message: `${reason} It was not added. An admin can discard it or add it.`,
        });
        return;
      }
      let source = db.prepare("SELECT * FROM job_sources WHERE kind = 'extension' LIMIT 1").get();
      if (!source) {
        const sourceId = id("src");
        db.prepare(
          "INSERT INTO job_sources (id, name, kind, config, enabled, created_at) VALUES (?, 'Browser extension', 'extension', '{}', 1, ?)",
        ).run(sourceId, Date.now());
        source = db.prepare("SELECT * FROM job_sources WHERE id = ?").get(sourceId);
      }
      const siblings = db.prepare("SELECT id, title, company FROM jobs").all();
      const checked = await categorizeAndVerify(
        {
          title: draft.title,
          company: draft.company,
          location: draft.location,
          description: draft.description,
          sourceUrl: draft.sourceUrl,
        },
        siblings,
      );
      const saved = await saveJob(source.id, {
        title: draft.title,
        company: draft.company,
        location: draft.location,
        description: draft.description,
        sourceUrl: draft.sourceUrl,
        externalKey: `ext-${user.id}-${Date.now()}`,
        category: checked.category,
        role: checked.role || "",
        verification: checked.verification,
        note: checked.note,
        authenticity: checked.authenticity,
        primaryCompany: draft.company,
        primaryUrl: draft.sourceUrl || "",
      });
      const jobId = saved.id || saved;
      const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId);
      const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(user.id);
      const version = profile ? activeVersion(user.id) : null;
      const doc = version ? parse(version.document, {}) : { skills: [], employment: [], education: [] };
      const preferences = profile ? parse(profile.preferences, {}) : {};
      const match = job ? matchJob(doc, preferences, job) : null;
      let application = null;
      const action = String(req.body.action || "track");
      if (profile && version && access.features.manual_apply && (action === "track" || action === "prepare")) {
        application = await createApplication(user, job, "assisted", doc, preferences, parse(profile.facts, []), {
          status: action === "prepare" ? "Ready" : "Found",
          deliver: false,
        });
      }
      const captureId = id("cap");
      db.prepare(
        `INSERT INTO extension_captures
          (id, user_id, source_url, title, company, location, description, job_id, application_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        captureId,
        user.id,
        draft.sourceUrl,
        draft.title,
        draft.company,
        draft.location,
        draft.description,
        jobId,
        application?.id || "",
        Date.now(),
      );
      res.json({
        ok: true,
        captureId,
        job: {
          id: job.id,
          title: job.title,
          company: job.company,
          location: job.location,
          sourceUrl: job.source_url,
          score: match?.score ?? null,
          label: match?.label || "",
          verification: job.verification,
        },
        application: application
          ? { id: application.id, status: application.status, score: application.score }
          : null,
      });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Could not capture that listing." });
    }
  });

  app.get("/api/extension/captures", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const rows = db
      .prepare(
        `SELECT id, source_url AS sourceUrl, title, company, location, job_id AS jobId,
                application_id AS applicationId, created_at AS createdAt
         FROM extension_captures WHERE user_id = ? ORDER BY created_at DESC LIMIT 40`,
      )
      .all(user.id);
    res.json({ captures: rows });
  });

  function extensionApplication(req, res) {
    const limited = rateLimit(req, { key: "ext-kit", limit: 60, windowMs: 60_000 });
    if (limited.limited) {
      res.status(429).json({ error: "Extension rate limit reached. Wait a minute and try again." });
      return null;
    }
    const user = resolveExtensionUser(bearerToken(req)) || requireUser(req, res);
    if (!user) return null;
    const access = featuresOf(user);
    if (!access.features.manual_apply) {
      res.status(403).json({ error: "Assisted Apply is not on your plan." });
      return null;
    }
    const row = db.prepare("SELECT * FROM applications WHERE id = ? AND user_id = ?").get(req.params.id, user.id);
    if (!row) {
      res.status(404).json({ error: "Application not found." });
      return null;
    }
    return { user, row };
  }

  app.get("/api/extension/applications/:id/apply-kit", (req, res) => {
    const ctxApp = extensionApplication(req, res);
    if (!ctxApp) return;
    const { user, row } = ctxApp;
    const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(row.job_id);
    const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(user.id);
    const version = row.version_id
      ? db.prepare("SELECT * FROM resume_versions WHERE id = ? AND user_id = ?").get(row.version_id, user.id)
      : null;
    const kit = buildApplyKit({
      user,
      profile,
      job,
      application: { ...row, questions: parse(row.questions, []) },
      version,
      preferences: profile ? parse(profile.preferences, {}) : {},
    });
    recordApplyKitEvent(user.id, row.id, "opened", "extension");
    res.json({ kit, metrics: applyKitMetrics({ userId: user.id, applicationId: row.id }) });
  });

  app.post("/api/extension/applications/:id/apply-kit/event", (req, res) => {
    const ctxApp = extensionApplication(req, res);
    if (!ctxApp) return;
    const { user, row } = ctxApp;
    try {
      const recorded = recordApplyKitEvent(user.id, row.id, req.body.event, req.body.detail);
      res.json({ ok: true, event: recorded, metrics: applyKitMetrics({ userId: user.id, applicationId: row.id }) });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Could not record event." });
    }
  });

  app.post("/api/extension/applications/:id/mark-applied", (req, res) => {
    const ctxApp = extensionApplication(req, res);
    if (!ctxApp) return;
    const { user, row } = ctxApp;
    if (!["Ready", "Review required", "Resume preparing"].includes(row.status)) {
      res.status(400).json({ error: "Only prepared applications can be marked Applied from the extension." });
      return;
    }
    if (!row.version_id) {
      res.status(400).json({ error: "Pin a tailored resume version before marking Applied." });
      return;
    }
    const delivery = "You applied on the employer site with the JobPilot extension autofill assist.";
    const saved = recordSubmission({
      userId: user.id,
      applicationId: row.id,
      delivery,
    });
    if (saved.error) {
      res.status(400).json({ error: saved.error });
      return;
    }
    recordApplyKitEvent(user.id, row.id, "completed", "extension");
    res.json({
      ok: true,
      status: "Applied",
      delivery: saved.delivery || delivery,
      message: saved.message || "",
      metrics: applyKitMetrics({ userId: user.id, applicationId: row.id }),
    });
  });
}
