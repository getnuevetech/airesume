/** Follow-up reminders for submitted applications. */

import { db, id } from "./db.mjs";

const DAY = 24 * 60 * 60 * 1000;

const TEMPLATES = {
  Applied: {
    kind: "apply_followup",
    title: "Send a polite application follow-up",
    detail: "If you have not heard back, send a short note confirming interest. Do not invent new claims.",
    delayMs: 3 * DAY,
  },
  Responded: {
    kind: "response_prep",
    title: "Prepare for the next conversation",
    detail: "Review interview prep and pinned resume bullets before you reply.",
    delayMs: 1 * DAY,
  },
  Interview: {
    kind: "interview_followup",
    title: "Send a thank-you / interview follow-up",
    detail: "Thank the interviewer and restate interest using only resume facts.",
    delayMs: 1 * DAY,
  },
  Offer: {
    kind: "offer_review",
    title: "Review the offer details carefully",
    detail: "Confirm compensation, start date, and authorization questions yourself before accepting.",
    delayMs: 0,
  },
};

export function reminderTemplatesForStatus(status) {
  return TEMPLATES[String(status || "")] || null;
}

/**
 * Ensure a follow-up reminder exists for an application when status warrants one.
 */
export function ensureFollowUpReminder({ userId, applicationId, status, company = "", title = "", now = Date.now() } = {}) {
  const template = reminderTemplatesForStatus(status);
  if (!template || !userId || !applicationId) return null;

  const open = db
    .prepare(
      `SELECT * FROM follow_up_reminders
       WHERE user_id = ? AND application_id = ? AND kind = ? AND status IN ('open', 'snoozed')
       ORDER BY due_at ASC LIMIT 1`,
    )
    .get(userId, applicationId, template.kind);
  if (open) return publicReminder(open);

  const reminderId = id("fup");
  const dueAt = now + template.delayMs;
  db.prepare(
    `INSERT INTO follow_up_reminders
      (id, user_id, application_id, kind, title, detail, company, role_title, status, due_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)`,
  ).run(
    reminderId,
    userId,
    applicationId,
    template.kind,
    template.title,
    template.detail,
    String(company || "").slice(0, 160),
    String(title || "").slice(0, 160),
    dueAt,
    now,
    now,
  );
  return publicReminder(db.prepare("SELECT * FROM follow_up_reminders WHERE id = ?").get(reminderId));
}

export function publicReminder(row) {
  if (!row) return null;
  return {
    id: row.id,
    applicationId: row.application_id,
    kind: row.kind,
    title: row.title,
    detail: row.detail,
    company: row.company || "",
    roleTitle: row.role_title || "",
    status: row.status,
    dueAt: row.due_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    overdue: row.status === "open" && Number(row.due_at) <= Date.now(),
  };
}

export function listFollowUpReminders(userId, { includeDone = false, now = Date.now() } = {}) {
  const rows = includeDone
    ? db
        .prepare(
          `SELECT * FROM follow_up_reminders WHERE user_id = ?
           ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'snoozed' THEN 1 ELSE 2 END, due_at ASC
           LIMIT 50`,
        )
        .all(userId)
    : db
        .prepare(
          `SELECT * FROM follow_up_reminders
           WHERE user_id = ? AND status IN ('open', 'snoozed')
           ORDER BY due_at ASC LIMIT 40`,
        )
        .all(userId);
  return rows.map((row) => {
    const item = publicReminder(row);
    item.overdue = ["open", "snoozed"].includes(row.status) && Number(row.due_at) <= now;
    return item;
  });
}

export function followUpMetrics(userId, now = Date.now()) {
  const open = db
    .prepare(`SELECT COUNT(*) AS count FROM follow_up_reminders WHERE user_id = ? AND status IN ('open', 'snoozed')`)
    .get(userId).count;
  const due = db
    .prepare(
      `SELECT COUNT(*) AS count FROM follow_up_reminders
       WHERE user_id = ? AND status IN ('open', 'snoozed') AND due_at <= ?`,
    )
    .get(userId, now).count;
  const done = db
    .prepare(`SELECT COUNT(*) AS count FROM follow_up_reminders WHERE user_id = ? AND status = 'done'`)
    .get(userId).count;
  return { open, due, done };
}

export function updateFollowUpReminder(userId, reminderId, action, { snoozeDays = 2, now = Date.now() } = {}) {
  const row = db.prepare("SELECT * FROM follow_up_reminders WHERE id = ? AND user_id = ?").get(reminderId, userId);
  if (!row) return { error: "Reminder not found." };
  if (!["open", "snoozed"].includes(row.status) && action !== "reopen") {
    return { error: "That reminder is already closed." };
  }
  let status = row.status;
  let dueAt = row.due_at;
  if (action === "done" || action === "complete") {
    status = "done";
  } else if (action === "dismiss") {
    status = "dismissed";
  } else if (action === "snooze") {
    status = "snoozed";
    dueAt = now + Math.max(1, Math.min(14, Number(snoozeDays) || 2)) * DAY;
  } else if (action === "reopen") {
    status = "open";
    dueAt = now + DAY;
  } else {
    return { error: "Choose done, dismiss, or snooze." };
  }
  db.prepare("UPDATE follow_up_reminders SET status = ?, due_at = ?, updated_at = ? WHERE id = ?").run(
    status,
    dueAt,
    now,
    row.id,
  );
  return { reminder: publicReminder(db.prepare("SELECT * FROM follow_up_reminders WHERE id = ?").get(row.id)) };
}

/**
 * Sync reminders from current application statuses (idempotent).
 */
export function syncFollowUpsForUser(userId, applications = [], jobsById = new Map()) {
  const created = [];
  for (const app of applications) {
    if (!reminderTemplatesForStatus(app.status)) continue;
    const job = jobsById.get(app.job_id) || null;
    const reminder = ensureFollowUpReminder({
      userId,
      applicationId: app.id,
      status: app.status,
      company: app.target_company || job?.primary_company || job?.company || "",
      title: job?.title || "",
    });
    if (reminder) created.push(reminder);
  }
  return created;
}
