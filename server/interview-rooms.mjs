/** Multi-party interview room helpers. */

import { makeJoinCode, scoreLiveAnswer, summarizeLiveSession } from "./employer-voice.mjs";

export const ROOM_STATUSES = ["lobby", "live", "ended"];
export const ROOM_ROLES = ["host", "interviewer", "candidate"];

export function normalizeRoomStatus(value, fallback = "lobby") {
  const raw = String(value || "").trim().toLowerCase();
  return ROOM_STATUSES.includes(raw) ? raw : fallback;
}

export function normalizeRoomRole(value, fallback = "interviewer") {
  const raw = String(value || "").trim().toLowerCase();
  return ROOM_ROLES.includes(raw) ? raw : fallback;
}

export function canChangeRoomStatus(from, to) {
  const current = normalizeRoomStatus(from);
  const next = normalizeRoomStatus(to);
  if (current === next) return true;
  if (current === "lobby" && (next === "live" || next === "ended")) return true;
  if (current === "live" && next === "ended") return true;
  return false;
}

export function makeRoomCodes() {
  return {
    joinCode: makeJoinCode(),
    hostCode: makeJoinCode(),
    interviewerCode: makeJoinCode(),
  };
}

/**
 * Build a participant list with one host, optional interviewers, and the candidate seat.
 */
export function buildRoomParticipants({
  hostName = "Host",
  hostUserId = "",
  candidateName = "Candidate",
  candidateUserId = "",
  interviewers = [],
} = {}) {
  const participants = [
    {
      id: "host",
      role: "host",
      displayName: String(hostName || "Host").trim() || "Host",
      userId: hostUserId || "",
      present: false,
      lastSeenAt: null,
      audioConnected: false,
      audioMuted: false,
    },
    {
      id: "candidate",
      role: "candidate",
      displayName: String(candidateName || "Candidate").trim() || "Candidate",
      userId: candidateUserId || "",
      present: false,
      lastSeenAt: null,
      audioConnected: false,
      audioMuted: false,
    },
  ];
  const extras = (interviewers || [])
    .map((person, index) => ({
      id: `interviewer-${index + 1}`,
      role: "interviewer",
      displayName: String(person.displayName || person.name || `Interviewer ${index + 1}`).trim(),
      userId: String(person.userId || ""),
      present: false,
      lastSeenAt: null,
      audioConnected: false,
      audioMuted: false,
    }))
    .filter((person) => person.displayName)
    .slice(0, 3);
  return [...participants, ...extras];
}

export function markPresence(participants = [], participantId, at = Date.now()) {
  return (participants || []).map((person) => {
    if (person.id === participantId) {
      return { ...person, present: true, lastSeenAt: at };
    }
    const fresh = person.lastSeenAt ? at - Number(person.lastSeenAt) < 20000 : false;
    return {
      ...person,
      present: fresh,
      audioConnected: Boolean(person.audioConnected) && fresh,
    };
  });
}

export function appendRoomTurn(turns = [], turn = {}) {
  const next = {
    id: turn.id || `turn-${Date.now()}`,
    promptId: turn.promptId || "",
    kind: turn.kind || "note",
    speakerRole: normalizeRoomRole(turn.speakerRole, "host"),
    speakerName: String(turn.speakerName || "").trim() || "Participant",
    speakerId: String(turn.speakerId || ""),
    text: String(turn.text || "").trim(),
    mode: turn.mode === "speech" ? "speech" : turn.mode === "system" ? "system" : "typed",
    feedback: turn.feedback || null,
    createdAt: turn.createdAt || Date.now(),
  };
  if (!next.text) return turns;
  return [...turns, next].slice(-200);
}

export function summarizeRoom({ turns = [], participants = [], status = "lobby" } = {}) {
  const answerTurns = turns.filter((turn) => turn.speakerRole === "candidate" && turn.kind === "answer");
  const scored = answerTurns.filter((turn) => turn.feedback);
  const voiceSummary = summarizeLiveSession(
    scored.map((turn) => ({
      answer: turn.text,
      feedback: turn.feedback,
    })),
  );
  const present = participants.filter((person) => person.present).length;
  return {
    status: normalizeRoomStatus(status),
    present,
    participantCount: participants.length,
    turns: turns.length,
    candidateAnswers: answerTurns.length,
    averageScore: voiceSummary.averageScore,
    inventedMetricFlags: voiceSummary.inventedMetricFlags,
  };
}

/**
 * Score a candidate answer in-room using only public facts.
 */
export function scoreRoomCandidateAnswer({ question = "", answer = "", facts = {} } = {}) {
  return scoreLiveAnswer({
    question: { prompt: question, kind: "star" },
    answer,
    facts,
  });
}
