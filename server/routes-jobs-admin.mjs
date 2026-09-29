/** Admin job feed and listing management routes. */

import { db, id } from "./db.mjs";
import { feedConfig, normalizeFeedUrl } from "./feeds.mjs";

export function registerJobsAdmin(app, ctx) {
  const {
    requireAdmin,
    audit,
    parse,
    publicSource,
    feedUrlTaken,
    pullSource,
    categorizeAndVerify,
    saveJob,
  } = ctx;

  app.get("/api/admin/jobs", (req, res) => {
    if (!requireAdmin(req, res, "admin.jobs.read")) return;
    const sources = db.prepare("SELECT * FROM job_sources ORDER BY created_at").all();
    const names = new Map(sources.map((source) => [source.id, source.name]));
    res.json({
      sources: sources.map(publicSource),
      jobs: db.prepare("SELECT * FROM jobs ORDER BY created_at DESC LIMIT 300").all().map((job) => ({
        id: job.id,
        title: job.title,
        company: job.company,
        category: job.category,
        role: job.role,
        verification: job.verification,
        location: job.location,
        sourceId: job.source_id,
        sourceName: names.get(job.source_id) || "Unknown feed",
        primaryCompany: job.primary_company || "",
        primaryUrl: job.primary_url || "",
        primaryEmail: job.primary_email || "",
        active: Boolean(job.active),
      })),
    });
  });

  app.post("/api/admin/job-sources", (req, res) => {
    if (!requireAdmin(req, res, "admin.jobs.sources.create")) return;
    const name = String(req.body.name || "").trim();
    if (name.length < 2) {
      res.status(400).json({ error: "Name the feed." });
      return;
    }
    let url = "";
    try {
      url = normalizeFeedUrl(req.body.url);
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Enter a valid feed URL." });
      return;
    }
    if (feedUrlTaken(url)) {
      res.status(409).json({ error: "That feed is already added." });
      return;
    }
    const config = feedConfig({ ...req.body, url });
    const sourceId = id("src");
    db.prepare("INSERT INTO job_sources (id, name, kind, config, enabled, created_at) VALUES (?, ?, 'json', ?, ?, ?)").run(
      sourceId,
      name,
      JSON.stringify(config),
      req.body.enabled === false ? 0 : 1,
      Date.now(),
    );
    res.json({ source: publicSource(db.prepare("SELECT * FROM job_sources WHERE id = ?").get(sourceId)) });
  });

  app.put("/api/admin/job-sources/:id", (req, res) => {
    if (!requireAdmin(req, res, "admin.jobs.sources.write")) return;
    const source = db.prepare("SELECT * FROM job_sources WHERE id = ?").get(req.params.id);
    if (!source) {
      res.status(404).json({ error: "Feed not found." });
      return;
    }
    const name = String(req.body.name || source.name).trim();
    if (name.length < 2) {
      res.status(400).json({ error: "Name the feed." });
      return;
    }
    const current = parse(source.config, {});
    let url = current.url || "";
    if (source.kind === "json" || source.kind === "rss" || req.body.url) {
      try {
        url = req.body.url == null || req.body.url === "" ? url : normalizeFeedUrl(req.body.url);
      } catch (error) {
        res.status(400).json({ error: error instanceof Error ? error.message : "Enter a valid feed URL." });
        return;
      }
    }
    if (url && feedUrlTaken(url, source.id)) {
      res.status(409).json({ error: "That feed is already added." });
      return;
    }
    if ((source.kind === "json" || source.kind === "rss") && !url) {
      res.status(400).json({ error: "Add a feed URL." });
      return;
    }
    const config = feedConfig({ ...req.body, url }, current);
    db.prepare("UPDATE job_sources SET name = ?, config = ?, enabled = ? WHERE id = ?").run(
      name,
      JSON.stringify(config),
      req.body.enabled === false ? 0 : 1,
      source.id,
    );
    res.json({ source: publicSource(db.prepare("SELECT * FROM job_sources WHERE id = ?").get(source.id)) });
  });

  app.delete("/api/admin/job-sources/:id", (req, res) => {
    if (!requireAdmin(req, res, "admin.jobs.sources.delete")) return;
    const source = db.prepare("SELECT * FROM job_sources WHERE id = ?").get(req.params.id);
    if (!source) {
      res.status(404).json({ error: "Feed not found." });
      return;
    }
    const jobs = db.prepare("SELECT id FROM jobs WHERE source_id = ?").all(source.id);
    for (const job of jobs) db.prepare("DELETE FROM applications WHERE job_id = ?").run(job.id);
    db.prepare("DELETE FROM jobs WHERE source_id = ?").run(source.id);
    db.prepare("DELETE FROM job_sources WHERE id = ?").run(source.id);
    res.json({ ok: true, removedJobs: jobs.length });
  });

  app.post("/api/admin/jobs/pull", async (req, res) => {
    if (!requireAdmin(req, res, "admin.jobs.pull")) return;
    const requested = String(req.body.sourceId || "");
    const sources = requested
      ? db.prepare("SELECT * FROM job_sources WHERE id = ? AND kind != 'manual'").all(requested)
      : db.prepare("SELECT * FROM job_sources WHERE enabled = 1 AND kind != 'manual'").all();
    if (requested && !sources.length) {
      res.status(404).json({ error: "Feed not found." });
      return;
    }
    const results = [];
    for (const source of sources) {
      try {
        const count = await pullSource(source);
        results.push({ id: source.id, name: source.name, count });
        audit({ functionName: "job_categorize", provider: "pipeline", model: "pull", status: "done", detail: source.name });
      } catch (error) {
        results.push({ id: source.id, name: source.name, error: error instanceof Error ? error.message : "Pull failed" });
      }
    }
    res.json({ results });
  });

  app.delete("/api/admin/jobs/:id", (req, res) => {
    if (!requireAdmin(req, res, "admin.jobs.delete")) return;
    const job = db.prepare("SELECT id FROM jobs WHERE id = ?").get(req.params.id);
    if (!job) {
      res.status(404).json({ error: "Job not found." });
      return;
    }
    db.prepare("DELETE FROM applications WHERE job_id = ?").run(job.id);
    db.prepare("DELETE FROM jobs WHERE id = ?").run(job.id);
    res.json({ ok: true });
  });

  app.post("/api/admin/jobs", async (req, res) => {
    if (!requireAdmin(req, res, "admin.jobs.create")) return;
    const title = String(req.body.title || "").trim();
    const company = String(req.body.company || "").trim();
    if (!title || !company) {
      res.status(400).json({ error: "Title and company are required." });
      return;
    }
    let source = db.prepare("SELECT * FROM job_sources WHERE kind = 'manual' LIMIT 1").get();
    if (!source) {
      const sourceId = id("src");
      db.prepare("INSERT INTO job_sources (id, name, kind, config, enabled, created_at) VALUES (?, 'Manual entries', 'manual', '{}', 1, ?)").run(sourceId, Date.now());
      source = db.prepare("SELECT * FROM job_sources WHERE id = ?").get(sourceId);
    }
    const draft = {
      title,
      company,
      location: String(req.body.location || ""),
      description: String(req.body.description || ""),
      skills: String(req.body.skills || "").split(",").map((skill) => skill.trim()).filter(Boolean),
      category: String(req.body.category || ""),
      role: String(req.body.role || ""),
    };
    const checked = await categorizeAndVerify(draft, db.prepare("SELECT id, title, company, location, source_url FROM jobs").all());
    const saved = await saveJob(source.id, {
      ...draft,
      remoteType: String(req.body.remoteType || ""),
      salaryMin: Number(req.body.salaryMin) || null,
      salaryMax: Number(req.body.salaryMax) || null,
      sourceUrl: String(req.body.sourceUrl || ""),
      externalKey: `${company}-${title}-${Date.now()}`,
      ...checked,
      note: checked.note,
      authenticity: checked.authenticity,
    });
    res.json({ id: saved.id || saved });
  });
}
