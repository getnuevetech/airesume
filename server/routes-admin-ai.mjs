/** Admin AI provider and assignment routes. */

import { db, id } from "./db.mjs";
import { AI_FUNCTIONS } from "./schema.mjs";

function publicProvider(row, maskSecret) {
  return { id: row.id, name: row.name, kind: row.kind, model: row.model, enabled: Boolean(row.enabled), apiKey: maskSecret(row.api_key), hasKey: Boolean(row.api_key) };
}

export function registerAdminAi(app, ctx) {
  const { requireAdmin, maskSecret } = ctx;

  app.get("/api/admin/ai", (req, res) => {
    if (!requireAdmin(req, res)) return;
    res.json({
      functions: AI_FUNCTIONS,
      providers: db.prepare("SELECT * FROM ai_providers ORDER BY created_at").all().map((row) => publicProvider(row, maskSecret)),
      assignments: db.prepare("SELECT * FROM ai_assignments").all(),
    });
  });

  app.post("/api/admin/ai/providers", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const kind = ["openai", "anthropic", "google", "deterministic"].includes(req.body.kind) ? req.body.kind : "";
    const name = String(req.body.name || "").trim();
    const model = String(req.body.model || "").trim();
    if (!kind || name.length < 2 || model.length < 2) {
      res.status(400).json({ error: "Name, kind, and model are required." });
      return;
    }
    const providerId = id("ai");
    db.prepare("INSERT INTO ai_providers (id, name, kind, model, api_key, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      providerId,
      name,
      kind,
      model,
      kind === "deterministic" ? "" : String(req.body.apiKey || ""),
      req.body.enabled === false ? 0 : 1,
      Date.now(),
    );
    res.json({ provider: publicProvider(db.prepare("SELECT * FROM ai_providers WHERE id = ?").get(providerId), maskSecret) });
  });

  app.patch("/api/admin/ai/providers/:id", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const provider = db.prepare("SELECT * FROM ai_providers WHERE id = ?").get(req.params.id);
    if (!provider) {
      res.status(404).json({ error: "Provider not found." });
      return;
    }
    const name = String(req.body.name || provider.name).trim();
    const model = String(req.body.model || provider.model).trim();
    const kinds = ["openai", "anthropic", "google", "deterministic"];
    const kind = kinds.includes(req.body.kind) ? req.body.kind : provider.kind;
    if (name.length < 2 || model.length < 2) {
      res.status(400).json({ error: "Name and model are required." });
      return;
    }
    const apiKey = req.body.apiKey && !String(req.body.apiKey).startsWith("••••") ? String(req.body.apiKey) : provider.api_key;
    const enabled = req.body.enabled === false ? 0 : 1;
    db.prepare("UPDATE ai_providers SET name = ?, kind = ?, model = ?, api_key = ?, enabled = ? WHERE id = ?").run(
      name,
      kind,
      model,
      kind === "deterministic" ? "" : apiKey,
      enabled,
      provider.id,
    );
    let reassigned = 0;
    let fallbackName = "";
    if (!enabled) {
      const fallback = db.prepare("SELECT * FROM ai_providers WHERE id != ? AND enabled = 1 ORDER BY kind = 'deterministic' DESC, created_at LIMIT 1").get(provider.id);
      if (fallback) {
        reassigned = db.prepare("UPDATE ai_assignments SET provider_id = ? WHERE provider_id = ?").run(fallback.id, provider.id).changes;
        fallbackName = fallback.name;
      }
    }
    res.json({ provider: publicProvider(db.prepare("SELECT * FROM ai_providers WHERE id = ?").get(provider.id), maskSecret), reassigned, fallbackName });
  });

  app.delete("/api/admin/ai/providers/:id", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const provider = db.prepare("SELECT * FROM ai_providers WHERE id = ?").get(req.params.id);
    if (!provider) {
      res.status(404).json({ error: "Provider not found." });
      return;
    }
    const remaining = db.prepare("SELECT COUNT(*) AS count FROM ai_providers WHERE id != ?").get(provider.id).count;
    if (!remaining) {
      res.status(400).json({ error: "Keep at least one AI pipeline. Disable it if you only want to turn it off." });
      return;
    }
    const fallback = db.prepare("SELECT * FROM ai_providers WHERE id != ? ORDER BY enabled DESC, kind = 'deterministic' DESC, created_at LIMIT 1").get(provider.id);
    const moved = db.prepare("UPDATE ai_assignments SET provider_id = ? WHERE provider_id = ?").run(fallback.id, provider.id);
    db.prepare("DELETE FROM ai_providers WHERE id = ?").run(provider.id);
    res.json({ ok: true, reassigned: moved.changes, fallbackName: fallback.name });
  });

  app.put("/api/admin/ai/assignments", (req, res) => {
    if (!requireAdmin(req, res)) return;
    const functionKey = AI_FUNCTIONS.some((item) => item.key === req.body.functionKey) ? req.body.functionKey : "";
    const provider = db.prepare("SELECT id FROM ai_providers WHERE id = ? AND enabled = 1").get(String(req.body.providerId || ""));
    if (!functionKey || !provider) {
      res.status(400).json({ error: "Choose an enabled pipeline for that function." });
      return;
    }
    db.prepare(
      "INSERT INTO ai_assignments (function_key, provider_id, enabled) VALUES (?, ?, ?) ON CONFLICT(function_key) DO UPDATE SET provider_id = excluded.provider_id, enabled = excluded.enabled",
    ).run(functionKey, provider.id, req.body.enabled === false ? 0 : 1);
    res.json({ ok: true });
  });
}
