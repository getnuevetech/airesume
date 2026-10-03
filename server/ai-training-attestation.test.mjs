import assert from "node:assert/strict";
import test from "node:test";
import { db } from "./db.mjs";
import {
  aiTrainingAttestationStatus,
  readAiTrainingAttestation,
  saveAiTrainingAttestation,
} from "./ai-training-attestation.mjs";

function clearAttestation() {
  db.prepare("DELETE FROM settings WHERE key = 'ai_training_attestation'").run();
}

test("AI training attestation starts open until the operator confirms", () => {
  clearAttestation();
  assert.equal(readAiTrainingAttestation().attested, false);
  assert.equal(aiTrainingAttestationStatus().ok, false);
  assert.match(aiTrainingAttestationStatus().detail, /Admin → AI/);
});

test("saving attestation passes the launch status; clearing it reopens", () => {
  clearAttestation();
  const saved = saveAiTrainingAttestation({ attested: true, at: 1_700_000_000_000 });
  assert.equal(saved.attested, true);
  assert.equal(aiTrainingAttestationStatus(saved).ok, true);
  const cleared = saveAiTrainingAttestation({ attested: false });
  assert.equal(cleared.attested, false);
  assert.equal(aiTrainingAttestationStatus(cleared).ok, false);
});
