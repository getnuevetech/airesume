import { randomBytes, randomInt } from "node:crypto";
import { existsSync, unlinkSync } from "node:fs";
import { basename, join } from "node:path";
import { db, hashPassword, id, sha256, uploadsDir } from "./db.mjs";
import { deliverMail } from "./mail.mjs";
import {
  SALARY_RANGE_OPTIONS,
  WORK_ARRANGEMENT_OPTIONS,
  WORK_AUTHORIZATION_OPTIONS,
} from "./preference-options.mjs";

export const DRAFT_RETENTION_MS = 1000 * 60 * 60 * 24 * 30;

export function purgeExpiredDrafts(now = Date.now()) {
  const cutoff = now - DRAFT_RETENTION_MS;
  const result = db.prepare("DELETE FROM drafts WHERE created_at < ?").run(cutoff);
  db.prepare("DELETE FROM email_activations WHERE expires_at < ? OR (used_at IS NOT NULL AND used_at < ?)").run(
    now,
    now - DRAFT_RETENTION_MS,
  );
  return result.changes || 0;
}

export function missingPreferenceFields(preferences = {}, profile = {}) {
  const prefs = preferences || {};
  const missing = [];
  if (!String(prefs.salary || "").trim()) {
    missing.push({
      key: "salary",
      label: "Target salary",
      placeholder: "Select a range",
      question: "What salary range are you targeting?",
      inputType: "select",
      options: SALARY_RANGE_OPTIONS,
    });
  }
  if (!String(prefs.workArrangement || "").trim()) {
    missing.push({
      key: "workArrangement",
      label: "Work arrangement",
      placeholder: "Select an option",
      question: "Are you open to remote, hybrid, or on-site work?",
      inputType: "select",
      options: WORK_ARRANGEMENT_OPTIONS,
    });
  }
  if (!String(prefs.locations || "").trim() && !String(profile.city || "").trim()) {
    missing.push({
      key: "locations",
      label: "Locations",
      placeholder: "Cities or regions you will consider",
      question: "Which locations are acceptable?",
      inputType: "text",
      options: [],
    });
  }
  if (!String(prefs.workAuthorization || "").trim()) {
    missing.push({
      key: "workAuthorization",
      label: "Work authorization",
      placeholder: "Select an option",
      question: "Are you authorized to work in your target country?",
      inputType: "select",
      options: WORK_AUTHORIZATION_OPTIONS,
    });
  }
  return missing;
}

function otpCode() {
  return String(randomInt(100000, 999999));
}

