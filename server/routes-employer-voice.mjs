/** Employer-led live voice interview routes. */

import { db, id } from "./db.mjs";
import {
  buildEmployerVoiceQuestions,
  canAdvanceSession,
  makeJoinCode,
  normalizeSessionStatus,
  publicCandidateFacts,
  scoreLiveAnswer,
  summarizeLiveSession,
} from "./employer-voice.mjs";

function parse(value, fallback) {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function uniqueJoinCode() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = makeJoinCode();
    if (!db.prepare("SELECT id FROM employer_voice_sessions WHERE join_code = ?").get(code)) return code;
  }
  return `${makeJoinCode()}${Date.now().toString(36).slice(-2)}`.slice(0, 8).toUpperCase();
}

function loadCandidateBundle(candidateUserId) {
  const row = db
    .prepare(
      `SELECT profiles.*, users.name, users.email, users.phone, users.city, users.status, users.role,
              plans.features AS plan_features
       FROM profiles
       JOIN users ON users.id = profiles.user_id
       LEFT JOIN plans ON plans.id = COALESCE(users.plan_id, 'free')
       WHERE profiles.user_id = ?`,
    )
    .get(candidateUserId);
  if (!row || row.role !== "user" || row.status !== "active" || !row.slug) return null;
  const features = parse(row.plan_features, {});
  if (features.public_profile === false) return null;
  const preferences = parse(row.preferences, {});
  const skills = parse(row.skills, []);
  return {
    row,
    preferences,
    facts: publicCandidateFacts(row, preferences),
    candidate: {
      userId: row.user_id,
      name: row.name || "",
      headline: row.headline || "",
      summary: String(row.summary || "").slice(0, 280),
      skills: (Array.isArray(skills) ? skills : []).map(String).slice(0, 12),
      city: row.city || "",
      slug: row.slug,
      resumeUrl: `/resume/${row.slug}`,
      email: preferences.shareContact === false ? "" : String(row.email || ""),
      phone: preferences.shareContact === false ? "" : String(row.phone || ""),
    },
  };
}

