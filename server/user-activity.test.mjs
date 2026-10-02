import assert from "node:assert/strict";
import express from "express";
import test from "node:test";
import { db, id } from "./db.mjs";
import { registerActivity } from "./routes-activity.mjs";
import { migrate } from "./schema.mjs";
import { listActivity, recordAccount, recordActivity, recordOperations } from "./user-activity.mjs";

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

test("account activity stays separate from the operations log", () => {
  migrate();
  const userId = id("usr");
  recordAccount(userId, "sign_in", "Signed in.");
  recordOperations(userId, "checkout", "Pro checkout is waiting. The payment return has not finished.", {
    detail: "password=abc123",
  });
  const account = listActivity(userId, "account");
  const operations = listActivity(userId, "admin");
  assert.deepEqual(account.map((row) => row.summary), ["Signed in."]);
  assert.equal(operations.length, 1);
  assert.match(operations[0].detail, /REDACTED/);
  assert.equal(operations[0].detail.includes("abc123"), false);
  db.prepare("DELETE FROM user_activity WHERE user_id = ?").run(userId);
});

test("an admin can record a waiting checkout on the manual ledger", async () => {
  migrate();
  const userId = id("usr");
  const adminId = id("usr");
  const checkoutId = id("chk");
  const now = Date.now();
  const plan = db.prepare("SELECT id, name FROM plans WHERE id = 'starter'").get()
    || db.prepare("SELECT id, name FROM plans ORDER BY sort_order ASC LIMIT 1").get();
  assert.ok(plan, "a plan exists");
  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, provider, role, status, created_at, plan_id)
     VALUES (?, 'Activity Candidate', ?, '', 'email', 'user', 'active', ?, 'free')`,
  ).run(userId, `activity-${userId}@example.com`, now);
  db.prepare(
    `INSERT INTO checkouts (id, user_id, plan_id, gateway_id, cycle, amount_cents, credit_cents, status, external_id, created_at)
     VALUES (?, ?, ?, '', 'monthly', 1900, 0, 'pending', 'sess_test', ?)`,
  ).run(checkoutId, userId, plan.id, now);
  let appliedNote = "";
  const app = express();
  app.use(express.json());
  let actor = null;
  registerActivity(app, {
    requireUser: (_req, res) => {
      if (!actor) {
        res.status(401).json({ error: "Sign in required." });
        return null;
      }
      return actor;
    },
    requireAdmin: (_req, res, permission) => {
      if (!actor || actor.role !== "admin") {
        res.status(403).json({ error: "Admin access required." });
        return null;
      }
      if (permission && !actor.permissions.includes(permission)) {
        res.status(403).json({ error: "Your admin access level does not include this action." });
        return null;
      }
      return actor;
    },
    applyPlan: (user, nextPlan, _gateway, _cycle, _externalId, _amount, _credit, note) => {
      appliedNote = note;
      db.prepare("UPDATE users SET plan_id = ? WHERE id = ?").run(nextPlan.id, user.id);
    },
  });
  const server = await listen(app);
  try {
    actor = { id: userId, role: "user", permissions: [] };
    const hidden = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/users/${userId}/activity`);
    assert.equal(hidden.status, 403);

    actor = { id: adminId, role: "admin", permissions: ["admin.users.activity.read"] };
    const before = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/users/${userId}/activity`);
    const beforeBody = await before.json();
    assert.equal(before.status, 200);
    assert.equal(beforeBody.stuck.length, 1);
    assert.equal(beforeBody.stuck[0].amountLabel, "$19.00");

    const denied = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/users/${userId}/checkouts/${checkoutId}/complete`, { method: "POST" });
    assert.equal(denied.status, 403);

    actor = {
      id: adminId,
      role: "admin",
      permissions: ["admin.users.activity.read", "admin.users.activity.complete"],
    };
    const completed = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/users/${userId}/checkouts/${checkoutId}/complete`, { method: "POST" });
    const completedBody = await completed.json();
    assert.equal(completed.status, 200);
    assert.match(completedBody.message, /manual ledger/);
    assert.match(appliedNote, /payment return did not finish/);
    assert.equal(db.prepare("SELECT plan_id FROM users WHERE id = ?").get(userId).plan_id, plan.id);
    assert.equal(db.prepare("SELECT status FROM checkouts WHERE id = ?").get(checkoutId).status, "ledger");

    actor = { id: userId, role: "user", permissions: [] };
    const own = await fetch(`http://127.0.0.1:${server.address().port}/api/account/activity`);
    const ownBody = await own.json();
    assert.equal(own.status, 200);
    assert.ok(ownBody.activity.some((row) => /manual ledger/.test(row.summary)));
    assert.equal(JSON.stringify(ownBody).includes("payment return had not finished"), false);

    const again = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/users/${userId}/checkouts/${checkoutId}/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
    });
    // actor is the candidate here; switch back to admin for the second record
    actor = {
      id: adminId,
      role: "admin",
      permissions: ["admin.users.activity.read", "admin.users.activity.complete"],
    };
    const second = await fetch(`http://127.0.0.1:${server.address().port}/api/admin/users/${userId}/checkouts/${checkoutId}/complete`, { method: "POST" });
    const secondBody = await second.json();
    assert.equal(second.status, 400);
    assert.match(secondBody.error, /already finished/);
    assert.equal(again.status, 403);
  } finally {
    server.close();
    db.prepare("DELETE FROM user_activity WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM checkouts WHERE id = ?").run(checkoutId);
    db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  }
});

test("an activity row needs an account and a sentence", () => {
  assert.equal(recordActivity({ userId: "", audience: "account", kind: "note", summary: "Skipped." }), null);
  assert.equal(recordActivity({ userId: "usr_x", audience: "other", kind: "note", summary: "Skipped." }), null);
});
