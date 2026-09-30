/** Admin plan matrix routes. */

import { db } from "./db.mjs";
import { FEATURES, RESUME_TEMPLATES, publicPlan } from "./schema.mjs";

function featuresFrom(input, base) {
  const features = { ...base };
  for (const feature of FEATURES) {
    if (input && Object.prototype.hasOwnProperty.call(input, feature.key)) features[feature.key] = Boolean(input[feature.key]);
  }
  if (input && Object.prototype.hasOwnProperty.call(input, "job_limit")) features.job_limit = Math.max(0, Number(input.job_limit) || 0);
  if (input && Object.prototype.hasOwnProperty.call(input, "template_limit")) {
    features.template_limit = Math.max(1, Math.min(RESUME_TEMPLATES.length, Number(input.template_limit) || 1));
  }
  if (input && Object.prototype.hasOwnProperty.call(input, "match_explain_limit")) {
    features.match_explain_limit = Math.max(0, Number(input.match_explain_limit) || 0);
  }
  if (input && Object.prototype.hasOwnProperty.call(input, "resume_review_limit")) {
    features.resume_review_limit = Math.max(0, Number(input.resume_review_limit) || 0);
  }
  return features;
}

function planSlug(name) {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "plan";
  let next = base;
  let count = 2;
  while (db.prepare("SELECT id FROM plans WHERE id = ?").get(next)) {
    next = `${base}-${count}`;
    count += 1;
  }
  return next;
}

export function registerAdminPlans(app, ctx) {
  const { requireAdmin, parse, policy } = ctx;

  app.get("/api/admin/plans", (req, res) => {
    if (!requireAdmin(req, res, "admin.plans.read")) return;
    res.json({
      features: FEATURES,
      plans: db.prepare("SELECT * FROM plans ORDER BY sort_order").all().map(publicPlan),
      policy: policy(),
      events: db.prepare("SELECT * FROM billing_events ORDER BY created_at DESC LIMIT 40").all(),
    });
  });

  app.put("/api/admin/plans/:id", (req, res) => {
    if (!requireAdmin(req, res, "admin.plans.write")) return;
    const plan = db.prepare("SELECT * FROM plans WHERE id = ?").get(req.params.id);
    if (!plan) {
      res.status(404).json({ error: "Plan not found." });
      return;
    }
    const features = featuresFrom(req.body.features, parse(plan.features, {}));
    db.prepare("UPDATE plans SET name = ?, blurb = ?, monthly_cents = ?, yearly_cents = ?, features = ?, popular = ?, active = ? WHERE id = ?").run(
      String(req.body.name || plan.name),
      String(req.body.blurb ?? plan.blurb),
      Math.max(0, Number(req.body.monthlyCents ?? plan.monthly_cents) || 0),
      Math.max(0, Number(req.body.yearlyCents ?? plan.yearly_cents) || 0),
      JSON.stringify(features),
      req.body.popular ? 1 : 0,
      req.body.active === false ? 0 : 1,
      plan.id,
    );
    res.json({ plan: publicPlan(db.prepare("SELECT * FROM plans WHERE id = ?").get(plan.id)) });
  });

  app.post("/api/admin/plans", (req, res) => {
    if (!requireAdmin(req, res, "admin.plans.create")) return;
    const name = String(req.body.name || "").trim();
    if (name.length < 2) {
      res.status(400).json({ error: "Name the plan." });
      return;
    }
    const planId = planSlug(name);
    const sort = (db.prepare("SELECT MAX(sort_order) AS n FROM plans").get()?.n || 0) + 1;
    const features = featuresFrom(req.body.features, { profile_edit: true, job_limit: 5, template_limit: 2 });
    db.prepare(
      "INSERT INTO plans (id, name, blurb, monthly_cents, yearly_cents, features, sort_order, popular, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(
      planId,
      name,
      String(req.body.blurb || ""),
      Math.max(0, Number(req.body.monthlyCents) || 0),
      Math.max(0, Number(req.body.yearlyCents) || 0),
      JSON.stringify(features),
      sort,
      req.body.popular ? 1 : 0,
      req.body.active === false ? 0 : 1,
    );
    res.json({ plan: publicPlan(db.prepare("SELECT * FROM plans WHERE id = ?").get(planId)) });
  });

  app.delete("/api/admin/plans/:id", (req, res) => {
    if (!requireAdmin(req, res, "admin.plans.delete")) return;
    const plan = db.prepare("SELECT * FROM plans WHERE id = ?").get(req.params.id);
    if (!plan) {
      res.status(404).json({ error: "Plan not found." });
      return;
    }
    if (db.prepare("SELECT COUNT(*) AS count FROM plans").get().count <= 1) {
      res.status(400).json({ error: "Keep at least one plan." });
      return;
    }
    const users = db.prepare("SELECT COUNT(*) AS count FROM users WHERE plan_id = ?").get(plan.id).count;
    const subscriptions = db.prepare("SELECT COUNT(*) AS count FROM subscriptions WHERE plan_id = ?").get(plan.id).count;
    if (users || subscriptions) {
      const count = Math.max(users, subscriptions);
      res.status(400).json({ error: `Move ${count} account${count === 1 ? "" : "s"} off ${plan.name} before deleting it.` });
      return;
    }
    db.prepare("DELETE FROM plans WHERE id = ?").run(plan.id);
    res.json({ ok: true });
  });
}
