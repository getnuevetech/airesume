import assert from "node:assert/strict";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { writeAdminBootstrapFile } from "./bootstrap-note.mjs";

test("admin bootstrap file is owner read/write only", () => {
  const dir = mkdtempSync(join(tmpdir(), "jp-bootstrap-"));
  const path = join(dir, "admin-bootstrap.txt");
  try {
    writeAdminBootstrapFile(path, "email: admin@example.com\npassword: secret-value\n");
    assert.equal(statSync(path).mode & 0o777, 0o600);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