function publicSession(row, { includeEmployerNotes = true } = {}) {
  const turns = parse(row.turns, []);
  const questions = parse(row.questions, []);
  const summary = summarizeLiveSession(turns);
  const candidate = loadCandidateBundle(row.candidate_user_id)?.candidate || {
    userId: row.candidate_user_id,
    name: "",
    headline: "",
    summary: "",
    skills: [],
    city: "",
    slug: "",
    resumeUrl: "",
    email: "",
    phone: "",
  };
  return {
    id: row.id,
    pipelineId: row.pipeline_id,
    employerUserId: row.employer_user_id,
    candidateUserId: row.candidate_user_id,
    roleTitle: row.role_title || "",
    joinCode: row.join_code,
    joinPath: `/voice/${row.join_code}`,
    status: normalizeSessionStatus(row.status),
    questions,
    turns,
    notes: includeEmployerNotes ? row.notes || "" : "",
    summary,
    candidate,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

function getOwnedSession(employerUserId, sessionId) {
  return db
    .prepare("SELECT * FROM employer_voice_sessions WHERE id = ? AND employer_user_id = ?")
    .get(sessionId, employerUserId);
}

export function registerEmployerVoice(app, ctx) {
  const { requireUser } = ctx;

  function requireEmployer(req, res) {
    const user = requireUser(req, res);
    if (!user) return null;
    if (user.role !== "employer") {
      res.status(403).json({ error: "Employer access required." });
      return null;
    }
    return user;
  }

  app.get("/api/employer/voice-sessions", (req, res) => {
    const user = requireEmployer(req, res);
    if (!user) return;
    const rows = db
      .prepare("SELECT * FROM employer_voice_sessions WHERE employer_user_id = ? ORDER BY updated_at DESC LIMIT 40")
      .all(user.id);
    res.json({ sessions: rows.map((row) => publicSession(row)) });
  });

  app.post("/api/employer/voice-sessions", (req, res) => {
    const user = requireEmployer(req, res);
    if (!user) return;
    const pipelineId = String(req.body.pipelineId || "").trim();
    const pipeline = db
      .prepare("SELECT * FROM employer_pipeline WHERE id = ? AND employer_user_id = ?")
      .get(pipelineId, user.id);
    if (!pipeline) {
      res.status(404).json({ error: "Pipeline entry not found." });
      return;
    }
    const bundle = loadCandidateBundle(pipeline.candidate_user_id);
    if (!bundle) {
      res.status(400).json({ error: "Candidate must keep a public profile to start a live interview." });
      return;
    }
    const roleTitle = String(req.body.roleTitle || pipeline.role_title || bundle.candidate.headline || "").trim().slice(0, 120);
    const questions = buildEmployerVoiceQuestions({
      roleTitle,
      candidate: bundle.candidate,
      custom: Array.isArray(req.body.customQuestions) ? req.body.customQuestions : [],
    });
    const turns = questions.map((question) => ({
      promptId: question.id,
      prompt: question.prompt,
      kind: question.kind,
      answer: "",
      mode: "",
      askedBy: "employer",
      feedback: null,
      answeredAt: null,
    }));
    const now = Date.now();
    const sessionId = id("evoice");
    const joinCode = uniqueJoinCode();
    db.prepare(
      `INSERT INTO employer_voice_sessions
        (id, employer_user_id, pipeline_id, candidate_user_id, role_title, join_code, status, questions, turns, notes, facts, created_at, updated_at, started_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, 'scheduled', ?, ?, '', ?, ?, ?, NULL, NULL)`,
    ).run(
      sessionId,
      user.id,
      pipeline.id,
      pipeline.candidate_user_id,
      roleTitle,
      joinCode,
      JSON.stringify(questions),
      JSON.stringify(turns),
      JSON.stringify(bundle.facts),
      now,
      now,
    );
    if (!["Interviewing", "Offer", "Hired"].includes(pipeline.status)) {
      db.prepare("UPDATE employer_pipeline SET status = ?, updated_at = ? WHERE id = ?").run(
        "Interviewing",
        now,
        pipeline.id,
      );
    }
    const row = db.prepare("SELECT * FROM employer_voice_sessions WHERE id = ?").get(sessionId);
    res.json({ session: publicSession(row) });
  });

  app.get("/api/employer/voice-sessions/:id", (req, res) => {
    const user = requireEmployer(req, res);
    if (!user) return;
    const row = getOwnedSession(user.id, req.params.id);
    if (!row) {
      res.status(404).json({ error: "Voice interview not found." });
      return;
    }
    res.json({ session: publicSession(row) });
  });

  app.post("/api/employer/voice-sessions/:id/start", (req, res) => {
    const user = requireEmployer(req, res);
    if (!user) return;
    const row = getOwnedSession(user.id, req.params.id);
    if (!row) {
      res.status(404).json({ error: "Voice interview not found." });
      return;
    }
    if (!canAdvanceSession(row.status, "live")) {
      res.status(400).json({ error: `Cannot start a ${row.status} session.` });
      return;
    }
    const now = Date.now();
    db.prepare(
      "UPDATE employer_voice_sessions SET status = 'live', started_at = COALESCE(started_at, ?), updated_at = ? WHERE id = ?",
    ).run(now, now, row.id);
    res.json({ session: publicSession(db.prepare("SELECT * FROM employer_voice_sessions WHERE id = ?").get(row.id)) });
  });

  app.post("/api/employer/voice-sessions/:id/complete", (req, res) => {
    const user = requireEmployer(req, res);
    if (!user) return;
    const row = getOwnedSession(user.id, req.params.id);
    if (!row) {
      res.status(404).json({ error: "Voice interview not found." });
      return;
    }
    if (!canAdvanceSession(row.status, "complete")) {
      res.status(400).json({ error: `Cannot complete a ${row.status} session.` });
      return;
    }
    const notes = req.body.notes != null ? String(req.body.notes || "").trim().slice(0, 4000) : row.notes || "";
    const now = Date.now();
    db.prepare(
      "UPDATE employer_voice_sessions SET status = 'complete', notes = ?, completed_at = ?, updated_at = ? WHERE id = ?",
    ).run(notes, now, now, row.id);
    res.json({ session: publicSession(db.prepare("SELECT * FROM employer_voice_sessions WHERE id = ?").get(row.id)) });
  });

  app.put("/api/employer/voice-sessions/:id", (req, res) => {
    const user = requireEmployer(req, res);
    if (!user) return;
    const row = getOwnedSession(user.id, req.params.id);
    if (!row) {
      res.status(404).json({ error: "Voice interview not found." });
      return;
    }
    const notes = req.body.notes != null ? String(req.body.notes || "").trim().slice(0, 4000) : row.notes || "";
    db.prepare("UPDATE employer_voice_sessions SET notes = ?, updated_at = ? WHERE id = ?").run(notes, Date.now(), row.id);
    res.json({ session: publicSession(db.prepare("SELECT * FROM employer_voice_sessions WHERE id = ?").get(row.id)) });
  });

  app.post("/api/employer/voice-sessions/:id/answer", (req, res) => {
    const user = requireEmployer(req, res);
    if (!user) return;
    const row = getOwnedSession(user.id, req.params.id);
    if (!row) {
      res.status(404).json({ error: "Voice interview not found." });
      return;
    }
    if (!["live", "scheduled"].includes(normalizeSessionStatus(row.status))) {
      res.status(400).json({ error: "Answers can only be captured during an open interview." });
      return;
    }
    const promptId = String(req.body.promptId || "");
    const answer = String(req.body.answer || "");
    const mode = String(req.body.mode || "typed").slice(0, 24);
    const turns = parse(row.turns, []);
    const questions = parse(row.questions, []);
    const facts = parse(row.facts, {});
    const turnIndex = turns.findIndex((item) => item.promptId === promptId);
    const question = questions.find((item) => item.id === promptId);
    if (turnIndex < 0 || !question) {
      res.status(400).json({ error: "Unknown interview question." });
      return;
    }
    const feedback = scoreLiveAnswer({ question, answer, facts });
    turns[turnIndex] = {
      ...turns[turnIndex],
      answer,
      mode: mode === "speech" ? "speech" : "typed",
      feedback,
      answeredAt: Date.now(),
    };
    const now = Date.now();
    const nextStatus = normalizeSessionStatus(row.status) === "scheduled" ? "live" : row.status;
    db.prepare(
      "UPDATE employer_voice_sessions SET turns = ?, status = ?, started_at = COALESCE(started_at, ?), updated_at = ? WHERE id = ?",
    ).run(JSON.stringify(turns), nextStatus, now, now, row.id);
    const updated = db.prepare("SELECT * FROM employer_voice_sessions WHERE id = ?").get(row.id);
    res.json({ session: publicSession(updated), turn: turns[turnIndex] });
  });

  app.get("/api/voice-join/:code", (req, res) => {
    const code = String(req.params.code || "").trim().toUpperCase();
    const row = db.prepare("SELECT * FROM employer_voice_sessions WHERE join_code = ?").get(code);
    if (!row || normalizeSessionStatus(row.status) === "cancelled") {
      res.status(404).json({ error: "Interview not found." });
      return;
    }
    const employer = db.prepare("SELECT name FROM users WHERE id = ?").get(row.employer_user_id);
    const company = db.prepare("SELECT company_name FROM employer_profiles WHERE user_id = ?").get(row.employer_user_id);
    const session = publicSession(row, { includeEmployerNotes: false });
    res.json({
      session: {
        ...session,
        employerName: employer?.name || "Employer",
        companyName: company?.company_name || "",
      },
    });
  });

  app.post("/api/voice-join/:code/answer", (req, res) => {
    const code = String(req.params.code || "").trim().toUpperCase();
    const row = db.prepare("SELECT * FROM employer_voice_sessions WHERE join_code = ?").get(code);
    if (!row) {
      res.status(404).json({ error: "Interview not found." });
      return;
    }
    if (!["live", "scheduled"].includes(normalizeSessionStatus(row.status))) {
      res.status(400).json({ error: "This interview is closed." });
      return;
    }
    const promptId = String(req.body.promptId || "");
    const answer = String(req.body.answer || "");
    const mode = String(req.body.mode || "typed").slice(0, 24);
    const turns = parse(row.turns, []);
    const questions = parse(row.questions, []);
    const facts = parse(row.facts, {});
    const turnIndex = turns.findIndex((item) => item.promptId === promptId);
    const question = questions.find((item) => item.id === promptId);
    if (turnIndex < 0 || !question) {
      res.status(400).json({ error: "Unknown interview question." });
      return;
    }
    const feedback = scoreLiveAnswer({ question, answer, facts });
    turns[turnIndex] = {
      ...turns[turnIndex],
      answer,
      mode: mode === "speech" ? "speech" : "typed",
      feedback,
      answeredAt: Date.now(),
      answeredBy: "candidate",
    };
    const now = Date.now();
    const nextStatus = normalizeSessionStatus(row.status) === "scheduled" ? "live" : row.status;
    db.prepare(
      "UPDATE employer_voice_sessions SET turns = ?, status = ?, started_at = COALESCE(started_at, ?), updated_at = ? WHERE id = ?",
    ).run(JSON.stringify(turns), nextStatus, now, now, row.id);
    const updated = db.prepare("SELECT * FROM employer_voice_sessions WHERE id = ?").get(row.id);
    res.json({
      session: publicSession(updated, { includeEmployerNotes: false }),
      turn: turns[turnIndex],
    });
  });
}
