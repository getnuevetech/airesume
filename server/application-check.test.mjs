import assert from "node:assert/strict";
import test from "node:test";
import { checkAnswer, recordApplicationCheck } from "./application-check.mjs";
import { ensureFollowUpReminder, listFollowUpReminders } from "./follow-ups.mjs";
import { migrate } from "./schema.mjs";
import { db, id } from "./db.mjs";

test("check-in answers are the four candidate outcomes", () => {
  assert.equal(checkAnswer("interview").status, "Interview");
  assert.equal(checkAnswer("Waiting").label, "Still waiting");
  assert.throws(() => checkAnswer("Kubernetes"), /still waiting, they replied, interview, or rejected/);
});

test("a check-in saves history and moves the stage", () => {
  migrate();
  const userId = id("usr");
  const jobId = id("job");
  const appId = id("app");
  const now = Date.now();
  db.prepare(
    `INSERT INTO jobs (id, title, company, created_at) VALUES (?, 'Growth Product Manager', 'Kindred', ?)`,
  ).run(jobId, now);
  db.prepare(
    `INSERT INTO applications (id, user_id, job_id, mode, status, match_score, target_company, created_at, updated_at)
     VALUES (?, ?, ?, 'assisted', 'Applied', 82, 'Kindred', ?, ?)`,
  ).run(appId, userId, jobId, now, now);
  try {
    const reminder = ensureFollowUpReminder({
      userId,
      applicationId: appId,
      status: "Applied",
      company: "Kindred",
      title: "Growth Product Manager",
      now: now - 4 * 24 * 60 * 60 * 1000,
    });
    const waiting = recordApplicationCheck({ userId, reminderId: reminder.id, answer: "waiting", now });
    assert.equal(waiting.status, "Applied");
    assert.match(waiting.message, /Still waiting is saved/);
    assert.equal(db.prepare("SELECT status FROM applications WHERE id = ?").get(appId).status, "Applied");
    const snoozed = listFollowUpReminders(userId).find((item) => item.id === reminder.id);
    assert.equal(snoozed.status, "snoozed");

    const interviewed = recordApplicationCheck({ userId, reminderId: reminder.id, answer: "interview", now: now + 1000 });
    assert.equal(interviewed.status, "Interview");
    assert.equal(db.prepare("SELECT status FROM applications WHERE id = ?").get(appId).status, "Interview");
    const checks = db.prepare("SELECT label FROM application_checks WHERE application_id = ? ORDER BY created_at ASC").all(appId);
    assert.deepEqual(checks.map((row) => row.label), ["Still waiting", "Interview"]);
    const open = listFollowUpReminders(userId);
    assert.ok(open.some((item) => item.kind === "interview_followup"));
    assert.equal(open.some((item) => item.id === reminder.id), false);

    const rejectedReminder = open.find((item) => item.kind === "interview_followup");
    const rejected = recordApplicationCheck({
      userId,
      reminderId: rejectedReminder.id,
      answer: "rejected",
      now: now + 2000,
    });
    assert.equal(rejected.status, "Rejected");
    assert.equal(listFollowUpReminders(userId).length, 0);
  } finally {
    db.prepare("DELETE FROM application_checks WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM follow_up_reminders WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM applications WHERE id = ?").run(appId);
    db.prepare("DELETE FROM jobs WHERE id = ?").run(jobId);
  }
});
