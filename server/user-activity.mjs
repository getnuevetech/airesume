/** Two activity histories: the candidate's account log, and the admin operations log. */

import { db, id } from "./db.mjs";
import { redactSensitive } from "./security-redact.mjs";

const AUDIENCES = new Set(["account", "admin"]);
const LIST_LIMIT = 40;

function cleanSummary(summary) {
  return String(summary || "").replace(/\s+/g, " ").trim().slice(0, 240);
}

export function moneyLabel(cents) {
  const amount = Number(cents);
  const safe = Number.isFinite(amount) ? amount : 0;
  return `$${(safe / 100).toFixed(2)}`;
}

export function recordActivity({
  userId,
  actorId = "",
  audience,
  kind,
  summary,
  detail = "",
  refType = "",
  refId = "",
  now = Date.now(),
} = {}) {
  const owner = String(userId || "");
  const text = cleanSummary(summary);
  if (!owner || !AUDIENCES.has(audience) || !text) return null;
  const activityId = id("act");
  db.prepare(
    `INSERT INTO user_activity
      (id, user_id, actor_id, audience, kind, summary, detail, ref_type, ref_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    activityId,
    owner,
    String(actorId || ""),
    audience,
    String(kind || "note").slice(0, 40),
    text,
    redactSensitive(detail || "", { maxLen: 240 }),
    String(refType || "").slice(0, 40),
    String(refId || "").slice(0, 80),
    now,
  );
  return activityId;
}

export function recordAccount(userId, kind, summary, extra = {}) {
  return recordActivity({
    userId,
    actorId: extra.actorId || userId,
    audience: "account",
    kind,
    summary,
    detail: extra.detail,
    refType: extra.refType,
    refId: extra.refId,
    now: extra.now,
  });
}

export function recordOperations(userId, kind, summary, extra = {}) {
  return recordActivity({
    userId,
    actorId: extra.actorId || "",
    audience: "admin",
    kind,
    summary,
    detail: extra.detail,
    refType: extra.refType,
    refId: extra.refId,
    now: extra.now,
  });
}

function presentActivity(row) {
  return {
    id: row.id,
    kind: row.kind,
    summary: row.summary,
    detail: row.detail || "",
    createdAt: row.created_at,
    refType: row.ref_type || "",
    refId: row.ref_id || "",
  };
}

export function listActivity(userId, audience, limit = LIST_LIMIT) {
  if (!AUDIENCES.has(audience)) return [];
  const cap = Math.min(LIST_LIMIT, Math.max(1, Number(limit) || LIST_LIMIT));
  return db
    .prepare(
      `SELECT * FROM user_activity
       WHERE user_id = ? AND audience = ?
       ORDER BY created_at DESC, id DESC
       LIMIT ?`,
    )
    .all(userId, audience, cap)
    .map(presentActivity);
}

export function listStuckCheckouts(userId) {
  return db
    .prepare(
      `SELECT c.id, c.plan_id, c.cycle, c.amount_cents, c.created_at, p.name AS plan_name, g.kind AS gateway_kind
       FROM checkouts c
       LEFT JOIN plans p ON p.id = c.plan_id
       LEFT JOIN payment_gateways g ON g.id = c.gateway_id
       WHERE c.user_id = ? AND c.status = 'pending'
       ORDER BY c.created_at ASC`,
    )
    .all(userId)
    .map((row) => ({
      id: row.id,
      planId: row.plan_id,
      planName: row.plan_name || row.plan_id,
      cycle: row.cycle,
      amountCents: row.amount_cents,
      amountLabel: moneyLabel(row.amount_cents),
      gatewayKind: row.gateway_kind || "",
      createdAt: row.created_at,
    }));
}

function activityError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function manualGateway() {
  return (
    db.prepare("SELECT * FROM payment_gateways WHERE kind = 'manual' AND enabled = 1 ORDER BY created_at ASC LIMIT 1").get()
    || db.prepare("SELECT * FROM payment_gateways WHERE kind = 'manual' ORDER BY created_at ASC LIMIT 1").get()
    || { id: "", kind: "manual", name: "Manual ledger" }
  );
}

/**
 * Finish a checkout whose payment return never landed.
 * The plan is recorded on the manual ledger. A card charge is not marked paid.
 */
export function completeStuckCheckout({ checkoutId, userId, adminId, applyPlan, now = Date.now() } = {}) {
  const checkout = db.prepare("SELECT * FROM checkouts WHERE id = ? AND user_id = ?").get(String(checkoutId || ""), String(userId || ""));
  if (!checkout) throw activityError("That checkout was not found.", 404);
  if (checkout.status !== "pending") throw activityError("That checkout is already finished.", 400);
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(checkout.user_id);
  const plan = db.prepare("SELECT * FROM plans WHERE id = ?").get(checkout.plan_id);
  if (!user || !plan || typeof applyPlan !== "function") throw activityError("That checkout cannot be recorded.", 400);
  const gateway = manualGateway();
  const note = "Recorded on the manual ledger. The payment return did not finish.";
  applyPlan(user, plan, gateway, checkout.cycle, "", checkout.amount_cents, checkout.credit_cents, note);
  db.prepare("UPDATE checkouts SET status = 'ledger' WHERE id = ?").run(checkout.id);
  const amount = moneyLabel(checkout.amount_cents);
  const accountSummary = `Support recorded the ${plan.name} plan on the manual ledger.`;
  const operationsSummary = `Recorded the ${plan.name} checkout on the manual ledger for ${amount}. The payment return had not finished.`;
  recordAccount(user.id, "checkout_ledger", accountSummary, {
    actorId: adminId,
    refType: "checkout",
    refId: checkout.id,
    now,
  });
  recordOperations(user.id, "checkout_ledger", operationsSummary, {
    actorId: adminId,
    detail: checkout.id,
    refType: "checkout",
    refId: checkout.id,
    now,
  });
  return {
    status: "ledger",
    planName: plan.name,
    amountLabel: amount,
    message: accountSummary,
  };
}
