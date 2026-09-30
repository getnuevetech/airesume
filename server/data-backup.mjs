import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const DB_NAME = "jobpilot.sqlite";

export function assertBackupDestination(repoRoot, destination) {
  const root = resolve(repoRoot);
  const dest = resolve(destination);
  const rel = relative(root, dest);
  if (rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))) {
    throw new Error("Backup destination must be outside the repository.");
  }
  return dest;
}

function sqlPath(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function backupDataDir(sourceDir, destinationDir) {
  const sqlitePath = join(sourceDir, DB_NAME);
  if (!existsSync(sqlitePath)) {
    throw new Error(`No database at ${sqlitePath}`);
  }
  mkdirSync(destinationDir, { recursive: true });
  const outDb = join(destinationDir, DB_NAME);
  rmSync(outDb, { force: true });
  const db = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    db.exec(`VACUUM INTO ${sqlPath(outDb)}`);
  } finally {
    db.close();
  }
  const uploads = join(sourceDir, "uploads");
  const outUploads = join(destinationDir, "uploads");
  rmSync(outUploads, { recursive: true, force: true });
  if (existsSync(uploads)) cpSync(uploads, outUploads, { recursive: true });
  else mkdirSync(outUploads, { recursive: true });
  return { database: outDb, uploads: outUploads };
}

export function restoreDataDir(archiveDir, targetDir) {
  const srcDb = join(archiveDir, DB_NAME);
  if (!existsSync(srcDb)) {
    throw new Error(`Backup has no ${DB_NAME} in ${archiveDir}`);
  }
  mkdirSync(targetDir, { recursive: true });
  for (const name of [DB_NAME, `${DB_NAME}-wal`, `${DB_NAME}-shm`]) {
    rmSync(join(targetDir, name), { force: true });
  }
  cpSync(srcDb, join(targetDir, DB_NAME));
  const srcUploads = join(archiveDir, "uploads");
  const destUploads = join(targetDir, "uploads");
  rmSync(destUploads, { recursive: true, force: true });
  if (existsSync(srcUploads)) cpSync(srcUploads, destUploads, { recursive: true });
  else mkdirSync(destUploads, { recursive: true });
  return { database: join(targetDir, DB_NAME), uploads: destUploads };
}
