import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { backupDrillStatus, recordBackup, recordRestoreDrill } from "./backup-ops.mjs";

test("backup drill stays open until backup and a newer restore copy exist", () => {
  const dataDir = mkdtempSync(join(tmpdir(), "jp-ops-"));
  const archive = mkdtempSync(join(tmpdir(), "jp-arch-"));
  const drill = mkdtempSync(join(tmpdir(), "jp-drill-"));
  try {
    assert.equal(backupDrillStatus(dataDir).ok, false);
    recordBackup({ dataDir, destination: archive, at: 1_000 });
    assert.equal(backupDrillStatus(dataDir).ok, false);
    assert.match(backupDrillStatus(dataDir).detail, /Restore that copy/i);
    recordRestoreDrill({ dataDir, archive, target: drill, at: 2_000 });
    const ready = backupDrillStatus(dataDir);
    assert.equal(ready.ok, true);
    assert.equal(ready.lastBackupAt, 1_000);
    assert.equal(ready.lastRestoreAt, 2_000);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
    rmSync(archive, { recursive: true, force: true });
    rmSync(drill, { recursive: true, force: true });
  }
});

test("restore drill into the live data dir is refused", () => {
  const dataDir = mkdtempSync(join(tmpdir(), "jp-live-"));
  const archive = mkdtempSync(join(tmpdir(), "jp-arch-"));
  try {
    assert.throws(
      () => recordRestoreDrill({ dataDir, archive, target: dataDir }),
      /non-production/,
    );
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
    rmSync(archive, { recursive: true, force: true });
  }
});

test("a restore older than the latest backup keeps the drill open", () => {
  const dataDir = mkdtempSync(join(tmpdir(), "jp-ops-"));
  const archive = mkdtempSync(join(tmpdir(), "jp-arch-"));
  const drill = mkdtempSync(join(tmpdir(), "jp-drill-"));
  try {
    recordBackup({ dataDir, destination: archive, at: 5_000 });
    recordRestoreDrill({ dataDir, archive, target: drill, at: 4_000 });
    const status = backupDrillStatus(dataDir);
    assert.equal(status.ok, false);
    assert.match(status.detail, /older than the latest backup/i);
  } finally {
    rmSync(dataDir, { recursive: true, force: true });
    rmSync(archive, { recursive: true, force: true });
    rmSync(drill, { recursive: true, force: true });
  }
});
