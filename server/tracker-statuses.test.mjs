import assert from "node:assert/strict";
import test from "node:test";
import {
  TRACKER_STATUSES,
  SUBMITTED_STATUSES,
  OUTCOME_STATUSES,
  PREP_ELIGIBLE_STATUSES,
  isOutcomeStatus,
  isSubmittedStatus,
} from "./apply-rules.mjs";
import { reminderTemplatesForStatus } from "./follow-ups.mjs";

test("tracker includes Employer viewed, Recruiter contact, and Hired", () => {
  for (const status of ["Employer viewed", "Recruiter contact", "Hired"]) {
    assert.ok(TRACKER_STATUSES.includes(status), status);
    assert.ok(isSubmittedStatus(status), status);
  }
  assert.ok(isOutcomeStatus("Employer viewed"));
  assert.ok(isOutcomeStatus("Recruiter contact"));
  assert.ok(isOutcomeStatus("Hired"));
  assert.ok(SUBMITTED_STATUSES.has("Hired"));
  assert.ok(OUTCOME_STATUSES.has("Recruiter contact"));
  assert.ok(PREP_ELIGIBLE_STATUSES.includes("Employer viewed"));
  assert.ok(PREP_ELIGIBLE_STATUSES.includes("Hired"));
});

test("follow-up templates cover new outcome statuses", () => {
  assert.equal(reminderTemplatesForStatus("Employer viewed")?.kind, "viewed_followup");
  assert.equal(reminderTemplatesForStatus("Recruiter contact")?.kind, "recruiter_reply");
  assert.equal(reminderTemplatesForStatus("Hired")?.kind, "hired_confirm");
});
