import express from "express";
import multer from "multer";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  db,
  dataDir,
  uploadsDir,
  hashPassword,
  verifyPassword,
  sha256,
  id,
  publicUser,
} from "./db.mjs";
import { cleanResumeText, extractCareerProfile, readResumeFile } from "./extract.mjs";
import { registerPlatform, syncProfileVersion } from "./platform.mjs";
import { deliverMail, publicMailSettings, saveMailSettings } from "./mail.mjs";
import { auditCostSummary, moneyFromMicros } from "./ai-cost.mjs";
import { registerEmployer } from "./routes-employer.mjs";
import { registerEmployerVoice } from "./routes-employer-voice.mjs";
import { registerEmployerPostings } from "./routes-employer-postings.mjs";
import { registerInterviewRooms } from "./routes-interview-rooms.mjs";
import { registerEmployerAnalytics } from "./routes-employer-analytics.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const homepageFile = join(here, "..", "shared", "homepage.json");
const defaultHomepage = JSON.parse(readFileSync(homepageFile, "utf8"));

function seed() {
  const existing = db.prepare("SELECT value FROM settings WHERE key = 'homepage'").get();
  if (!existing) {
    db.prepare("INSERT INTO settings (key, value) VALUES ('homepage', ?)").run(JSON.stringify(defaultHomepage));
  }
  const admin = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  if (!admin) {
    const email = process.env.ADMIN_EMAIL || "admin@jobpilot.app";
    const password = process.env.ADMIN_PASSWORD || "JobPilot-Admin-2026";
    const mustChange = process.env.ADMIN_PASSWORD ? 0 : 1;
    db.prepare(
      `INSERT INTO users (id, name, email, password_hash, provider, role, status, password_must_change, created_at)
       VALUES (?, 'Site Admin', ?, ?, 'email', 'admin', 'active', ?, ?)`,
    ).run(id("usr"), email, hashPassword(password), mustChange, Date.now());
    try {
      const note = mustChange
        ? `email: ${email}\npassword: ${password}\nnote: change this password on first sign-in\n`
        : `email: ${email}\npassword: (set via ADMIN_PASSWORD)\n`;
      writeFileSync(join(dataDir, "admin-bootstrap.txt"), note, { flag: "wx" });
    } catch {
      // Credentials file already exists from an earlier boot.
    }
  } else if (!process.env.ADMIN_PASSWORD) {
    const defaultAdmin = db.prepare("SELECT * FROM users WHERE email = ? AND role = 'admin'").get("admin@jobpilot.app");
    if (defaultAdmin && verifyPassword("JobPilot-Admin-2026", defaultAdmin.password_hash)) {
      db.prepare("UPDATE users SET password_must_change = 1 WHERE id = ?").run(defaultAdmin.id);
    }
  }
}
seed();

const app = express();
app.use(express.json({ limit: "1mb" }));
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

function cookie(req, name) {
  const raw = req.headers.cookie || "";
  const part = raw.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : "";
}

