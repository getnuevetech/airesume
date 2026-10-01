/** One-tap outcome check-ins for a tracked application. */

import { db, id } from "./db.mjs";
import { ensureFollowUpReminder, updateFollowUpReminder } from "./follow-ups.mjs";

export const CHECK_ANSWERS = {
  waiting: { label: "Still waiting", status: "", snoozeDays: 3 },
  replied: { label: "They replied", status: "Responded", snoozeDays: 0 },
  interview: { label: "Interview", status: "Interview", snoozeDays: 0 },
  rejected: { label: "Rejected", status: "Rejected", snoozeDays: 0 },
};

export function checkAnswer(answer) {
  const key = String(answer || "").trim().toLowerCase();
  const spec = CHECK_ANSWERS[key];
  if (!spec) throw new Error("Choose still waiting, they replied, interview, or rejected.");
  return { key, ...spec };
}

function publicCheck(row) {
  return {
    id: row.id,
    applicationId: row.application_id,
    answer: row.answer,
    label: row.label,
    fromStatus: row.from_status || "",
    toStatus: row.to_status || "",
    createdAt: row.created_at,
  };
}

export function checksByApplication(userId) {
  const rows = db
    .prepare(
      `SELECT * FROM application_checks WHERE user_id = ? ORDER BY created_at DESC`,
    )
    .all(userId);
  const grouped = new Map();
  for (const row of rows) {
    const list = grouped.get(row.application_id) || [];
    if (list.length < 8) list.push(publicCheck(row));
    grouped.set(row.application_id, list);
  }
  return grouped;
}

/**
 * Save the candidate's answer on the due application and move the stage when they heard back.
 */
export function recordApplicationCheck({ userId, reminderId, answer, now = Date.now() } = {}) {
  const spec = checkAnswer(answer);
  const reminder = db.prepare("SELECT * FROM follow_up_reminders WHERE id = ? AND user_id = ?").get(reminderId, userId);
  if (!reminder) return { error: "Reminder not found." };
  if (!["open", "snoozed"].includes(reminder.status)) return { error: "That reminder is already closed." };
  const application = db.prepare("SELECT * FROM applications WHERE id = ? AND user_id = ?").get(reminder.application_id, userId);
  if (!application) return { error: "Application not found." };

  const fromStatus = application.status;
  const toStatus = spec.status || fromStatus;
  const checkId = id("chk");
  db.prepare(
    `INSERT INTO application_checks
      (id, user_id, application_id, reminder_id, answer, label, from_status, to_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(checkId, userId, application.id, reminder.id, spec.key, spec.label, fromStatus, toStatus, now);

  if (spec.status && spec.status !== fromStatus) {
    db.prepare("UPDATE applications SET status = ?, updated_at = ? WHERE id = ?").run(toStatus, now, application.id);
  }

  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(application.job_id);
  const company = application.target_company || job?.primary_company || job?.company || reminder.company || "";
  const title = job?.title || reminder.role_title || "this role";

  if (spec.snoozeDays) {
    updateFollowUpReminder(userId, reminder.id, "snooze", { snoozeDays: spec.snoozeDays, now });
  } else {
    updateFollowUpReminder(userId, reminder.id, "done", { now });
    ensureFollowUpReminder({
      userId,
      applicationId: application.id,
      status: toStatus,
      company,
      title,
      now,
    });
  }

  const check = publicCheck(db.prepare("SELECT * FROM application_checks WHERE id = ?").get(checkId));
  const message = spec.snoozeDays
    ? `${spec.label} is saved on ${title}. JobPilot will ask again in ${spec.snoozeDays} days.`
    : `${spec.label} is saved on ${title}. The stage is now ${toStatus}.`;
  return { check, status: toStatus, message };
}
