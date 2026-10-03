import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  adsCookieStatus,
  audiencePositioningStatus,
  saveAdsCookieAttestation,
  saveAudienceAttestation,
  scanAdsCookiePolicy,
  scanAudiencePositioning,
} from "./launch-copy-attestations.mjs";
import { db } from "./db.mjs";

function clearAttestations() {
  db.prepare("DELETE FROM settings WHERE key = 'launch_audience_attestation'").run();
  db.prepare("DELETE FROM settings WHERE key = 'launch_ads_cookie_attestation'").run();
}

function writePrivacy(root, body) {
  mkdirSync(join(root, "src/content"), { recursive: true });
  writeFileSync(join(root, "src/content/privacy.ts"), body, "utf8");
  writeFileSync(join(root, "src/content/terms.ts"), "export const terms = '';\n", "utf8");
}

const fullPrivacy = `
The Service is intended for adults and is not directed to children under 18.
Texas and Other U.S. State Privacy Rights apply in the United States.
Launch assumption: advertising or cross-site tracking cookies are not enabled.
`;

test("audience scan requires 18+ and U.S. markers", () => {
  const root = mkdtempSync(join(tmpdir(), "jp-audience-"));
  writePrivacy(root, "No audience language here.");
  const missing = scanAudiencePositioning(root);
  assert.equal(missing.ok, false);
  assert.ok(missing.missing.includes("AGE_18"));
  assert.ok(missing.missing.includes("ADULTS"));
  assert.ok(missing.missing.includes("US_FIRST"));

  writePrivacy(root, fullPrivacy);
  const ok = scanAudiencePositioning(root);
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.missing, []);
});

test("ads cookie scan requires Privacy line and rejects ad scripts", () => {
  const root = mkdtempSync(join(tmpdir(), "jp-ads-"));
  writePrivacy(root, fullPrivacy);
  writeFileSync(join(root, "index.html"), "<script src='https://www.googletagmanager.com/gtag/js'></script>", "utf8");
  const withScript = scanAdsCookiePolicy(root);
  assert.equal(withScript.ok, false);
  assert.ok(withScript.scriptHits.includes("GTAG"));

  writeFileSync(join(root, "index.html"), "<html></html>", "utf8");
  const clean = scanAdsCookiePolicy(root);
  assert.equal(clean.ok, true);
  assert.deepEqual(clean.scriptHits, []);
});

test("audience attestation needs scan + operator confirm", () => {
  clearAttestations();
  const root = mkdtempSync(join(tmpdir(), "jp-audience-attest-"));
  writePrivacy(root, fullPrivacy);
  assert.equal(audiencePositioningStatus({ rootDir: root }).ok, false);
  assert.match(audiencePositioningStatus({ rootDir: root }).detail, /Admin → Launch/);

  const saved = saveAudienceAttestation({ attested: true, at: 1_700_000_000_000 });
  assert.equal(saved.attested, true);
  assert.equal(audiencePositioningStatus({ rootDir: root }).ok, true);

  saveAudienceAttestation({ attested: false });
  assert.equal(audiencePositioningStatus({ rootDir: root }).ok, false);
});

test("ads cookie attestation needs scan + operator confirm", () => {
  clearAttestations();
  const root = mkdtempSync(join(tmpdir(), "jp-ads-attest-"));
  writePrivacy(root, fullPrivacy);
  writeFileSync(join(root, "index.html"), "<html></html>", "utf8");
  assert.equal(adsCookieStatus({ rootDir: root }).ok, false);

  saveAdsCookieAttestation({ attested: true, at: 1_700_000_100_000 });
  assert.equal(adsCookieStatus({ rootDir: root }).ok, true);

  saveAdsCookieAttestation({ attested: false });
  assert.equal(adsCookieStatus({ rootDir: root }).ok, false);
});

test("repo Privacy still carries audience and no-ads markers", () => {
  const root = join(import.meta.dirname, "..");
  assert.equal(scanAudiencePositioning(root).ok, true);
  assert.equal(scanAdsCookiePolicy(root).ok, true);
});
