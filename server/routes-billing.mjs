/** Billing checkout and payment-gateway admin routes. */

import { db, id } from "./db.mjs";
import {
  BILLING_DISCLOSURE_VERSION,
  billingDisclosurePayload,
  recordBillingDisclosure,
  validateBillingDisclosure,
} from "./billing-disclosure.mjs";

export function registerBilling(app, ctx) {
  const {
    requireUser,
    requireAdmin,
    policy,
    planRow,
    creditFor,
    priceFor,
    applyPlan,
    originOf,
    publicProviderGateway,
    maskSecret,
  } = ctx;

  app.post("/api/billing/checkout", async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const plan = db.prepare("SELECT * FROM plans WHERE id = ? AND active = 1").get(String(req.body.planId || ""));
    const gateway = db.prepare("SELECT * FROM payment_gateways WHERE id = ? AND enabled = 1").get(String(req.body.gatewayId || ""));
    if (!plan || !gateway) {
      res.status(400).json({ error: "Choose an active plan and an enabled payment gateway." });
      return;
    }
    if (plan.id === (user.plan_id || "free")) {
      res.status(400).json({ error: "You are already on that plan." });
      return;
    }
    const rules = policy();
    const current = planRow(user.plan_id);
    const upgrade = plan.sort_order >= (current?.sort_order || 0);
    if (upgrade && !rules.allowUpgrade) {
      res.status(403).json({ error: "Upgrades are turned off by an admin." });
      return;
    }
    if (!upgrade && !rules.allowDowngrade) {
      res.status(403).json({ error: "Downgrades are turned off by an admin." });
      return;
    }
    const cycle = req.body.cycle === "yearly" ? "yearly" : "monthly";
    const credit = creditFor(user);
    const amount = Math.max(0, priceFor(plan, cycle) - (rules.allowProration ? credit : 0));
    const disclosure = validateBillingDisclosure({
      acceptDisclosure: Boolean(req.body.acceptDisclosure),
      user,
      amountCents: amount,
      planMonthlyCents: plan.monthly_cents || plan.price_cents || 0,
    });
    if (!disclosure.ok) {
      res.status(400).json({ error: disclosure.error });
      return;
    }
    if (disclosure.record) {
      recordBillingDisclosure(db, user.id);
    }
    if (gateway.kind === "manual" || amount === 0) {
      applyPlan(user, plan, gateway, cycle, "", amount, rules.allowProration ? credit : 0);
      res.json({ applied: true, amount, credit, disclosure: billingDisclosurePayload(db.prepare("SELECT * FROM users WHERE id = ?").get(user.id)) });
      return;
    }
    const checkoutId = id("chk");
    if (gateway.kind === "stripe") {
      const body = new URLSearchParams({
        mode: "payment",
        "line_items[0][price_data][currency]": "usd",
        "line_items[0][price_data][product_data][name]": `${plan.name} ${cycle}`,
        "line_items[0][price_data][unit_amount]": String(amount),
        "line_items[0][quantity]": "1",
        success_url: `${originOf(req)}/account/plan?checkout=success&checkout_id=${checkoutId}`,
        cancel_url: `${originOf(req)}/account/plan?checkout=cancel`,
        client_reference_id: user.id,
      });
      const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: { Authorization: `Bearer ${gateway.secret_key}`, "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      const session = await response.json();
      if (!response.ok) {
        res.status(400).json({ error: session.error?.message || "Stripe did not start checkout." });
        return;
      }
      db.prepare(
        "INSERT INTO checkouts (id, user_id, plan_id, gateway_id, cycle, amount_cents, credit_cents, status, external_id, disclosure_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)",
      ).run(checkoutId, user.id, plan.id, gateway.id, cycle, amount, credit, session.id, BILLING_DISCLOSURE_VERSION, Date.now());
      res.json({ url: session.url, checkoutId });
      return;
    }
    if (gateway.kind === "paypal") {
      const base = gateway.mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
      const tokenResponse = await fetch(`${base}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${gateway.public_key}:${gateway.secret_key}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      });
      const token = await tokenResponse.json();
      if (!token.access_token) {
        res.status(400).json({ error: "PayPal did not accept those credentials." });
        return;
      }
      const orderResponse = await fetch(`${base}/v2/checkout/orders`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [{ amount: { currency_code: "USD", value: (amount / 100).toFixed(2) }, description: plan.name }],
          application_context: {
            return_url: `${originOf(req)}/account/plan?checkout=success&checkout_id=${checkoutId}`,
            cancel_url: `${originOf(req)}/account/plan?checkout=cancel`,
          },
        }),
      });
      const order = await orderResponse.json();
      const approve = order.links?.find((link) => link.rel === "approve")?.href;
      if (!approve) {
        res.status(400).json({ error: "PayPal did not return a checkout link." });
        return;
      }
      db.prepare(
        "INSERT INTO checkouts (id, user_id, plan_id, gateway_id, cycle, amount_cents, credit_cents, status, external_id, disclosure_version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)",
      ).run(checkoutId, user.id, plan.id, gateway.id, cycle, amount, credit, order.id, BILLING_DISCLOSURE_VERSION, Date.now());
      res.json({ url: approve, checkoutId });
      return;
    }
    res.status(400).json({ error: "That gateway is not supported." });
  });

  app.post("/api/billing/confirm", async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const checkout = db.prepare("SELECT * FROM checkouts WHERE id = ? AND user_id = ?").get(String(req.body.checkoutId || ""), user.id);
    if (!checkout) {
      res.status(404).json({ error: "Checkout not found." });
      return;
    }
    if (checkout.status === "paid") {
      res.json({ applied: true });
      return;
    }
    const gateway = db.prepare("SELECT * FROM payment_gateways WHERE id = ?").get(checkout.gateway_id);
    const plan = db.prepare("SELECT * FROM plans WHERE id = ?").get(checkout.plan_id);
    let paid = false;
    if (gateway?.kind === "stripe") {
      const response = await fetch(`https://api.stripe.com/v1/checkout/sessions/${checkout.external_id}`, {
        headers: { Authorization: `Bearer ${gateway.secret_key}` },
      });
      const session = await response.json();
      paid = session.payment_status === "paid";
    }
    if (gateway?.kind === "paypal") {
      const base = gateway.mode === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
      const tokenResponse = await fetch(`${base}/v1/oauth2/token`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${gateway.public_key}:${gateway.secret_key}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "grant_type=client_credentials",
      });
      const token = await tokenResponse.json();
      const capture = await fetch(`${base}/v2/checkout/orders/${checkout.external_id}/capture`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
      });
      const body = await capture.json();
      paid = body.status === "COMPLETED";
    }
    if (!paid) {
      res.status(400).json({ error: "The payment is not complete yet." });
      return;
    }
    applyPlan(user, plan, gateway, checkout.cycle, checkout.external_id, checkout.amount_cents, checkout.credit_cents);
    db.prepare("UPDATE checkouts SET status = 'paid' WHERE id = ?").run(checkout.id);
    res.json({ applied: true });
  });

  app.put("/api/admin/billing-policy", (req, res) => {
    if (!requireAdmin(req, res, "admin.billing_policy.write")) return;
    const next = {
      allowUpgrade: Boolean(req.body.allowUpgrade),
      allowDowngrade: Boolean(req.body.allowDowngrade),
      allowProration: Boolean(req.body.allowProration),
      allowRefund: Boolean(req.body.allowRefund),
    };
    db.prepare("INSERT INTO settings (key, value) VALUES ('billing_policy', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(
      JSON.stringify(next),
    );
    res.json({ policy: next });
  });

  app.get("/api/admin/gateways", (req, res) => {
    if (!requireAdmin(req, res, "admin.payments.gateways.read")) return;
    res.json({ gateways: db.prepare("SELECT * FROM payment_gateways ORDER BY created_at").all().map(publicProviderGateway) });
  });

  app.post("/api/admin/gateways", (req, res) => {
    if (!requireAdmin(req, res, "admin.payments.gateways.create")) return;
    const kind = ["manual", "stripe", "paypal"].includes(req.body.kind) ? req.body.kind : "";
    const name = String(req.body.name || "").trim();
    if (!kind || name.length < 2) {
      res.status(400).json({ error: "Name and kind are required." });
      return;
    }
    const gatewayId = id("gw");
    db.prepare(
      "INSERT INTO payment_gateways (id, name, kind, enabled, public_key, secret_key, mode, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(
      gatewayId,
      name,
      kind,
      req.body.enabled ? 1 : 0,
      String(req.body.publicKey || ""),
      String(req.body.secretKey || ""),
      req.body.mode === "live" ? "live" : "test",
      Date.now(),
    );
    res.json({ gateway: publicProviderGateway(db.prepare("SELECT * FROM payment_gateways WHERE id = ?").get(gatewayId)) });
  });

  app.patch("/api/admin/gateways/:id", (req, res) => {
    if (!requireAdmin(req, res, "admin.payments.gateways.write")) return;
    const gateway = db.prepare("SELECT * FROM payment_gateways WHERE id = ?").get(req.params.id);
    if (!gateway) {
      res.status(404).json({ error: "Gateway not found." });
      return;
    }
    const secret = String(req.body.secretKey || "");
    db.prepare(
      "UPDATE payment_gateways SET name = ?, enabled = ?, public_key = ?, secret_key = ?, mode = ? WHERE id = ?",
    ).run(
      String(req.body.name || gateway.name).trim() || gateway.name,
      req.body.enabled == null ? gateway.enabled : req.body.enabled ? 1 : 0,
      req.body.publicKey == null ? gateway.public_key : String(req.body.publicKey),
      secret && !secret.startsWith("••••") ? secret : gateway.secret_key,
      req.body.mode === "live" ? "live" : req.body.mode === "test" ? "test" : gateway.mode,
      gateway.id,
    );
    res.json({ gateway: publicProviderGateway(db.prepare("SELECT * FROM payment_gateways WHERE id = ?").get(gateway.id)) });
  });

  app.get("/api/admin/billing-events", (req, res) => {
    if (!requireAdmin(req, res, "admin.payments.events.read")) return;
    res.json({ events: db.prepare("SELECT * FROM billing_events ORDER BY created_at DESC LIMIT 50").all() });
  });
}