function originOf(req) {
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

function cookieSecure(req) {
  if (process.env.COOKIE_SECURE === "0") return false;
  if (process.env.COOKIE_SECURE === "1") return true;
  const proto = String(req?.headers?.["x-forwarded-proto"] || req?.protocol || "");
  return proto.split(",")[0].trim() === "https";
}

function sessionCookieAttrs(req, maxAge) {
  const parts = ["HttpOnly", "Path=/", "SameSite=Lax", `Max-Age=${maxAge}`];
  if (cookieSecure(req)) parts.push("Secure");
  return parts.join("; ");
}

function setSession(res, userId, req) {
  const token = randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(
    token,
    userId,
    Date.now() + 1000 * 60 * 60 * 24 * 14,
  );
  res.setHeader(
    "Set-Cookie",
    `jp_session=${token}; ${sessionCookieAttrs(req, 60 * 60 * 24 * 14)}`,
  );
  return token;
}

function clearSession(res, req) {
  res.setHeader("Set-Cookie", `jp_session=; ${sessionCookieAttrs(req, 0)}`);
}

function currentUser(req) {
  const token = cookie(req, "jp_session");
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT users.* FROM sessions JOIN users ON users.id = sessions.user_id
       WHERE sessions.token = ? AND sessions.expires_at > ? AND users.status = 'active'`,
    )
    .get(token, Date.now());
  return row || null;
}

function allowedWhilePasswordChange(req) {
  const path = String(req.originalUrl || req.url || "").split("?")[0];
  if (req.method === "GET" && path === "/api/auth/me") return true;
  if (req.method === "POST" && path === "/api/auth/logout") return true;
  if (req.method === "POST" && path === "/api/account/password") return true;
  return false;
}

function requireUser(req, res) {
  const user = currentUser(req);
  if (!user) {
    res.status(401).json({ error: "Sign in required." });
    return null;
  }
  if (user.password_must_change && !allowedWhilePasswordChange(req)) {
    res.status(403).json({ error: "Change your password before continuing.", mustChangePassword: true });
    return null;
  }
  return user;
}

function requireAdmin(req, res) {
  const user = requireUser(req, res);
  if (!user) return null;
  if (user.role !== "admin") {
    res.status(403).json({ error: "Admin access required." });
    return null;
  }
  return user;
}

function audit(entry) {
  db.prepare(
    `INSERT INTO ai_audit (id, user_id, function_name, provider, model, status, detail, created_at, cost_micros)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id("ai"),
    entry.userId || null,
    entry.functionName,
    entry.provider,
    entry.model,
    entry.status,
    entry.detail || "",
    Date.now(),
    Math.max(0, Number(entry.costMicros) || 0),
  );
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/content/homepage", (_req, res) => {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'homepage'").get();
  res.json(row ? JSON.parse(row.value) : defaultHomepage);
});

app.get("/api/auth/me", (req, res) => {
  res.json({ user: publicUser(currentUser(req)) });
});

app.post("/api/auth/login", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || user.status !== "active") {
    res.status(401).json({ error: "No active account uses that email." });
    return;
  }
  if (user.provider === "google") {
    res.status(401).json({ error: "That email uses Continue with Google." });
    return;
  }
  if (!verifyPassword(password, user.password_hash)) {
    res.status(401).json({ error: "That password does not match." });
    return;
  }
  setSession(res, user.id, req);
  res.json({ user: publicUser(user) });
});

