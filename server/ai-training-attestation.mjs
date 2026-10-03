/** Operator attestation that AI training-on-customer-data is disabled where vendors allow. */

import { db } from "./db.mjs";

const SETTINGS_KEY = "ai_training_attestation";

export function readAiTrainingAttestation() {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(SETTINGS_KEY);
  if (!row?.value) {
    return { attested: false, at: null, note: "" };
  }
  try {
    const parsed = JSON.parse(row.value);
    const at = Number(parsed.at || 0) || null;
    return {
      attested: Boolean(at && parsed.attested),
      at,
      note: String(parsed.note || ""),
    };
  } catch {
    return { attested: false, at: null, note: "" };
  }
}

export function saveAiTrainingAttestation({ attested, note = "", at = Date.now() } = {}) {
  if (!attested) {
    db.prepare("DELETE FROM settings WHERE key = ?").run(SETTINGS_KEY);
    return { attested: false, at: null, note: "" };
  }
  const payload = {
    attested: true,
    at: Number(at) || Date.now(),
    note: String(note || "").trim().slice(0, 500),
  };
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(
    SETTINGS_KEY,
    JSON.stringify(payload),
  );
  return { attested: true, at: payload.at, note: payload.note };
}

export function aiTrainingAttestationStatus(attestation = readAiTrainingAttestation()) {
  if (attestation.attested && attestation.at) {
    return {
      ok: true,
      attested: true,
      at: attestation.at,
      detail: `Operator attested training-on-customer-data is disabled where vendors allow (${new Date(attestation.at).toISOString()}).`,
    };
  }
  return {
    ok: false,
    attested: false,
    at: null,
    detail:
      "Confirm in each live AI vendor console that training on customer data is off, then attest under Admin → AI.",
  };
}