export async function createEmailActivation({ origin, payload }) {
  const token = randomBytes(24).toString("hex");
  const code = otpCode();
  const activationId = id("act");
  const expiresAt = Date.now() + 1000 * 60 * 60;
  db.prepare(
    `INSERT INTO email_activations (id, draft_id, email, token_hash, code_hash, payload, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    activationId,
    payload.draftId,
    payload.email,
    sha256(token),
    sha256(code),
    JSON.stringify(payload),
    expiresAt,
    Date.now(),
  );
  const link = `${origin}/verify?token=${token}`;
  const delivery = await deliverMail({
    to: payload.email,
    subject: "Activate your JobPilot account",
    body: `Confirm your email to activate your JobPilot account.\n\nOpen this link:\n${link}\n\nOr enter this code: ${code}\n\nThis expires in one hour.`,
  });
  return {
    activationId,
    email: payload.email,
    expiresAt,
    sent: delivery.sent,
    devLink: delivery.sent ? "" : link,
    devCode: delivery.sent ? "" : code,
  };
}

export function findActivation({ token = "", code = "", email = "" }) {
  const now = Date.now();
  if (token) {
    return db
      .prepare("SELECT * FROM email_activations WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?")
      .get(sha256(token), now);
  }
  if (code && email) {
    return db
      .prepare(
        "SELECT * FROM email_activations WHERE email = ? COLLATE NOCASE AND code_hash = ? AND used_at IS NULL AND expires_at > ? ORDER BY created_at DESC LIMIT 1",
      )
      .get(String(email).trim().toLowerCase(), sha256(code), now);
  }
  return null;
}

/** Persist extracted resume fields onto an existing account that does not yet have a profile. */
export function writeProfileFromPayload(userId, payload = {}) {
  const facts = (payload.facts || []).map((fact) => ({ ...fact, verified_by_user: true }));
  const summary = String(payload.summary || "");
  const skills = JSON.stringify(payload.skills || []);
  const employment = JSON.stringify(payload.employment || []);
  const education = JSON.stringify(payload.education || []);
  const preferences = JSON.stringify(payload.preferences || {});
  const rawText = payload.rawText || "";
  const resumeName = payload.resumeName || "";
  const resumeFileUrl = payload.resumeFileUrl || "";
  const updatedAt = Date.now();
  const existing = db.prepare("SELECT user_id FROM profiles WHERE user_id = ?").get(userId);
  if (existing) {
    db.prepare(
      `UPDATE profiles
       SET summary = ?, skills = ?, employment = ?, education = ?, facts = ?, preferences = ?,
           raw_text = ?, resume_name = ?, resume_file_url = CASE WHEN ? != '' THEN ? ELSE resume_file_url END, updated_at = ?
       WHERE user_id = ?`,
    ).run(
      summary,
      skills,
      employment,
      education,
      JSON.stringify(facts),
      preferences,
      rawText,
      resumeName,
      resumeFileUrl,
      resumeFileUrl,
      updatedAt,
      userId,
    );
    return;
  }
  db.prepare(
    `INSERT INTO profiles (user_id, summary, skills, employment, education, facts, preferences, raw_text, resume_name, resume_file_url, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    userId,
    summary,
    skills,
    employment,
    education,
    JSON.stringify(facts),
    preferences,
    rawText,
    resumeName,
    resumeFileUrl,
    updatedAt,
  );
}

/**
 * Attach an onboarding draft to a signed-in user who registered without a resume
 * (Google, direct email signup, etc.). Creates the profile the account Gate expects.
 */
export function applyDraftToUser(userId, payload = {}) {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!user) throw new Error("Account not found.");
  if (db.prepare("SELECT user_id FROM profiles WHERE user_id = ?").get(userId)) {
    throw new Error("This account already has a saved resume. Open Profile or Resume to use it.");
  }
  const name = String(payload.name || "").trim();
  const phone = String(payload.phone || "").trim();
  const address = String(payload.address || "").trim();
  const city = String(payload.city || "").trim();
  if (name.length >= 2 || phone || address || city) {
    db.prepare(
      `UPDATE users
       SET name = CASE WHEN ? != '' THEN ? ELSE name END,
           phone = CASE WHEN phone = '' OR phone IS NULL THEN ? ELSE phone END,
           address = CASE WHEN address = '' OR address IS NULL THEN ? ELSE address END,
           city = CASE WHEN city = '' OR city IS NULL THEN ? ELSE city END
       WHERE id = ?`,
    ).run(name, name || user.name, phone, address, city, userId);
  }
  writeProfileFromPayload(userId, payload);
  if (payload.draftId) db.prepare("DELETE FROM drafts WHERE id = ?").run(payload.draftId);
  return userId;
}

export function activateFromRow(row, { setPassword = "" } = {}) {
  if (!row) throw new Error("This activation link or code is invalid or expired.");
  const payload = JSON.parse(row.payload || "{}");
  const email = String(payload.email || row.email || "").trim().toLowerCase();
  const name = String(payload.name || "").trim();
  if (name.length < 2) throw new Error("Enter the name for this account.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
    throw new Error("An account with this email already exists. Sign in instead.");
  }
  const password = String(setPassword || payload.password || "");
  const passwordHash = password.length >= 8 ? hashPassword(password) : null;
  const userId = id("usr");
  db.prepare(
    `INSERT INTO users (id, name, email, phone, address, city, password_hash, provider, role, status, consent_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'email', 'user', 'active', ?, ?)`,
  ).run(
    userId,
    name,
    email,
    String(payload.phone || ""),
    String(payload.address || ""),
    String(payload.city || ""),
    passwordHash,
    payload.consentAt || Date.now(),
    Date.now(),
  );
  writeProfileFromPayload(userId, payload);
  db.prepare("UPDATE email_activations SET used_at = ? WHERE id = ?").run(Date.now(), row.id);
  if (payload.draftId) db.prepare("DELETE FROM drafts WHERE id = ?").run(payload.draftId);
  return userId;
}

