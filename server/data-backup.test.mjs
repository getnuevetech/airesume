import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { assertBackupDestination, backupDataDir, restoreDataDir } from "./data-backup.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

test("backup destination inside the repo is refused", () => {
  assert.throws(() => assertBackupDestination(root, join(root, "server", "data")), /outside the repository/);
  const script = join(root, "deploy", "backup.sh");
  chmodSync(script, 0o755);
  const result = spawnSync(script, [join(root, "server")], { encoding: "utf8" });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stderr}`, /outside the repository/);
});

test("backup and restore keep schema tables and uploads", () => {
  const source = mkdtempSync(join(tmpdir(), "jp-src-"));
  const archive = mkdtempSync(join(tmpdir(), "jp-bak-"));
  const restored = mkdtempSync(join(tmpdir(), "jp-dst-"));
  const secret = "do-not-print-admin-password-9f3a";
  try {
    const seeded = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
          import { writeFileSync, mkdirSync } from "node:fs";
          import { join } from "node:path";
          import { db, uploadsDir } from "./db.mjs";
          import { migrate, SCHEMA_VERSION } from "./schema.mjs";
          migrate();
          const version = db.prepare("SELECT version FROM schema_version LIMIT 1").get();
          if (!version || version.version !== SCHEMA_VERSION) process.exit(2);
          mkdirSync(uploadsDir, { recursive: true });
          writeFileSync(join(uploadsDir, "resume.txt"), "Alex Rivera SQL");
          writeFileSync(join(process.env.JOBPILOT_DATA_DIR, "admin-bootstrap.txt"), ${JSON.stringify(`password: ${secret}\n`)});
        `,
      ],
      { cwd: here, env: { ...process.env, JOBPILOT_DATA_DIR: source }, encoding: "utf8" },
    );
    assert.equal(seeded.status, 0, `${seeded.stdout}\n${seeded.stderr}`);

    chmodSync(join(root, "deploy", "backup.sh"), 0o755);
    chmodSync(join(root, "deploy", "restore.sh"), 0o755);
    const backedUp = spawnSync(join(root, "deploy", "backup.sh"), [archive], {
      cwd: root,
      env: { ...process.env, JOBPILOT_DATA_DIR: source },
      encoding: "utf8",
    });
    assert.equal(backedUp.status, 0, `${backedUp.stdout}\n${backedUp.stderr}`);
    assert.match(backedUp.stdout, /Backup written to/);
    assert.match(backedUp.stdout, /Recorded backup marker/);
    assert.equal(backedUp.stdout.includes(secret), false);
    assert.equal(backedUp.stderr.includes(secret), false);
    assert.ok(existsSync(join(source, "ops-last-backup.json")));

    const restoredRun = spawnSync(join(root, "deploy", "restore.sh"), [archive, restored, "--yes"], {
      cwd: root,
      env: { ...process.env, JOBPILOT_DATA_DIR: source },
      encoding: "utf8",
    });
    assert.equal(restoredRun.status, 0, `${restoredRun.stdout}\n${restoredRun.stderr}`);
    assert.match(restoredRun.stdout, /Recorded restore drill/);
    assert.equal(restoredRun.stdout.includes(secret), false);
    assert.ok(existsSync(join(source, "ops-last-restore-drill.json")));

    const checked = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
          import { readFileSync } from "node:fs";
          import { join } from "node:path";
          import { db, uploadsDir } from "./db.mjs";
          import { SCHEMA_VERSION } from "./schema.mjs";
          const version = db.prepare("SELECT version FROM schema_version LIMIT 1").get();
          if (!version || version.version !== SCHEMA_VERSION) process.exit(2);
          const jobs = db.prepare("SELECT COUNT(*) AS count FROM jobs").get();
          if (!jobs || jobs.count < 1) process.exit(3);
          const text = readFileSync(join(uploadsDir, "resume.txt"), "utf8");
          if (text !== "Alex Rivera SQL") process.exit(4);
        `,
      ],
      { cwd: here, env: { ...process.env, JOBPILOT_DATA_DIR: restored }, encoding: "utf8" },
    );
    assert.equal(checked.status, 0, `${checked.stdout}\n${checked.stderr}`);
    assert.equal(readFileSync(join(restored, "uploads", "resume.txt"), "utf8"), "Alex Rivera SQL");
  } finally {
    rmSync(source, { recursive: true, force: true });
    rmSync(archive, { recursive: true, force: true });
    rmSync(restored, { recursive: true, force: true });
  }
});

test("module backup round-trips a row", () => {
  const source = mkdtempSync(join(tmpdir(), "jp-mod-src-"));
  const archive = mkdtempSync(join(tmpdir(), "jp-mod-bak-"));
  const restored = mkdtempSync(join(tmpdir(), "jp-mod-dst-"));
  try {
    writeFileSync(join(source, "placeholder"), "");
    const seeded = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", `import { db } from "./db.mjs"; db.exec("CREATE TABLE IF NOT EXISTS marker (id TEXT)"); db.prepare("INSERT INTO marker (id) VALUES (?)").run("kept");`],
      { cwd: here, env: { ...process.env, JOBPILOT_DATA_DIR: source }, encoding: "utf8" },
    );
    assert.equal(seeded.status, 0, seeded.stderr);
    backupDataDir(source, archive);
    restoreDataDir(archive, restored);
    const checked = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", `import { db } from "./db.mjs"; const row = db.prepare("SELECT id FROM marker").get(); if (row?.id !== "kept") process.exit(2);`],
      { cwd: here, env: { ...process.env, JOBPILOT_DATA_DIR: restored }, encoding: "utf8" },
    );
    assert.equal(checked.status, 0, `${checked.stdout}\n${checked.stderr}`);
  } finally {
    rmSync(source, { recursive: true, force: true });
    rmSync(archive, { recursive: true, force: true });
    rmSync(restored, { recursive: true, force: true });
  }
});