app.post("/api/auth/register", (req, res) => {
  if (!req.body.consent) {
    res.status(400).json({ error: "Agree to the terms to create the account." });
    return;
  }
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (name.length < 2) {
    res.status(400).json({ error: "Enter the name for this account." });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "Use at least 8 characters for your password." });
    return;
  }
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
    res.status(409).json({ error: "An account with this email already exists. Sign in instead." });
    return;
  }
  const userId = id("usr");
  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, provider, role, status, consent_at, created_at)
     VALUES (?, ?, ?, ?, 'email', 'user', 'active', ?, ?)`,
  ).run(userId, name, email, hashPassword(password), Date.now(), Date.now());
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  setSession(res, userId);
  res.json({ user: publicUser(user) });
});

app.post("/api/auth/logout", (req, res) => {
  const token = cookie(req, "jp_session");
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
  clearSession(res, req);
  res.json({ ok: true });
});

app.post("/api/auth/forgot-password", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  let devLink = "";
  let sent = false;
  if (user && user.provider === "email" && user.status === "active") {
    const token = randomBytes(24).toString("hex");
    db.prepare(
      "INSERT INTO password_resets (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)",
    ).run(id("rst"), user.id, sha256(token), Date.now() + 1000 * 60 * 60);
    const link = `${originOf(req)}/reset-password?token=${token}`;
    const delivery = await deliverMail({
      to: user.email,
      subject: "Reset your JobPilot password",
      body: `Open this link to choose a new password. It expires in one hour.\n\n${link}`,
    });
    sent = delivery.sent;
    if (!sent) devLink = link;
  }
  res.json({
    ok: true,
    message: sent
      ? "If an account exists, a reset link is on its way."
      : "Email delivery is not configured on this server. If the account exists, the reset link is shown below and saved for admins.",
    devLink,
  });
});

app.post("/api/auth/reset-password", (req, res) => {
  const token = String(req.body.token || "");
  const password = String(req.body.password || "");
  if (password.length < 8) {
    res.status(400).json({ error: "Use at least 8 characters." });
    return;
  }
  const reset = db
    .prepare("SELECT * FROM password_resets WHERE token_hash = ? AND used_at IS NULL AND expires_at > ?")
    .get(sha256(token), Date.now());
  if (!reset) {
    res.status(400).json({ error: "This reset link is invalid or expired." });
    return;
  }
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(password), reset.user_id);
  db.prepare("UPDATE password_resets SET used_at = ? WHERE id = ?").run(Date.now(), reset.id);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(reset.user_id);
  res.json({ ok: true });
});

app.get("/api/auth/google", (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) {
    res.redirect("/signin?error=google");
    return;
  }
  const state = randomBytes(16).toString("hex");
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(
    `google_state_${state}`,
    JSON.stringify({ exp: Date.now() + 1000 * 60 * 10, consent: req.query.consent === "1" }),
  );
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${originOf(req)}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

app.get("/api/auth/google/callback", async (req, res) => {
  const state = String(req.query.state || "");
  const saved = db.prepare("SELECT value FROM settings WHERE key = ?").get(`google_state_${state}`);
  db.prepare("DELETE FROM settings WHERE key = ?").run(`google_state_${state}`);
  let oauth = null;
  try {
    oauth = JSON.parse(saved?.value || "");
  } catch {
    oauth = { exp: Number(saved?.value), consent: false };
  }
  if (!saved || !oauth?.exp || Number(oauth.exp) < Date.now() || !req.query.code) {
    res.redirect("/signin?error=google");
    return;
  }
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: String(req.query.code),
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${originOf(req)}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenResponse.ok) {
    res.redirect("/signin?error=google");
    return;
  }
  const tokens = await tokenResponse.json();
  const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await profileResponse.json();
  if (!profile.email) {
    res.redirect("/signin?error=google");
    return;
  }
  let user = db.prepare("SELECT * FROM users WHERE email = ?").get(String(profile.email).toLowerCase());
  if (!user) {
    if (!oauth.consent) {
      res.redirect("/get-started?error=terms");
      return;
    }
    const userId = id("usr");
    db.prepare(
      `INSERT INTO users (id, name, email, password_hash, provider, role, status, consent_at, created_at)
       VALUES (?, ?, ?, NULL, 'google', 'user', 'active', ?, ?)`,
    ).run(userId, profile.name || profile.email, String(profile.email).toLowerCase(), Date.now(), Date.now());
    user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  }
  if (user.status !== "active") {
    res.redirect("/signin?error=disabled");
    return;
  }
  setSession(res, user.id, req);
  res.redirect(existsProfile(user.id) ? "/dashboard" : "/get-started");
});

function existsProfile(userId) {
  return Boolean(db.prepare("SELECT user_id FROM profiles WHERE user_id = ?").get(userId));
}

app.post("/api/onboarding/extract", upload.single("resume"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "Choose a resume file." });
    return;
  }
  const filename = req.file.originalname || "resume.txt";
  const lower = filename.toLowerCase();
  if (!/\.(pdf|docx|txt|md)$/.test(lower)) {
    res.status(400).json({ error: "Use a PDF, DOCX, or TXT file." });
    return;
  }
  if (req.body.consent !== "1" && req.body.consent !== true && req.body.consent !== "true") {
    res.status(400).json({ error: "Agree to the terms before we read your resume." });
    return;
  }
  let text = "";
  try {
    text = await readResumeFile(filename, req.file.buffer);
  } catch {
    const kind = lower.endsWith(".pdf") ? "PDF" : "file";
    res.status(400).json({
      error: `We could not read that ${kind}. Use a DOCX or TXT resume, or a PDF whose text you can highlight.`,
    });
    return;
  }
  text = cleanResumeText(text).slice(0, 20000);
  if (text.trim().length < 20) {
    res.status(400).json({
      error: lower.endsWith(".pdf")
        ? "This PDF has no selectable text, so it looks like a scan or a picture. Save it as DOCX or TXT, or upload a PDF where the words can be highlighted."
        : "We could not read enough text from that file. Upload a DOCX, TXT, or PDF with selectable text.",
    });
    return;
  }
  const extracted = await extractCareerProfile(text);
  const draftId = id("draft");
  const payload = { ...extracted, resumeName: filename, rawText: text };
  db.prepare("INSERT INTO drafts (id, payload, created_at) VALUES (?, ?, ?)").run(
    draftId,
    JSON.stringify(payload),
    Date.now(),
  );
  audit({
    functionName: "career_profile_extraction",
    provider: extracted.provider,
    model: extracted.model,
    status: extracted.review?.status || "pass",
    detail: filename,
    costMicros: extracted.costMicros || 0,
  });
  res.json({
    draftId,
    profile: {
      name: extracted.name,
      email: extracted.email,
      phone: extracted.phone,
      address: extracted.address,
      city: extracted.city,
      summary: extracted.summary,
      skills: extracted.skills,
      employment: extracted.employment,
      education: extracted.education,
    },
    facts: extracted.facts,
    questions: extracted.questions,
    warnings: extracted.warnings || [],
    provider: extracted.provider,
    model: extracted.model,
  });
});

app.post("/api/onboarding/activate", (req, res) => {
  const draft = db.prepare("SELECT * FROM drafts WHERE id = ?").get(String(req.body.draftId || ""));
  if (!draft) {
    res.status(400).json({ error: "That resume draft expired. Upload the file again." });
    return;
  }
  if (!req.body.consent) {
    res.status(400).json({ error: "Agree to the terms to create the account." });
    return;
  }
  const password = String(req.body.password || "");
  if (password.length < 8) {
    res.status(400).json({ error: "Use at least 8 characters for your password." });
    return;
  }
  const payload = JSON.parse(draft.payload);
  const name = String(req.body.name || payload.name || "").trim();
  const email = String(req.body.email || payload.email || "").trim().toLowerCase();
  const phone = String(req.body.phone || payload.phone || "").trim();
  const address = String(req.body.address || payload.address || "").trim();
  const city = String(req.body.city || payload.city || "").trim();
  if (name.length < 2) {
    res.status(400).json({ error: "Enter the name for this account." });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
    res.status(409).json({ error: "An account with this email already exists. Sign in instead." });
    return;
  }
  const userId = id("usr");
  db.prepare(
    `INSERT INTO users (id, name, email, phone, address, city, password_hash, provider, role, status, consent_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'email', 'user', 'active', ?, ?)`,
  ).run(userId, name, email, phone, address, city, hashPassword(password), Date.now(), Date.now());
  const facts = (payload.facts || []).map((fact) => ({ ...fact, verified_by_user: true }));
  db.prepare(
    `INSERT INTO profiles (user_id, summary, skills, employment, education, facts, preferences, raw_text, resume_name, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    userId,
    String(req.body.summary || payload.summary || ""),
    JSON.stringify(payload.skills || []),
    JSON.stringify(payload.employment || []),
    JSON.stringify(payload.education || []),
    JSON.stringify(facts),
    JSON.stringify({
      salary: String(req.body.salary || ""),
      workArrangement: String(req.body.workArrangement || ""),
      locations: String(req.body.locations || ""),
      workAuthorization: String(req.body.workAuthorization || ""),
    }),
    payload.rawText || "",
    payload.resumeName || "",
    Date.now(),
  );
  db.prepare("DELETE FROM drafts WHERE id = ?").run(draft.id);
  syncProfileVersion(userId);
  setSession(res, userId, req);
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  res.json({ user: publicUser(user) });
});

