import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { liveGatewayWriteError, LIVE_BILLING_ERROR } from "./billing-live.mjs";

const here = dirname(fileURLToPath(import.meta.url));

test("live gateway writes are rejected unless BILLING_LIVE=1", () => {
  assert.equal(
    liveGatewayWriteError({ nextMode: "live", prevMode: "test", nextEnabled: true }, {}),
    LIVE_BILLING_ERROR,
  );
  assert.equal(
    liveGatewayWriteError({ nextMode: "live", prevMode: "live", nextEnabled: true }, {}),
    LIVE_BILLING_ERROR,
  );
  assert.equal(
    liveGatewayWriteError({ nextMode: "live", prevMode: "live", nextEnabled: false }, {}),
    "",
  );
  assert.equal(
    liveGatewayWriteError({ nextMode: "test", prevMode: "test", nextEnabled: true }, {}),
    "",
  );
  assert.equal(
    liveGatewayWriteError({ nextMode: "live", prevMode: "test", nextEnabled: true }, { BILLING_LIVE: "1" }),
    "",
  );
});

test("POST /api/admin/gateways rejects live mode unless BILLING_LIVE=1", () => {
  const dir = mkdtempSync(join(tmpdir(), "jp-billing-"));
  const scriptPath = join(here, ".billing-live-route.tmp.mjs");
  const script = `
    import express from "express";
    import { db } from "./db.mjs";
    import { migrate } from "./schema.mjs";
    import { registerBilling } from "./routes-billing.mjs";
    migrate();
    const app = express();
    app.use(express.json());
    registerBilling(app, {
      requireUser: () => null,
      requireAdmin: () => ({ id: "admin" }),
      policy: () => ({}),
      planRow: () => null,
      creditFor: () => 0,
      priceFor: () => 0,
      applyPlan: () => {},
      originOf: () => "http://127.0.0.1",
      publicProviderGateway: (row) => ({ id: row.id, mode: row.mode, kind: row.kind, name: row.name }),
      maskSecret: (value) => value,
    });
    const server = app.listen(0, "127.0.0.1", async () => {
      const port = server.address().port;
      const blocked = await fetch("http://127.0.0.1:" + port + "/api/admin/gateways", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Stripe Live", kind: "stripe", mode: "live", enabled: true }),
      });
      const blockedBody = await blocked.json();
      if (blocked.status !== 400) {
        console.error("expected 400", blocked.status, blockedBody);
        process.exit(2);
      }
      process.env.BILLING_LIVE = "1";
      const allowed = await fetch("http://127.0.0.1:" + port + "/api/admin/gateways", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Stripe Live", kind: "stripe", mode: "live", enabled: true }),
      });
      const allowedBody = await allowed.json();
      if (allowed.status !== 200 || allowedBody.gateway?.mode !== "live") {
        console.error("expected live gateway", allowed.status, allowedBody);
        process.exit(3);
      }
      const row = db.prepare("SELECT mode FROM payment_gateways WHERE id = ?").get(allowedBody.gateway.id);
      if (row?.mode !== "live") process.exit(4);
      server.close();
    });
  `;
  writeFileSync(scriptPath, script);
  try {
    const result = spawnSync(process.execPath, [scriptPath], {
      cwd: here,
      env: { ...process.env, JOBPILOT_DATA_DIR: dir, BILLING_LIVE: "" },
      encoding: "utf8",
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  } finally {
    rmSync(scriptPath, { force: true });
    rmSync(dir, { recursive: true, force: true });
  }
});
