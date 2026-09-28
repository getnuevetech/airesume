/** Multi-party interview room routes. */

import { db, id } from "./db.mjs";
import { buildEmployerVoiceQuestions, publicCandidateFacts } from "./employer-voice.mjs";
import {
  ROOM_ROLES,
  appendRoomTurn,
  buildRoomParticipants,
  canChangeRoomStatus,
  makeRoomCodes,
  markPresence,
  normalizeRoomRole,
  normalizeRoomStatus,
  scoreRoomCandidateAnswer,
  summarizeRoom,
} from "./interview-rooms.mjs";
import {
  buildSignal,
  filterSignalsForPeer,
  iceConfigSummary,
  normalizeSignalType,
  pruneSignals,
  resolveIceServers,
  upsertAudioParticipant,
} from "./webrtc-signaling.mjs";

function parse(value, fallback) {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function uniqueCode(kind) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const codes = makeRoomCodes();
    const code = kind === "host_code" ? codes.hostCode : kind === "interviewer_code" ? codes.interviewerCode : codes.joinCode;
    if (!db.prepare(`SELECT id FROM interview_rooms WHERE ${kind} = ?`).get(code)) return code;
  }
  return `${makeRoomCodes().joinCode}${Date.now().toString(36).slice(-2)}`.slice(0, 8).toUpperCase();
}

