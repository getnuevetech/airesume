import assert from "node:assert/strict";
import test from "node:test";
import { checkAnswer, cleanCheckNote, recordApplicationCheck } from "./application-check.mjs";
import { ensureFollowUpReminder, listFollowUpReminders } from "./follow-ups.mjs";
import { migrate } from "./schema.mjs";
import { db, id } from "./db.mjs";

test("check-in answers are the four candidate outcomes", () => {
  assert.equal(checkAnswer("interview").status, "Interview");
  assert.equal(checkAnswer("Waiting").label, "Still waiting");
  assert.throws(() => checkAnswer("Kubernetes"), /still waiting, they replied, interview, or rejected/);
  assert.equal(cleanCheckNote("  Asked for a portfolio.  "), "Asked for a portfolio.");
  assert.throws(() => cleanCheckNote("x".repeat(241)), /one short sentence/);
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

test("a check-in on the application saves one sentence and moves the stage", () => {
  migrate();
  const userId = id("usr");
  const jobId = id("job");
  const preparingJobId = id("job");
  const appId = id("app");
  const preparingId = id("app");
  const now = Date.now();
  db.prepare(
    `INSERT INTO jobs (id, title, company, created_at) VALUES (?, 'Growth Product Manager', 'Kindred', ?)`,
  ).run(jobId, now);
  db.prepare(
    `INSERT INTO jobs (id, title, company, created_at) VALUES (?, 'Senior Product Manager', 'Northstar', ?)`,
  ).run(preparingJobId, now);
  db.prepare(
    `INSERT INTO applications (id, user_id, job_id, mode, status, match_score, target_company, created_at, updated_at)
     VALUES (?, ?, ?, 'assisted', 'Applied', 82, 'Kindred', ?, ?)`,
  ).run(appId, userId, jobId, now, now);
  db.prepare(
    `INSERT INTO applications (id, user_id, job_id, mode, status, match_score, target_company, created_at, updated_at)
     VALUES (?, ?, ?, 'assisted', 'Review required', 79, 'Northstar', ?, ?)`,
  ).run(preparingId, userId, preparingJobId, now, now);
  try {
    const waiting = recordApplicationCheck({ userId, applicationId: appId, answer: "waiting", now });
    assert.equal(waiting.status, "Applied");
    assert.match(waiting.message, /ask again in 3 days/);
    assert.equal(listFollowUpReminders(userId)[0].status, "snoozed");

    const replied = recordApplicationCheck({
      userId,
      applicationId: appId,
      answer: "replied",
      note: "  Asked for a portfolio Thursday  ",
      now: now + 1000,
    });
    assert.equal(replied.status, "Responded");
    assert.equal(replied.check.note, "Asked for a portfolio Thursday");
    assert.match(replied.message, /Asked for a portfolio Thursday/);
    assert.match(replied.message, /stage is now Responded/);
    assert.equal(db.prepare("SELECT status FROM applications WHERE id = ?").get(appId).status, "Responded");
    assert.ok(listFollowUpReminders(userId).some((item) => item.kind === "response_prep"));

    const blocked = recordApplicationCheck({
      userId,
      applicationId: preparingId,
      answer: "interview",
      now: now + 2000,
    });
    assert.equal(blocked.error, "Check in after you apply.");
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM application_checks WHERE application_id = ?").get(preparingId).count, 0);
  } finally {
    db.prepare("DELETE FROM application_checks WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM follow_up_reminders WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM applications WHERE user_id = ?").run(userId);
    db.prepare("DELETE FROM jobs WHERE id = ?").run(jobId);
    db.prepare("DELETE FROM jobs WHERE id = ?").run(preparingJobId);
  }
});