app.get("/api/profile", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(user.id);
  if (!profile) {
    res.json({ profile: null });
    return;
  }
  res.json({
    profile: {
      summary: profile.summary,
      skills: JSON.parse(profile.skills || "[]"),
      employment: JSON.parse(profile.employment || "[]"),
      education: JSON.parse(profile.education || "[]"),
      facts: JSON.parse(profile.facts || "[]"),
      preferences: JSON.parse(profile.preferences || "{}"),
      resumeName: profile.resume_name,
      headline: profile.headline || "",
      photoUrl: profile.photo_url || "",
      slug: profile.slug || "",
    },
  });
});

app.get("/api/admin/homepage", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const row = db.prepare("SELECT value FROM settings WHERE key = 'homepage'").get();
  res.json(JSON.parse(row.value));
});

app.put("/api/admin/homepage", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const next = req.body;
  if (!next?.hero?.titleLines || !Array.isArray(next.nav) || !Array.isArray(next.footer?.links)) {
    res.status(400).json({ error: "Homepage content is incomplete." });
    return;
  }
  db.prepare("UPDATE settings SET value = ? WHERE key = 'homepage'").run(JSON.stringify(next));
  res.json({ ok: true });
});

app.post("/api/admin/upload", upload.single("file"), (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (!req.file) {
    res.status(400).json({ error: "Choose an image." });
    return;
  }
  const allowed = [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"];
  const extension = extname(req.file.originalname || "").toLowerCase();
  if (!allowed.includes(extension)) {
    res.status(400).json({ error: "Use a PNG, JPG, WEBP, GIF, or SVG image." });
    return;
  }
  const name = `${id("img")}${extension}`;
  writeFileSync(join(uploadsDir, name), req.file.buffer);
  res.json({ url: `/uploads/${name}` });
});

app.get("/api/admin/users", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const users = db.prepare("SELECT * FROM users ORDER BY created_at DESC").all().map(publicUser);
  res.json({ users });
});