export function exportAccountBundle(userId) {
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  if (!user) return null;
  const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(userId);
  const applications = db.prepare("SELECT * FROM applications WHERE user_id = ? ORDER BY updated_at DESC").all(userId);
  const versions = db
    .prepare("SELECT id, label, created_at FROM resume_versions WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId);
  const subscription = db.prepare("SELECT * FROM subscriptions WHERE user_id = ?").get(userId);
  return {
    exportedAt: new Date().toISOString(),
    account: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || "",
      address: user.address || "",
      city: user.city || "",
      provider: user.provider,
      role: user.role,
      status: user.status,
      planId: user.plan_id || "free",
      createdAt: user.created_at,
      consentAt: user.consent_at,
    },
    profile: profile
      ? {
          summary: profile.summary,
          headline: profile.headline || "",
          skills: JSON.parse(profile.skills || "[]"),
          employment: JSON.parse(profile.employment || "[]"),
          education: JSON.parse(profile.education || "[]"),
          facts: JSON.parse(profile.facts || "[]"),
          preferences: JSON.parse(profile.preferences || "{}"),
          resumeName: profile.resume_name,
          resumeFileUrl: profile.resume_file_url || "",
          slug: profile.slug || "",
        }
      : null,
    applications: applications.map((row) => ({
      id: row.id,
      jobId: row.job_id,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    resumeVersions: versions,
    subscription: subscription
      ? {
          planId: subscription.plan_id,
          status: subscription.status,
          renewsAt: subscription.renews_at,
        }
      : null,
  };
}

export function deleteAccountData(userId) {
  try {
    const profile = db.prepare("SELECT photo_url, resume_file_url FROM profiles WHERE user_id = ?").get(userId);
    for (const path of [profile?.photo_url, profile?.resume_file_url]) {
      const value = String(path || "");
      if (!value.startsWith("/uploads/")) continue;
      const file = join(uploadsDir, basename(value));
      if (existsSync(file)) unlinkSync(file);
    }
  } catch {
    // Continue with DB deletion even if upload cleanup fails.
  }
  const tables = [
    ["interview_room_signals", "room_id IN (SELECT id FROM interview_rooms WHERE employer_user_id = ? OR candidate_user_id = ?)"],
    ["interview_rooms", "employer_user_id = ? OR candidate_user_id = ?"],
    ["employer_voice_sessions", "employer_user_id = ? OR candidate_user_id = ?"],
    ["employer_invites", "employer_user_id = ? OR candidate_user_id = ?"],
    ["employer_pipeline", "employer_user_id = ? OR candidate_user_id = ?"],
    ["employer_postings", "employer_user_id = ?"],
    ["employer_sla_settings", "employer_user_id = ?"],
    ["employer_profiles", "user_id = ?"],
    ["voice_practice_sessions", "user_id = ?"],
    ["follow_up_reminders", "user_id = ?"],
    ["extension_captures", "user_id = ?"],
    ["extension_tokens", "user_id = ?"],
    ["match_explanation_views", "user_id = ?"],
    ["apply_kit_events", "user_id = ?"],
    ["applications", "user_id = ?"],
    ["resume_reviews", "user_id = ?"],
    ["resume_versions", "user_id = ?"],
    ["billing_events", "user_id = ?"],
    ["checkouts", "user_id = ?"],
    ["subscriptions", "user_id = ?"],
    ["ai_audit", "user_id = ?"],
    ["password_resets", "user_id = ?"],
    ["email_activations", "email = (SELECT email FROM users WHERE id = ?)"],
    ["sessions", "user_id = ?"],
    ["profiles", "user_id = ?"],
    ["users", "id = ?"],
  ];
  const deleteOne = (sql, args) => {
    try {
      db.prepare(sql).run(...args);
    } catch {
      // Table may not exist on older DBs mid-migrate.
    }
  };
  for (const [table, where] of tables) {
    const placeholders = (where.match(/\?/g) || []).length;
    const args = Array.from({ length: placeholders }, () => userId);
    deleteOne(`DELETE FROM ${table} WHERE ${where}`, args);
  }
  return true;
}
