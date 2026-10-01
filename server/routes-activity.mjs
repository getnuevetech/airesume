/** Account activity for the candidate, and the admin operations log. */

import { db } from "./db.mjs";
import { completeStuckCheckout, listActivity, listStuckCheckouts } from "./user-activity.mjs";

export function registerActivity(app, ctx) {
  const { requireUser, requireAdmin, applyPlan } = ctx;

  app.get("/api/account/activity", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    res.json({ activity: listActivity(user.id, "account") });
  });

  app.get("/api/admin/users/:id/activity", (req, res) => {
    const admin = requireAdmin(req, res, "admin.users.activity.read");
    if (!admin) return;
    const person = db.prepare("SELECT id, role FROM users WHERE id = ?").get(req.params.id);
    if (!person) {
      res.status(404).json({ error: "User not found." });
      return;
    }
    res.json({
      account: listActivity(person.id, "account"),
      operations: listActivity(person.id, "admin"),
      stuck: listStuckCheckouts(person.id),
    });
  });

  app.post("/api/admin/users/:id/checkouts/:checkoutId/complete", (req, res) => {
    const admin = requireAdmin(req, res, "admin.users.activity.complete");
    if (!admin) return;
    try {
      const result = completeStuckCheckout({
        checkoutId: req.params.checkoutId,
        userId: req.params.id,
        adminId: admin.id,
        applyPlan,
      });
      res.json(result);
    } catch (error) {
      const status = Number(error?.status) || 400;
      res.status(status).json({ error: error instanceof Error ? error.message : "Could not record that checkout." });
    }
  });
}
