/** Voice practice routes for interview-ready applications. */

import { db, id } from "./db.mjs";
import { matchJob } from "./match.mjs";
import { buildInterviewPrep } from "./interview-prep.mjs";
import { buildVoicePractice, scoreVoiceAnswer, summarizeVoiceSession } from "./voice-interview.mjs";

const PREP_STATUSES = ["Ready", "Review required", "Applied", "Responded", "Interview", "Offer"];

function parse(value, fallback) {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function loadPrepContext(user, applicationId, ctx) {
  const { syncProfileVersion, activeVersion } = ctx;
  const row = db.prepare("SELECT * FROM applications WHERE id = ? AND user_id = ?").get(applicationId, user.id);
  if (!row) return { error: { status: 404, message: "Application not found." } };
  if (!PREP_STATUSES.includes(row.status)) {
    return { error: { status: 400, message: "Voice practice unlocks once an application is Ready, Applied, or further along." } };
  }
  syncProfileVersion(user.id);
  const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(user.id);
  const version = row.version_id
    ? db.prepare("SELECT * FROM resume_versions WHERE id = ? AND user_id = ?").get(row.version_id, user.id)
    : activeVersion(user.id);
  const job = db.prepare("SELECT * FROM jobs WHERE id = ?").get(row.job_id);
  if (!profile || !job) {
    return { error: { status: 400, message: "A profile and job are required for voice practice." } };
  }
  const doc = version
    ? parse(version.document, {})
    : {
        skills: parse(profile.skills, []),
        employment: parse(profile.employment, []),
        education: parse(profile.education, []),
        summary: profile.summary || "",
        headline: profile.headline || "",
      };
  const preferences = parse(profile.preferences, {});
  const match = matchJob(doc, preferences, {
    ...job,
    skills: parse(job.skills, []),
    requirements: parse(job.requirements, {}),
  });
  const prep = buildInterviewPrep({ job, doc, match, application: row });
  return { row, doc, match, prep };
}

function publicSession(row) {
  const turns = parse(row.turns, []);
  const summary = summarizeVoiceSession(turns);
  return {
    id: row.id,
    applicationId: row.application_id,
    title: row.title,
    company: row.company,
    status: summary.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    prompts: parse(row.prompts, []),
    facts: parse(row.facts, {}),
    reminders: parse(row.reminders, []),
    turns,
    summary,
  };
}

export function registerVoice(app, ctx) {
  const { requireUser, requireFeature, syncProfileVersion, activeVersion } = ctx;
  const helpers = { syncProfileVersion, activeVersion };

  app.post("/api/applications/:id/voice-practice", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    if (!requireFeature(user, "job_browse", res)) return;
    const loaded = loadPrepContext(user, req.params.id, helpers);
    if (loaded.error) {
      res.status(loaded.error.status).json({ error: loaded.error.message });
      return;
    }
    const practice = buildVoicePractice({
      prep: loaded.prep,
      doc: loaded.doc,
      match: loaded.match,
    });
    const now = Date.now();
    const sessionId = id("voice");
    const turns = practice.prompts.map((prompt) => ({
      promptId: prompt.id,
      prompt: prompt.prompt,
      kind: prompt.kind,
      answer: "",
      mode: "",
      feedback: null,
      answeredAt: null,
    }));
    db.prepare(
      `INSERT INTO voice_practice_sessions
        (id, user_id, application_id, title, company, prompts, facts, reminders, turns, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      sessionId,
      user.id,
      loaded.row.id,
      practice.title,
      practice.company,
      JSON.stringify(practice.prompts),
      JSON.stringify(practice.facts),
      JSON.stringify(practice.reminders),
      JSON.stringify(turns),
      now,
      now,
    );
    const row = db.prepare("SELECT * FROM voice_practice_sessions WHERE id = ?").get(sessionId);
    res.json({ session: publicSession(row) });
  });

  app.get("/api/voice-practice", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    if (!requireFeature(user, "job_browse", res)) return;
    const rows = db
      .prepare("SELECT * FROM voice_practice_sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 20")
      .all(user.id);
    res.json({ sessions: rows.map(publicSession) });
  });

  app.get("/api/voice-practice/:id", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    if (!requireFeature(user, "job_browse", res)) return;
    const row = db.prepare("SELECT * FROM voice_practice_sessions WHERE id = ? AND user_id = ?").get(req.params.id, user.id);
    if (!row) {
      res.status(404).json({ error: "Voice practice session not found." });
      return;
    }
    res.json({ session: publicSession(row) });
  });

  app.post("/api/voice-practice/:id/answer", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    if (!requireFeature(user, "job_browse", res)) return;
    const row = db.prepare("SELECT * FROM voice_practice_sessions WHERE id = ? AND user_id = ?").get(req.params.id, user.id);
    if (!row) {
      res.status(404).json({ error: "Voice practice session not found." });
      return;
    }
    const promptId = String(req.body?.promptId || "");
    const answer = String(req.body?.answer || "");
    const mode = String(req.body?.mode || "typed").slice(0, 24);
    const prompts = parse(row.prompts, []);
    const facts = parse(row.facts, {});
    const turns = parse(row.turns, []);
    const prompt = prompts.find((item) => item.id === promptId);
    const turnIndex = turns.findIndex((item) => item.promptId === promptId);
    if (!prompt || turnIndex < 0) {
      res.status(400).json({ error: "Unknown practice prompt." });
      return;
    }
    const feedback = scoreVoiceAnswer({
      prompt,
      answer,
      facts: { ...facts, missing: facts.missing || [] },
      coachAnswer: prompt.coachAnswer || "",
    });
    turns[turnIndex] = {
      ...turns[turnIndex],
      answer,
      mode: mode === "speech" ? "speech" : "typed",
      feedback,
      answeredAt: Date.now(),
    };
    const now = Date.now();
    db.prepare("UPDATE voice_practice_sessions SET turns = ?, updated_at = ? WHERE id = ?").run(
      JSON.stringify(turns),
      now,
      row.id,
    );
    const updated = db.prepare("SELECT * FROM voice_practice_sessions WHERE id = ?").get(row.id);
    res.json({ session: publicSession(updated), turn: turns[turnIndex] });
  });
}
