/** One-tap outcome check-ins for a tracked application. */

import { db, id } from "./db.mjs";
import { ensureFollowUpReminder, updateFollowUpReminder } from "./follow-ups.mjs";

export const CHECK_ANSWERS = {
  waiting: { label: "Still waiting", status: "", snoozeDays: 3 },
  replied: { label: "They replied", status: "Responded", snoozeDays: 0 },
  interview: { label: "Interview", status: "Interview", snoozeDays: 0 },
  rejected: { label: "Rejected", status: "Rejected", snoozeDays: 0 },
};

const CHECK_IN_STATUSES = new Set([
  "Applied",
  "Employer viewed",
  "Recruiter contact",
  "Responded",
  "Interview",
  "Offer",
  "Hired",
]);

const NOTE_LIMIT = 240;

export function checkAnswer(answer) {
  const key = String(answer || "").trim().toLowerCase();
  const spec = CHECK_ANSWERS[key];
  if (!spec) throw new Error("Choose still waiting, they replied, interview, or rejected.");
  return { key, ...spec };
}

export function cleanCheckNote(note) {
  const text = String(note ?? "").replace(/\s+/g, " ").trim();
  if (text.length > NOTE_LIMIT) throw new Error("Keep the note to one short sentence.");
  return text;
}

function publicCheck(row) {
  return {
    id: row.id,
    applicationId: row.application_id,
    answer: row.answer,
    label: row.label,
    note: row.note || "",
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

function checkMessage(spec, title, note, toStatus) {
  const heard = note ? ` ${/[.!?]$/.test(note) ? note : `${note}.`}` : "";
  if (spec.snoozeDays) {
    return `${spec.label} is saved on ${title}.${heard} JobPilot will ask again in ${spec.snoozeDays} days.`;
  }
  return `${spec.label} is saved on ${title}.${heard} The stage is now ${toStatus}.`;
}

function openReminder(userId, applicationId) {
  return db
    .prepare(
      `SELECT * FROM follow_up_reminders
       WHERE user_id = ? AND application_id = ? AND status IN ('open', 'snoozed')
       ORDER BY due_at ASC LIMIT 1`,
    )
    .get(userId, applicationId);
}

/**
 * Save the candidate's answer on an applied role and move the stage when they heard back.
 * A reminder is optional: the application card can check in on its own.
 */
export function recordApplicationCheck({ userId, reminderId = "", applicationId = "", answer, note = "", now = Date.now() } = {}) {
  const spec = checkAnswer(answer);
  const savedNote = cleanCheckNote(note);

  let reminder = null;
  let application = null;
  if (reminderId) {
    reminder = db.prepare("SELECT * FROM follow_up_reminders WHERE id = ? AND user_id = ?").get(reminderId, userId);
    if (!reminder) return { error: "Reminder not found." };
    if (!["open", "snoozed"].includes(reminder.status)) return { error: "That reminder is already closed." };
    application = db.prepare("SELECT * FROM applications WHERE id = ? AND user_id = ?").get(reminder.application_id, userId);
  } else {
    application = db.prepare("SELECT * FROM applications WHERE id = ? AND user_id = ?").get(applicationId, userId);
    if (!application) return { error: "Application not found." };
    if (!CHECK_IN_STATUSES.has(application.status)) return { error: "Check in after you apply." };
    reminder = openReminder(userId, application.id);
  }
  if (!application) return { error: "Application not found." };

  const fromStatus = application.status;
  const toStatus = spec.status || fromStatus;
  const checkId = id("chk");
  db.prepare(
    `INSERT INTO application_checks
      (id, user_id, application_id, reminder_id, answer, label, note, from_status, to_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(checkId, userId, application.id, reminder?.id || "", spec.key, spec.label, savedNote, fromStatus, toStatus, now);

  if (spec.status && spec.status !== fromStatus) {
    db.prepare("UPDATE applications SET status = ?, updated_at = ? WHERE id = ?").run(toStatus, now, application.id);
  }

  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(application.job_id);
  const company = application.target_company || job?.primary_company || job?.company || reminder?.company || "";
  const title = job?.title || reminder?.role_title || "this role";

  if (reminder && ["open", "snoozed"].includes(reminder.status)) {
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
  } else if (spec.snoozeDays) {
    const created = ensureFollowUpReminder({
      userId,
      applicationId: application.id,
      status: fromStatus,
      company,
      title,
      now,
    });
    if (created) updateFollowUpReminder(userId, created.id, "snooze", { snoozeDays: spec.snoozeDays, now });
  } else {
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
  return { check, status: toStatus, message: checkMessage(spec, title, savedNote, toStatus) };
}
