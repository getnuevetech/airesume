/** Record backup / restore-drill markers for Admin → Launch (no secrets). */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export const LAST_BACKUP_FILE = "ops-last-backup.json";
export const LAST_RESTORE_DRILL_FILE = "ops-last-restore-drill.json";

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

export function recordBackup({ dataDir, destination, at = Date.now() } = {}) {
  if (!dataDir || !destination) throw new Error("dataDir and destination are required.");
  const payload = {
    at: Number(at) || Date.now(),
    destination: resolve(destination),
  };
  writeJson(join(dataDir, LAST_BACKUP_FILE), payload);
  return payload;
}

export function recordRestoreDrill({ dataDir, archive, target, at = Date.now() } = {}) {
  if (!dataDir || !archive || !target) throw new Error("dataDir, archive, and target are required.");
  const live = resolve(dataDir);
  const restoredTo = resolve(target);
  if (live === restoredTo) {
    throw new Error("Restore drill must target a non-production data directory.");
  }
  const payload = {
    at: Number(at) || Date.now(),
    archive: resolve(archive),
    target: restoredTo,
  };
  writeJson(join(dataDir, LAST_RESTORE_DRILL_FILE), payload);
  return payload;
}

/**
 * Recommended private-beta gate: a backup was taken and restored onto a copy.
 * @param {string} dataDir
 */
export function backupDrillStatus(dataDir) {
  const backup = readJson(join(dataDir, LAST_BACKUP_FILE));
  const drill = readJson(join(dataDir, LAST_RESTORE_DRILL_FILE));
  const lastBackupAt = Number(backup?.at || 0) || null;
  const lastRestoreAt = Number(drill?.at || 0) || null;
  if (!lastBackupAt && !lastRestoreAt) {
    return {
      ok: false,
      lastBackupAt: null,
      lastRestoreAt: null,
      detail:
        "No backup or restore drill recorded. Run deploy/backup.sh outside the repo, then deploy/restore.sh <backup> <non-prod-dir> --yes.",
    };
  }
  if (!lastBackupAt) {
    return {
      ok: false,
      lastBackupAt: null,
      lastRestoreAt,
      detail: "A restore drill is recorded, but no backup marker exists. Run deploy/backup.sh first.",
    };
  }
  if (!lastRestoreAt) {
    return {
      ok: false,
      lastBackupAt,
      lastRestoreAt: null,
      detail: `Last backup at ${new Date(lastBackupAt).toISOString()}. Restore that copy onto a non-production directory with deploy/restore.sh … --yes.`,
    };
  }
  if (lastRestoreAt < lastBackupAt) {
    return {
      ok: false,
      lastBackupAt,
      lastRestoreAt,
      detail: `Last restore drill (${new Date(lastRestoreAt).toISOString()}) is older than the latest backup (${new Date(lastBackupAt).toISOString()}). Restore the newest backup onto a non-production directory.`,
    };
  }
  return {
    ok: true,
    lastBackupAt,
    lastRestoreAt,
    detail: `Backup and restore drill recorded (backup ${new Date(lastBackupAt).toISOString()}, restore ${new Date(lastRestoreAt).toISOString()}).`,
  };
}
