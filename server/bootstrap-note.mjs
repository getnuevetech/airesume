import { chmodSync, writeFileSync } from "node:fs";

/** Write first-boot admin credentials so only the file owner can read them. */
export function writeAdminBootstrapFile(path, note) {
  writeFileSync(path, note, { flag: "wx", mode: 0o600 });
  chmodSync(path, 0o600);
}
