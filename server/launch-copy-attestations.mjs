/** Launch attestations for audience (U.S./18+) and no advertising cookies. */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "./db.mjs";
import { applyLegalEntityToText, getLegalEntity } from "./legal-entity.mjs";
import { repoRootFromHere } from "./legal-placeholders.mjs";

const AUDIENCE_KEY = "launch_audience_attestation";
const ADS_KEY = "launch_ads_cookie_attestation";

const AUDIENCE_MARKERS = [
  { id: "AGE_18", re: /under\s*18|children under eighteen/i },
  { id: "ADULTS", re: /\badults\b|not directed to children/i },
  { id: "US_FIRST", re: /United States|U\.S\. State Privacy|Texas and Other U\.S\./i },
];

const ADS_MARKERS = [
  { id: "NO_ADS_COOKIES", re: /advertising or cross-site tracking cookies are not enabled/i },
];

const AD_SCRIPT_PATTERNS = [
  { id: "GTAG", re: /googletagmanager\.com|google-analytics\.com|gtag\s*\(/i },
  { id: "META_PIXEL", re: /connect\.facebook\.net|fbq\s*\(/i },
  { id: "ADS_SCRIPT", re: /doubleclick\.net|adservice\.google/i },
];

const SCAN_FILES = [
  { path: "src/content/privacy.ts", label: "Privacy" },
  { path: "src/content/terms.ts", label: "Terms" },
];

const SCRIPT_SCAN_FILES = ["index.html", "src/index.html", "src/App.tsx", "src/main.tsx", "src/components/CookieSettings.tsx"];

function readAttestation(key) {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  if (!row?.value) return { attested: false, at: null };
  try {
    const parsed = JSON.parse(row.value);
    const at = Number(parsed.at || 0) || null;
    return { attested: Boolean(at && parsed.attested), at };
  } catch {
    return { attested: false, at: null };
  }
}

function writeAttestation(key, attested, at = Date.now()) {
  if (!attested) {
    db.prepare("DELETE FROM settings WHERE key = ?").run(key);
    return { attested: false, at: null };
  }
  const payload = { attested: true, at: Number(at) || Date.now() };
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(
    key,
    JSON.stringify(payload),
  );
  return payload;
}

function readResolvedPrivacy(rootDir) {
  const entity = getLegalEntity();
  const parts = [];
  for (const file of SCAN_FILES) {
    try {
      const text = readFileSync(join(rootDir, file.path), "utf8");
      parts.push(applyLegalEntityToText(text, entity));
    } catch {
      // missing file handled by missing markers
    }
  }
  return parts.join("\n");
}

export function scanAudiencePositioning(rootDir = repoRootFromHere()) {
  const text = readResolvedPrivacy(rootDir);
  const missing = AUDIENCE_MARKERS.filter((marker) => {
    marker.re.lastIndex = 0;
    return !marker.re.test(text);
  }).map((marker) => marker.id);
  return {
    ok: missing.length === 0,
    missing,
    detail: missing.length
      ? `Legal copy is missing audience markers: ${missing.join(", ")}. Keep U.S.-first / 18+ language in Privacy before attesting.`
      : "Privacy still states adults / under-18 and U.S. positioning.",
  };
}

export function scanAdsCookiePolicy(rootDir = repoRootFromHere()) {
  const text = readResolvedPrivacy(rootDir);
  const missing = ADS_MARKERS.filter((marker) => {
    marker.re.lastIndex = 0;
    return !marker.re.test(text);
  }).map((marker) => marker.id);

  /** @type {string[]} */
  const scriptHits = [];
  for (const rel of SCRIPT_SCAN_FILES) {
    const absolute = join(rootDir, rel);
    if (!existsSync(absolute)) continue;
    let body = "";
    try {
      body = readFileSync(absolute, "utf8");
    } catch {
      continue;
    }
    for (const pattern of AD_SCRIPT_PATTERNS) {
      pattern.re.lastIndex = 0;
      if (pattern.re.test(body) && !scriptHits.includes(pattern.id)) scriptHits.push(pattern.id);
    }
  }

  const ok = missing.length === 0 && scriptHits.length === 0;
  let detail = "Privacy still says advertising/cross-site cookies are not enabled, and no ad scripts were found in the app shell.";
  if (missing.length || scriptHits.length) {
    const bits = [];
    if (missing.length) bits.push(`Privacy missing: ${missing.join(", ")}`);
    if (scriptHits.length) bits.push(`Ad script markers in source: ${scriptHits.join(", ")}`);
    detail = `${bits.join(". ")}. Update Privacy / Cookie Settings before attesting.`;
  }
  return { ok, missing, scriptHits, detail };
}

export function readAudienceAttestation() {
  return readAttestation(AUDIENCE_KEY);
}

export function readAdsCookieAttestation() {
  return readAttestation(ADS_KEY);
}

export function saveAudienceAttestation({ attested, at } = {}) {
  return writeAttestation(AUDIENCE_KEY, Boolean(attested), at);
}

export function saveAdsCookieAttestation({ attested, at } = {}) {
  return writeAttestation(ADS_KEY, Boolean(attested), at);
}

export function audiencePositioningStatus(options = {}) {
  const rootDir = options.rootDir || repoRootFromHere();
  const scan = options.scan || scanAudiencePositioning(rootDir);
  const attestation = options.attestation || readAudienceAttestation();
  if (!scan.ok) {
    return { ok: false, scan, attestation, detail: scan.detail };
  }
  if (!attestation.attested) {
    return {
      ok: false,
      scan,
      attestation,
      detail: "Confirm U.S.-first / 18+ positioning is still accurate, then attest under Admin → Launch.",
    };
  }
  return {
    ok: true,
    scan,
    attestation,
    detail: `Operator attested U.S.-first / 18+ copy is accurate (${new Date(attestation.at).toISOString()}).`,
  };
}

export function adsCookieStatus(options = {}) {
  const rootDir = options.rootDir || repoRootFromHere();
  const scan = options.scan || scanAdsCookiePolicy(rootDir);
  const attestation = options.attestation || readAdsCookieAttestation();
  if (!scan.ok) {
    return { ok: false, scan, attestation, detail: scan.detail };
  }
  if (!attestation.attested) {
    return {
      ok: false,
      scan,
      attestation,
      detail: "Confirm no advertising/cross-site cookies without a Privacy update, then attest under Admin → Launch.",
    };
  }
  return {
    ok: true,
    scan,
    attestation,
    detail: `Operator attested no advertising/cross-site cookies (${new Date(attestation.at).toISOString()}).`,
  };
}

export function launchAttestationsPayload(rootDir = repoRootFromHere()) {
  return {
    audience: audiencePositioningStatus({ rootDir }),
    adsCookies: adsCookieStatus({ rootDir }),
  };
}
