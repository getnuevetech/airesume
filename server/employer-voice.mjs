/** Employer-led live voice interview helpers. */

import { scoreVoiceAnswer, summarizeVoiceSession } from "./voice-interview.mjs";

export const EMPLOYER_VOICE_STATUSES = ["scheduled", "live", "complete", "cancelled"];

const DEFAULT_PROMPTS = [
  { id: "intro", prompt: "Tell me about yourself and the work you are proudest of.", kind: "intro" },
  { id: "role-fit", prompt: "Why are you interested in this role?", kind: "motivation" },
  { id: "challenge", prompt: "Walk me through a challenging project you owned.", kind: "star" },
  { id: "impact", prompt: "What measurable impact can you verify from your resume?", kind: "star" },
  { id: "growth", prompt: "Where are you still growing for roles like this?", kind: "growth" },
  { id: "questions", prompt: "What would you like to know about the team or role?", kind: "close" },
];

function lower(value) {
  return String(value || "").toLowerCase();
}

function unique(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = lower(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(String(item));
  }
  return out;
}

function parseJson(value, fallback) {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function makeJoinCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

/**
 * Build default live-interview questions for a role and public candidate profile.
 */
export function buildEmployerVoiceQuestions({ roleTitle = "", candidate = {}, custom = [] } = {}) {
  const role = String(roleTitle || candidate.headline || "this role").trim();
  const skills = unique([...(candidate.skills || [])]).slice(0, 4);
  const base = DEFAULT_PROMPTS.map((item) => {
    if (item.id === "role-fit") {
      return { ...item, prompt: `Why are you interested in ${role}?` };
    }
    if (item.id === "impact" && skills.length) {
      return {
        ...item,
        prompt: `What impact can you verify around ${skills.slice(0, 2).join(" or ")} from your resume?`,
      };
    }
    return { ...item };
  });
  const extras = (custom || [])
    .map((prompt, index) => ({
      id: `custom-${index + 1}`,
      prompt: String(prompt || "").trim(),
      kind: "custom",
    }))
    .filter((item) => item.prompt.length >= 8)
    .slice(0, 4);
  return [...base, ...extras].slice(0, 10);
}

/**
 * Extract only public-facing facts for live scoring (never private resume versions).
 */
export function publicCandidateFacts(profile = {}, preferences = {}) {
  const employment = parseJson(profile.employment, []);
  const skills = unique(parseJson(profile.skills, [])).slice(0, 16);
  const employers = unique(employment.map((job) => job.employer).filter(Boolean));
  const titles = unique(employment.map((job) => job.title).filter(Boolean));
  const phrases = unique(
    employment.flatMap((job) => (job.bullets || []).map((bullet) => String(bullet || "").trim())).filter(Boolean),
  ).slice(0, 12);
  const knownNumbers = unique(
    [...phrases, String(profile.summary || "")].join(" ").match(/\d+(\.\d+)?%?|\b\d{4}\b/g) || [],
  );
  return {
    skills,
    employers,
    titles,
    knownNumbers,
    shareContact: preferences.shareContact !== false,
  };
}

export function scoreLiveAnswer({ question, answer = "", facts = {} } = {}) {
  return scoreVoiceAnswer({
    prompt: question,
    answer,
    facts,
    coachAnswer: "",
  });
}

export function summarizeLiveSession(turns = []) {
  const summary = summarizeVoiceSession(turns);
  return {
    ...summary,
    asked: turns.filter((turn) => String(turn.prompt || "").trim()).length,
    status:
      summary.status === "complete"
        ? "complete"
        : summary.answered
          ? "live"
          : turns.length
            ? "scheduled"
            : "scheduled",
  };
}

export function normalizeSessionStatus(value, fallback = "scheduled") {
  const raw = String(value || "").trim().toLowerCase();
  return EMPLOYER_VOICE_STATUSES.includes(raw) ? raw : fallback;
}

export function canAdvanceSession(from, to) {
  const current = normalizeSessionStatus(from);
  const next = normalizeSessionStatus(to);
  if (current === next) return true;
  if (current === "cancelled" || current === "complete") return false;
  if (current === "scheduled" && (next === "live" || next === "cancelled")) return true;
  if (current === "live" && (next === "complete" || next === "cancelled")) return true;
  return false;
}
