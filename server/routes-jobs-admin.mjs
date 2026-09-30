/** Admin job feed and listing management routes. */

import { db, id } from "./db.mjs";
import { feedConfig, normalizeFeedUrl } from "./feeds.mjs";
import { EXAMPLE_FEEDS, SUPPORTED_FEED_HINTS } from "./example-feeds.mjs";
import { holdJobDraft, reviewJobIntake } from "./job-intake.mjs";

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
      exampleFeeds: EXAMPLE_FEEDS,
      hints: SUPPORTED_FEED_HINTS,
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
      holds: db.prepare("SELECT * FROM job_intake_holds WHERE status = 'pending' ORDER BY created_at DESC LIMIT 100").all().map((row) => ({
        id: row.id,
        title: row.title,
        company: row.company,
        location: row.location,
        description: row.description,
        sourceUrl: row.source_url,
        origin: row.origin,
        reason: row.reason,
        provider: row.provider,
        model: row.model,
        createdAt: row.created_at,
      })),
    });
  });

  app.post("/api/admin/job-sources/examples", (req, res) => {
    if (!requireAdmin(req, res, "admin.jobs.sources.create")) return;
    const added = [];
    const skipped = [];
    for (const example of EXAMPLE_FEEDS) {
      let url = "";
      try {
        url = normalizeFeedUrl(example.url);
      } catch (error) {
        skipped.push({ name: example.name, reason: error instanceof Error ? error.message : "Invalid URL" });
        continue;
      }
      if (feedUrlTaken(url)) {
        skipped.push({ name: example.name, reason: "Already added" });
        continue;
      }
      const config = feedConfig({
        url,
        format: example.format || "auto",
        employer: example.employer || "",
        authType: "none",
      });
      const sourceId = id("src");
      db.prepare("INSERT INTO job_sources (id, name, kind, config, enabled, created_at) VALUES (?, ?, 'json', ?, 1, ?)").run(
        sourceId,
        example.name,
        JSON.stringify(config),
        Date.now(),
      );
      added.push(publicSource(db.prepare("SELECT * FROM job_sources WHERE id = ?").get(sourceId)));
    }
    res.json({
      ok: true,
      added,
      skipped,
      sources: db.prepare("SELECT * FROM job_sources ORDER BY created_at").all().map(publicSource),
      message:
        added.length
          ? `Added ${added.length} verified example feed${added.length === 1 ? "" : "s"}. Use Pull enabled feeds to import jobs.`
          : "All verified example feeds are already added.",
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
      : db.prepare("SELECT * FROM job_sources WHERE enabled = 1 AND kind IN ('json', 'rss')").all();
    if (requested && !sources.length) {
      res.status(404).json({ error: "Feed not found." });
      return;
    }
    if (!requested && !sources.length) {
      res.json({
        results: [],
        message: "No enabled URL feeds to pull. Add a feed, check “Include in Pull enabled feeds”, then try again. The catalog is refreshed separately.",
      });
      return;
    }
    const results = [];
    for (const source of sources) {
      try {
        const count = await pullSource(source);
        const refreshed = db.prepare("SELECT * FROM job_sources WHERE id = ?").get(source.id);
        results.push({
          id: source.id,
          name: source.name,
          count,
          status: refreshed?.last_pull_status || "ok",
          message: refreshed?.last_pull_message || `Pulled ${count} jobs.`,
        });
        audit({ functionName: "job_categorize", provider: "pipeline", model: "pull", status: "done", detail: source.name });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Pull failed";
        db.prepare("UPDATE job_sources SET last_pulled_at = ?, last_pull_status = ?, last_pull_message = ? WHERE id = ?").run(
          Date.now(),
          "error",
          message.slice(0, 500),
          source.id,
        );
        results.push({ id: source.id, name: source.name, error: message, status: "error", message });
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
      sourceUrl: String(req.body.sourceUrl || ""),
    };
    const review = await reviewJobIntake(draft);
    if (!review.useful) {
      const reason = review.reasons[0] || "That text is not a job listing.";
      const held = holdJobDraft({
        sourceId: "",
        origin: "admin",
        draft,
        reason,
        provider: review.provider,
        model: review.model,
      });
      res.json({ held: true, id: held.id, message: `${reason} It is in Held for review.` });
      return;
    }
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

  app.post("/api/admin/jobs/holds/:id/add", async (req, res) => {
    if (!requireAdmin(req, res, "admin.jobs.create")) return;
    const hold = db.prepare("SELECT * FROM job_intake_holds WHERE id = ?").get(req.params.id);
    if (!hold || hold.status !== "pending") {
      res.status(404).json({ error: "That listing is not waiting for review." });
      return;
    }
    let payload = {};
    try {
      payload = JSON.parse(hold.payload || "{}");
    } catch {
      payload = {};
    }
    const draft = {
      title: payload.title || hold.title,
      company: payload.company || hold.company || "Unknown company",
      location: payload.location || hold.location || "",
      description: payload.description || hold.description || "",
      sourceUrl: payload.sourceUrl || payload.source_url || hold.source_url || "",
      skills: Array.isArray(payload.skills) ? payload.skills : [],
      remoteType: payload.remoteType || "",
      salaryMin: payload.salaryMin ?? null,
      salaryMax: payload.salaryMax ?? null,
      externalKey: payload.externalKey || `hold-${hold.id}`,
    };
    let sourceId = hold.source_id;
    if (!sourceId || !db.prepare("SELECT id FROM job_sources WHERE id = ?").get(sourceId)) {
      let source = db.prepare("SELECT * FROM job_sources WHERE kind = 'manual' LIMIT 1").get();
      if (!source) {
        sourceId = id("src");
        db.prepare(
          "INSERT INTO job_sources (id, name, kind, config, enabled, created_at) VALUES (?, 'Manual entries', 'manual', '{}', 1, ?)",
        ).run(sourceId, Date.now());
      } else {
        sourceId = source.id;
      }
    }
    const checked = await categorizeAndVerify(draft, db.prepare("SELECT id, title, company FROM jobs").all());
    const saved = await saveJob(sourceId, {
      ...draft,
      ...checked,
      note: checked.note,
      authenticity: checked.authenticity,
      primaryCompany: draft.company,
      primaryUrl: draft.sourceUrl,
    });
    db.prepare("UPDATE job_intake_holds SET status = 'added', decided_at = ? WHERE id = ?").run(Date.now(), hold.id);
    res.json({ ok: true, id: saved.id || saved });
  });

  app.post("/api/admin/jobs/holds/:id/discard", (req, res) => {
    if (!requireAdmin(req, res, "admin.jobs.delete")) return;
    const hold = db.prepare("SELECT * FROM job_intake_holds WHERE id = ?").get(req.params.id);
    if (!hold || hold.status !== "pending") {
      res.status(404).json({ error: "That listing is not waiting for review." });
      return;
    }
    db.prepare("UPDATE job_intake_holds SET status = 'discarded', decided_at = ? WHERE id = ?").run(Date.now(), hold.id);
    res.json({ ok: true });
  });
}