app.patch("/api/admin/users/:id", (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!user) {
    res.status(404).json({ error: "User not found." });
    return;
  }
  const role = req.body.role === "admin" || req.body.role === "user" ? req.body.role : user.role;
  const status = req.body.status === "disabled" || req.body.status === "active" ? req.body.status : user.status;
  const planId = req.body.planId ? String(req.body.planId) : user.plan_id || "free";
  if (user.id === admin.id && (role !== "admin" || status !== "active")) {
    res.status(400).json({ error: "You cannot remove your own admin access." });
    return;
  }
  if (req.body.planId && !db.prepare("SELECT id FROM plans WHERE id = ?").get(planId)) {
    res.status(400).json({ error: "That plan does not exist." });
    return;
  }
  db.prepare("UPDATE users SET role = ?, status = ?, plan_id = ? WHERE id = ?").run(role, status, planId, user.id);
  if (status === "disabled") db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
  res.json({ user: publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(user.id)) });
});

app.post("/api/admin/users", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const role = req.body.role === "admin" ? "admin" : "user";
  if (!req.body.consent) {
    res.status(400).json({ error: "Confirm that this person has agreed to the terms." });
    return;
  }
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8) {
    res.status(400).json({ error: "Name, a valid email, and a password of 8 or more characters are required." });
    return;
  }
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(email)) {
    res.status(409).json({ error: "That email is already in use." });
    return;
  }
  const userId = id("usr");
  db.prepare(
    `INSERT INTO users (id, name, email, password_hash, provider, role, status, consent_at, created_at)
     VALUES (?, ?, ?, ?, 'email', ?, 'active', ?, ?)`,
  ).run(userId, name, email, hashPassword(password), role, Date.now(), Date.now());
  res.json({ user: publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(userId)) });
});

