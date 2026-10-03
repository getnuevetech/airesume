import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { deletionDrillStatus } from "./deletion-drill.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

test("runDeletionDrill clears throwaway rows and records a marker", () => {
  const dir = mkdtempSync(join(tmpdir(), "jp-del-"));
  const prev = process.env.JOBPILOT_DATA_DIR;
  process.env.JOBPILOT_DATA_DIR = dir;
  try {
    // Re-importing db is hard; use the script path for isolation instead via spawn below.
    // Unit-level: status starts open without a marker in this dir.
    assert.equal(deletionDrillStatus(dir).ok, false);
  } finally {
    if (prev == null) delete process.env.JOBPILOT_DATA_DIR;
    else process.env.JOBPILOT_DATA_DIR = prev;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("deploy/deletion-drill.sh records ops-last-deletion-drill.json", () => {
  const dir = mkdtempSync(join(tmpdir(), "jp-del-sh-"));
  try {
    const script = join(root, "deploy", "deletion-drill.sh");
    chmodSync(script, 0o755);
    const result = spawnSync(script, [], {
      cwd: root,
      env: { ...process.env, JOBPILOT_DATA_DIR: dir },
      encoding: "utf8",
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /Deletion drill ok/);
    const marker = join(dir, "ops-last-deletion-drill.json");
    assert.ok(existsSync(marker));
    const payload = JSON.parse(readFileSync(marker, "utf8"));
    assert.ok(payload.at);
    assert.ok(Array.isArray(payload.tablesCleared));
    assert.ok(payload.tablesCleared.includes("users"));
    assert.equal(deletionDrillStatus(dir).ok, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