function loadCandidate(candidateUserId) {
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

function publicRoom(row, { includeHostCode = false, includePrivateNotes = false, noteOwnerId = "" } = {}) {
  const agenda = parse(row.agenda, []);
  const transcript = parse(row.transcript, []);
  const participants = parse(row.participants, []);
  const allNotes = parse(row.private_notes, {});
  let privateNotes = {};
  if (includePrivateNotes) {
    privateNotes = noteOwnerId && noteOwnerId !== "host"
      ? { [noteOwnerId]: allNotes[noteOwnerId] || "" }
      : allNotes;
  }
  const company = db.prepare("SELECT company_name FROM employer_profiles WHERE user_id = ?").get(row.employer_user_id);
  const employer = db.prepare("SELECT name FROM users WHERE id = ?").get(row.employer_user_id);
  const candidate = loadCandidate(row.candidate_user_id)?.candidate || null;
  return {
    id: row.id,
    pipelineId: row.pipeline_id || "",
    voiceSessionId: row.voice_session_id || "",
    title: row.title || "",
    roleTitle: row.role_title || "",
    status: normalizeRoomStatus(row.status),
    joinCode: row.join_code,
    interviewerCode: row.interviewer_code,
    hostCode: includeHostCode ? row.host_code : "",
    joinPath: `/room/${row.join_code}`,
    interviewerPath: `/room/${row.interviewer_code}?role=interviewer`,
    hostPath: includeHostCode ? `/room/${row.host_code}?role=host` : "",
    companyName: company?.company_name || "",
    employerName: employer?.name || "Host",
    agenda,
    transcript,
    participants,
    currentPromptId: row.current_prompt_id || agenda[0]?.id || "",
    privateNotes,
    summary: summarizeRoom({ turns: transcript, participants, status: row.status }),
    candidate,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  };
}

function resolveAccess(row, { code = "", roleHint = "", user = null } = {}) {
  const normalized = String(code || "").trim().toUpperCase();
  if (user && user.id === row.employer_user_id) {
    return { role: "host", participantId: "host", includeHostCode: true, includePrivateNotes: true };
  }
  if (normalized && normalized === String(row.host_code || "").toUpperCase()) {
    return { role: "host", participantId: "host", includeHostCode: true, includePrivateNotes: true };
  }
  if (normalized && normalized === String(row.interviewer_code || "").toUpperCase()) {
    const participants = parse(row.participants, []);
    const seat = participants.find((person) => person.role === "interviewer") || { id: "interviewer-1" };
    return { role: "interviewer", participantId: seat.id, includeHostCode: false, includePrivateNotes: true };
  }
  if (normalized && normalized === String(row.join_code || "").toUpperCase()) {
    return { role: "candidate", participantId: "candidate", includeHostCode: false, includePrivateNotes: false };
  }
  if (user && user.id === row.candidate_user_id) {
    return { role: "candidate", participantId: "candidate", includeHostCode: false, includePrivateNotes: false };
  }
  const hinted = normalizeRoomRole(roleHint, "");
  if (hinted && ROOM_ROLES.includes(hinted)) {
    return null;
  }
  return null;
}

function roomForAccess(row, access) {
  return publicRoom(row, {
    includeHostCode: access.includeHostCode,
    includePrivateNotes: access.includePrivateNotes,
    noteOwnerId: access.participantId,
  });
}

export function registerInterviewRooms(app, ctx) {
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

  app.get("/api/employer/rooms", (req, res) => {
    const user = requireEmployer(req, res);
    if (!user) return;
    const rows = db
      .prepare("SELECT * FROM interview_rooms WHERE employer_user_id = ? ORDER BY updated_at DESC LIMIT 40")
      .all(user.id);
    res.json({ rooms: rows.map((row) => publicRoom(row, { includeHostCode: true, includePrivateNotes: true })) });
  });

  app.post("/api/employer/rooms", (req, res) => {
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
    const bundle = loadCandidate(pipeline.candidate_user_id);
    if (!bundle) {
      res.status(400).json({ error: "Candidate must keep a public profile to open a room." });
      return;
    }
    const roleTitle = String(req.body.roleTitle || pipeline.role_title || bundle.candidate.headline || "").trim().slice(0, 120);
    const interviewers = Array.isArray(req.body.interviewers) ? req.body.interviewers : [];
    const agenda = buildEmployerVoiceQuestions({
      roleTitle,
      candidate: bundle.candidate,
      custom: Array.isArray(req.body.customQuestions) ? req.body.customQuestions : [],
    });
    const participants = buildRoomParticipants({
      hostName: user.name,
      hostUserId: user.id,
      candidateName: bundle.candidate.name,
      candidateUserId: bundle.candidate.userId,
      interviewers,
    });
    const now = Date.now();
    const roomId = id("room");
    const joinCode = uniqueCode("join_code");
    const hostCode = uniqueCode("host_code");
    const interviewerCode = uniqueCode("interviewer_code");
    db.prepare(
      `INSERT INTO interview_rooms
        (id, employer_user_id, pipeline_id, voice_session_id, candidate_user_id, title, role_title,
         join_code, host_code, interviewer_code, status, agenda, transcript, participants, private_notes,
         facts, current_prompt_id, created_at, updated_at, started_at, ended_at)
       VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, ?, 'lobby', ?, '[]', ?, '{}', ?, ?, ?, ?, NULL, NULL)`,
    ).run(
      roomId,
      user.id,
      pipeline.id,
      pipeline.candidate_user_id,
      `${roleTitle || "Interview"} · ${bundle.candidate.name}`,
      roleTitle,
      joinCode,
      hostCode,
      interviewerCode,
      JSON.stringify(agenda),
      JSON.stringify(participants),
      JSON.stringify(bundle.facts),
      agenda[0]?.id || "",
      now,
      now,
    );
    if (!["Interviewing", "Offer", "Hired"].includes(pipeline.status)) {
      db.prepare("UPDATE employer_pipeline SET status = ?, updated_at = ? WHERE id = ?").run("Interviewing", now, pipeline.id);
    }
    const row = db.prepare("SELECT * FROM interview_rooms WHERE id = ?").get(roomId);
    res.json({ room: publicRoom(row, { includeHostCode: true, includePrivateNotes: true }) });
  });

  app.get("/api/employer/rooms/:id", (req, res) => {
    const user = requireEmployer(req, res);
    if (!user) return;
    const row = db
      .prepare("SELECT * FROM interview_rooms WHERE id = ? AND employer_user_id = ?")
      .get(req.params.id, user.id);
    if (!row) {
      res.status(404).json({ error: "Room not found." });
      return;
    }
    res.json({ room: publicRoom(row, { includeHostCode: true, includePrivateNotes: true }) });
  });

  app.post("/api/employer/rooms/:id/status", (req, res) => {
    const user = requireEmployer(req, res);
    if (!user) return;
    const row = db
      .prepare("SELECT * FROM interview_rooms WHERE id = ? AND employer_user_id = ?")
      .get(req.params.id, user.id);
    if (!row) {
      res.status(404).json({ error: "Room not found." });
      return;
    }
    const next = normalizeRoomStatus(req.body.status, "");
    if (!canChangeRoomStatus(row.status, next)) {
      res.status(400).json({ error: `Cannot move room from ${row.status} to ${next}.` });
      return;
    }
    const now = Date.now();
    db.prepare(
      `UPDATE interview_rooms SET status = ?, updated_at = ?,
        started_at = CASE WHEN ? = 'live' THEN COALESCE(started_at, ?) ELSE started_at END,
        ended_at = CASE WHEN ? = 'ended' THEN ? ELSE ended_at END
       WHERE id = ?`,
    ).run(next, now, next, now, next, now, row.id);
    res.json({
      room: publicRoom(db.prepare("SELECT * FROM interview_rooms WHERE id = ?").get(row.id), {
        includeHostCode: true,
        includePrivateNotes: true,
      }),
    });
  });

  app.get("/api/room/:code", (req, res) => {
    const code = String(req.params.code || "").trim().toUpperCase();
    const row = db
      .prepare(
        "SELECT * FROM interview_rooms WHERE join_code = ? OR host_code = ? OR interviewer_code = ?",
      )
      .get(code, code, code);
    if (!row) {
      res.status(404).json({ error: "Room not found." });
      return;
    }
    const access = resolveAccess(row, { code, roleHint: req.query.role });
    if (!access) {
      res.status(403).json({ error: "Invalid room code." });
      return;
    }
    const participants = markPresence(parse(row.participants, []), access.participantId);
    db.prepare("UPDATE interview_rooms SET participants = ?, updated_at = ? WHERE id = ?").run(
      JSON.stringify(participants),
      Date.now(),
      row.id,
    );
    const updated = db.prepare("SELECT * FROM interview_rooms WHERE id = ?").get(row.id);
    res.json({
      room: roomForAccess(updated, access),
      you: {
        role: access.role,
        participantId: access.participantId,
      },
    });
  });

  app.post("/api/room/:code/presence", (req, res) => {
    const code = String(req.params.code || "").trim().toUpperCase();
    const row = db
      .prepare(
        "SELECT * FROM interview_rooms WHERE join_code = ? OR host_code = ? OR interviewer_code = ?",
      )
      .get(code, code, code);
    if (!row) {
      res.status(404).json({ error: "Room not found." });
      return;
    }
    const access = resolveAccess(row, { code, roleHint: req.body.role });
    if (!access) {
      res.status(403).json({ error: "Invalid room code." });
      return;
    }
    const displayName = String(req.body.displayName || "").trim().slice(0, 80);
    let participants = parse(row.participants, []);
    if (displayName && access.role === "interviewer") {
      participants = participants.map((person) =>
        person.id === access.participantId ? { ...person, displayName } : person,
      );
    }
    participants = markPresence(participants, access.participantId);
    db.prepare("UPDATE interview_rooms SET participants = ?, updated_at = ? WHERE id = ?").run(
      JSON.stringify(participants),
      Date.now(),
      row.id,
    );
    const updated = db.prepare("SELECT * FROM interview_rooms WHERE id = ?").get(row.id);
    res.json({
      room: roomForAccess(updated, access),
      you: { role: access.role, participantId: access.participantId },
    });
  });

  app.post("/api/room/:code/turn", (req, res) => {
    const code = String(req.params.code || "").trim().toUpperCase();
    const row = db
      .prepare(
        "SELECT * FROM interview_rooms WHERE join_code = ? OR host_code = ? OR interviewer_code = ?",
      )
      .get(code, code, code);
    if (!row) {
      res.status(404).json({ error: "Room not found." });
      return;
    }
    if (normalizeRoomStatus(row.status) === "ended") {
      res.status(400).json({ error: "This room has ended." });
      return;
    }
    const access = resolveAccess(row, { code, roleHint: req.body.role });
    if (!access) {
      res.status(403).json({ error: "Invalid room code." });
      return;
    }
    const kind = String(req.body.kind || "note");
    const text = String(req.body.text || "").trim();
    if (!text) {
      res.status(400).json({ error: "Turn text is required." });
      return;
    }
    if (kind === "answer" && access.role !== "candidate") {
      res.status(403).json({ error: "Only the candidate can submit answers." });
      return;
    }
    if (kind === "question" && access.role === "candidate") {
      res.status(403).json({ error: "Candidates cannot post agenda questions." });
      return;
    }
    const agenda = parse(row.agenda, []);
    const facts = parse(row.facts, {});
    const participants = markPresence(parse(row.participants, []), access.participantId);
    const speaker = participants.find((person) => person.id === access.participantId);
    const promptId = String(req.body.promptId || row.current_prompt_id || agenda[0]?.id || "");
    const question = agenda.find((item) => item.id === promptId);
    let feedback = null;
    if (kind === "answer") {
      feedback = scoreRoomCandidateAnswer({
        question: question?.prompt || text,
        answer: text,
        facts,
      });
    }
    const transcript = appendRoomTurn(parse(row.transcript, []), {
      id: id("turn"),
      promptId,
      kind: ["question", "answer", "note"].includes(kind) ? kind : "note",
      speakerRole: access.role,
      speakerName: speaker?.displayName || access.role,
      speakerId: access.participantId,
      text,
      mode: req.body.mode === "speech" ? "speech" : "typed",
      feedback,
    });
    const now = Date.now();
    const nextStatus = normalizeRoomStatus(row.status) === "lobby" ? "live" : row.status;
    db.prepare(
      `UPDATE interview_rooms SET transcript = ?, participants = ?, status = ?, current_prompt_id = ?,
        started_at = COALESCE(started_at, ?), updated_at = ? WHERE id = ?`,
    ).run(
      JSON.stringify(transcript),
      JSON.stringify(participants),
      nextStatus,
      promptId || row.current_prompt_id,
      now,
      now,
      row.id,
    );
    const updated = db.prepare("SELECT * FROM interview_rooms WHERE id = ?").get(row.id);
    res.json({
      room: roomForAccess(updated, access),
      you: { role: access.role, participantId: access.participantId },
    });
  });

  app.post("/api/room/:code/prompt", (req, res) => {
    const code = String(req.params.code || "").trim().toUpperCase();
    const row = db
      .prepare(
        "SELECT * FROM interview_rooms WHERE join_code = ? OR host_code = ? OR interviewer_code = ?",
      )
      .get(code, code, code);
    if (!row) {
      res.status(404).json({ error: "Room not found." });
      return;
    }
    const access = resolveAccess(row, { code, roleHint: req.body.role });
    if (!access || access.role === "candidate") {
      res.status(403).json({ error: "Only hosts or interviewers can change the active prompt." });
      return;
    }
    const promptId = String(req.body.promptId || "").trim();
    const agenda = parse(row.agenda, []);
    if (!agenda.some((item) => item.id === promptId)) {
      res.status(400).json({ error: "Unknown agenda prompt." });
      return;
    }
    const participants = markPresence(parse(row.participants, []), access.participantId);
    db.prepare(
      "UPDATE interview_rooms SET current_prompt_id = ?, participants = ?, updated_at = ? WHERE id = ?",
    ).run(promptId, JSON.stringify(participants), Date.now(), row.id);
    const updated = db.prepare("SELECT * FROM interview_rooms WHERE id = ?").get(row.id);
    res.json({
      room: roomForAccess(updated, access),
      you: { role: access.role, participantId: access.participantId },
    });
  });

  app.put("/api/room/:code/notes", (req, res) => {
    const code = String(req.params.code || "").trim().toUpperCase();
    const row = db
      .prepare(
        "SELECT * FROM interview_rooms WHERE join_code = ? OR host_code = ? OR interviewer_code = ?",
      )
      .get(code, code, code);
    if (!row) {
      res.status(404).json({ error: "Room not found." });
      return;
    }
    const access = resolveAccess(row, { code, roleHint: req.body.role });
    if (!access || access.role === "candidate") {
      res.status(403).json({ error: "Private notes are for hosts and interviewers." });
      return;
    }
    const notes = parse(row.private_notes, {});
    notes[access.participantId] = String(req.body.notes || "").trim().slice(0, 4000);
    db.prepare("UPDATE interview_rooms SET private_notes = ?, updated_at = ? WHERE id = ?").run(
      JSON.stringify(notes),
      Date.now(),
      row.id,
    );
    const updated = db.prepare("SELECT * FROM interview_rooms WHERE id = ?").get(row.id);
    res.json({
      room: roomForAccess(updated, access),
      you: { role: access.role, participantId: access.participantId },
    });
  });

  function findRoomByCode(code) {
    const normalized = String(code || "").trim().toUpperCase();
    return db
      .prepare(
        "SELECT * FROM interview_rooms WHERE join_code = ? OR host_code = ? OR interviewer_code = ?",
      )
      .get(normalized, normalized, normalized);
  }

  app.get("/api/room/:code/rtc", (req, res) => {
    const code = String(req.params.code || "").trim().toUpperCase();
    const row = findRoomByCode(code);
    if (!row) {
      res.status(404).json({ error: "Room not found." });
      return;
    }
    const access = resolveAccess(row, { code, roleHint: req.query.role });
    if (!access) {
      res.status(403).json({ error: "Invalid room code." });
      return;
    }
    res.json({
      iceServers: resolveIceServers(),
      media: iceConfigSummary(resolveIceServers()),
      you: { role: access.role, participantId: access.participantId },
      participants: parse(row.participants, []),
    });
  });

  app.post("/api/room/:code/audio", (req, res) => {
    const code = String(req.params.code || "").trim().toUpperCase();
    const row = findRoomByCode(code);
    if (!row) {
      res.status(404).json({ error: "Room not found." });
      return;
    }
    if (normalizeRoomStatus(row.status) === "ended") {
      res.status(400).json({ error: "This room has ended." });
      return;
    }
    const access = resolveAccess(row, { code, roleHint: req.body.role });
    if (!access) {
      res.status(403).json({ error: "Invalid room code." });
      return;
    }
    const now = Date.now();
    const participants = upsertAudioParticipant(parse(row.participants, []), access.participantId, {
      audioConnected: req.body.audioConnected,
      audioMuted: req.body.audioMuted,
    }, now);
    db.prepare("UPDATE interview_rooms SET participants = ?, updated_at = ? WHERE id = ?").run(
      JSON.stringify(participants),
      now,
      row.id,
    );
    if (req.body.audioConnected === false) {
      const hangups = parse(row.participants, [])
        .filter((person) => person.id !== access.participantId)
        .map((person) =>
          buildSignal({
            id: id("sig"),
            roomId: row.id,
            fromParticipantId: access.participantId,
            toParticipantId: person.id,
            type: "hangup",
            payload: {},
            createdAt: now,
          }),
        )
        .filter(Boolean);
      const insert = db.prepare(
        `INSERT INTO interview_room_signals (id, room_id, from_participant_id, to_participant_id, type, payload, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const signal of hangups) {
        insert.run(
          signal.id,
          signal.roomId,
          signal.fromParticipantId,
          signal.toParticipantId,
          signal.type,
          JSON.stringify(signal.payload),
          signal.createdAt,
        );
      }
    }
    const updated = db.prepare("SELECT * FROM interview_rooms WHERE id = ?").get(row.id);
    res.json({
      room: roomForAccess(updated, access),
      you: { role: access.role, participantId: access.participantId },
      iceServers: resolveIceServers(),
    });
  });

  app.post("/api/room/:code/signals", (req, res) => {
    const code = String(req.params.code || "").trim().toUpperCase();
    const row = findRoomByCode(code);
    if (!row) {
      res.status(404).json({ error: "Room not found." });
      return;
    }
    if (normalizeRoomStatus(row.status) === "ended") {
      res.status(400).json({ error: "This room has ended." });
      return;
    }
    const access = resolveAccess(row, { code, roleHint: req.body.role });
    if (!access) {
      res.status(403).json({ error: "Invalid room code." });
      return;
    }
    const type = normalizeSignalType(req.body.type);
    if (!type) {
      res.status(400).json({ error: "Signal type must be offer, answer, ice, or hangup." });
      return;
    }
    const toParticipantId = String(req.body.toParticipantId || "").trim();
    if (!toParticipantId || toParticipantId === access.participantId) {
      res.status(400).json({ error: "A different toParticipantId is required." });
      return;
    }
    const signal = buildSignal({
      id: id("sig"),
      roomId: row.id,
      fromParticipantId: access.participantId,
      toParticipantId,
      type,
      payload: req.body.payload || {},
      createdAt: Date.now(),
    });
    if (!signal) {
      res.status(400).json({ error: "Invalid signal." });
      return;
    }
    db.prepare(
      `INSERT INTO interview_room_signals (id, room_id, from_participant_id, to_participant_id, type, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      signal.id,
      signal.roomId,
      signal.fromParticipantId,
      signal.toParticipantId,
      signal.type,
      JSON.stringify(signal.payload),
      signal.createdAt,
    );
    // prune old signals for this room
    const existing = db
      .prepare("SELECT * FROM interview_room_signals WHERE room_id = ? ORDER BY created_at")
      .all(row.id)
      .map((item) => ({
        id: item.id,
        roomId: item.room_id,
        fromParticipantId: item.from_participant_id,
        toParticipantId: item.to_participant_id,
        type: item.type,
        payload: parse(item.payload, {}),
        createdAt: item.created_at,
      }));
    const keep = new Set(pruneSignals(existing).map((item) => item.id));
    for (const item of existing) {
      if (!keep.has(item.id)) {
        db.prepare("DELETE FROM interview_room_signals WHERE id = ?").run(item.id);
      }
    }
    res.json({ signal });
  });

  app.get("/api/room/:code/signals", (req, res) => {
    const code = String(req.params.code || "").trim().toUpperCase();
    const row = findRoomByCode(code);
    if (!row) {
      res.status(404).json({ error: "Room not found." });
      return;
    }
    const access = resolveAccess(row, { code, roleHint: req.query.role });
    if (!access) {
      res.status(403).json({ error: "Invalid room code." });
      return;
    }
    const since = Number(req.query.since) || 0;
    const rows = db
      .prepare("SELECT * FROM interview_room_signals WHERE room_id = ? ORDER BY created_at")
      .all(row.id)
      .map((item) => ({
        id: item.id,
        roomId: item.room_id,
        fromParticipantId: item.from_participant_id,
        toParticipantId: item.to_participant_id,
        type: item.type,
        payload: parse(item.payload, {}),
        createdAt: item.created_at,
      }));
    const signals = filterSignalsForPeer(rows, access.participantId, { since, limit: 100 });
    res.json({
      signals,
      iceServers: resolveIceServers(),
      participants: parse(row.participants, []),
      cursor: signals.length ? signals[signals.length - 1].createdAt : since,
    });
  });
}