app.post("/api/admin/users/:id/reset-link", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
  if (!user || user.provider !== "email") {
    res.status(400).json({ error: "Password reset links are for email accounts." });
    return;
  }
  const token = randomBytes(24).toString("hex");
  db.prepare("INSERT INTO password_resets (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)").run(
    id("rst"),
    user.id,
    sha256(token),
    Date.now() + 1000 * 60 * 60,
  );
  const link = `${originOf(req)}/reset-password?token=${token}`;
  const delivery = await deliverMail({
    to: user.email,
    subject: "Reset your JobPilot password",
    body: `Open this link to choose a new password. It expires in one hour.\n\n${link}`,
  });
  res.json({ link, sent: delivery.sent, error: delivery.error });
});

app.get("/api/admin/email", (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json({ settings: publicMailSettings() });
});

app.put("/api/admin/email", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const fromEmail = String(req.body.fromEmail || "").trim();
  if (fromEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
    res.status(400).json({ error: "Enter a valid from address." });
    return;
  }
  res.json({ settings: saveMailSettings(req.body) });
});

app.post("/api/admin/email/test", async (req, res) => {
  const admin = requireAdmin(req, res);
  if (!admin) return;
  const to = String(req.body.to || admin.email).trim();
  const delivery = await deliverMail({
    to,
    subject: "JobPilot email test",
    body: "Outbound email from JobPilot is working.",
  });
  if (!delivery.sent) {
    res.status(400).json({ error: delivery.error || "The test email was not sent." });
    return;
  }
  res.json({ ok: true });
});

app.get("/api/admin/outbox", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const messages = db.prepare("SELECT * FROM mail_outbox ORDER BY created_at DESC LIMIT 50").all();
  res.json({ messages });
});

app.get("/api/admin/audit", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const entries = db
    .prepare("SELECT * FROM ai_audit ORDER BY created_at DESC LIMIT 100")
    .all()
    .map((entry) => ({
      id: entry.id,
      userId: entry.user_id,
      functionName: entry.function_name,
      provider: entry.provider,
      model: entry.model,
      status: entry.status,
      detail: entry.detail || "",
      createdAt: entry.created_at,
      costMicros: entry.cost_micros || 0,
      costLabel: moneyFromMicros(entry.cost_micros || 0),
    }));
  res.json({ entries, summary: auditCostSummary() });
});

app.post("/api/account/password", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  if (user.provider !== "email") {
    res.status(400).json({ error: "Google accounts do not use a JobPilot password." });
    return;
  }
  const next = String(req.body.password || "");
  if (!verifyPassword(String(req.body.current || ""), user.password_hash)) {
    res.status(400).json({ error: "The current password does not match." });
    return;
  }
  if (next.length < 8) {
    res.status(400).json({ error: "Use at least 8 characters." });
    return;
  }
  if (next === String(req.body.current || "")) {
    res.status(400).json({ error: "Choose a new password that is different from the current one." });
    return;
  }
  db.prepare("UPDATE users SET password_hash = ?, password_must_change = 0 WHERE id = ?").run(hashPassword(next), user.id);
  try {
    const bootstrap = join(dataDir, "admin-bootstrap.txt");
    if (existsSync(bootstrap)) {
      writeFileSync(bootstrap, `email: ${user.email}\npassword: (changed — not stored)\n`);
    }
  } catch {
    // Best-effort wipe of the bootstrap password copy.
  }
  res.json({ ok: true, user: publicUser(db.prepare("SELECT * FROM users WHERE id = ?").get(user.id)) });
});

registerEmployer(app, { requireUser, setSession });
registerEmployerVoice(app, { requireUser });
registerEmployerPostings(app, { requireUser });
registerInterviewRooms(app, { requireUser });
registerEmployerAnalytics(app, { requireUser });
registerPlatform(app, { requireUser, requireAdmin, audit, upload, originOf });

app.use("/uploads", express.static(uploadsDir));

const distDir = join(here, "..", "dist");
if (process.env.NODE_ENV === "production" && existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api|\/uploads).*/, (_req, res) => {
    res.sendFile(join(distDir, "index.html"));
  });
}

const port = Number(process.env.PORT || 3000);
app.listen(port, "0.0.0.0", () => {
  console.log(`JobPilot API listening on ${port}`);
});
