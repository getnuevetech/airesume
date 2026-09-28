/** WebRTC signaling helpers for interview room audio. */

export const SIGNAL_TYPES = ["offer", "answer", "ice", "hangup"];

export function normalizeSignalType(value, fallback = "") {
  const raw = String(value || "").trim().toLowerCase();
  return SIGNAL_TYPES.includes(raw) ? raw : fallback;
}

export function buildSignal({
  id,
  roomId,
  fromParticipantId,
  toParticipantId,
  type,
  payload,
  createdAt = Date.now(),
} = {}) {
  const signalType = normalizeSignalType(type);
  if (!signalType) return null;
  const from = String(fromParticipantId || "").trim();
  const to = String(toParticipantId || "").trim();
  if (!from || !to || from === to) return null;
  return {
    id: String(id || ""),
    roomId: String(roomId || ""),
    fromParticipantId: from,
    toParticipantId: to,
    type: signalType,
    payload: payload == null ? {} : payload,
    createdAt: Number(createdAt) || Date.now(),
  };
}

/**
 * Keep only recent signals and drop delivered ones targeting others when filtering for a peer.
 */
export function filterSignalsForPeer(signals = [], participantId, { since = 0, limit = 100 } = {}) {
  const peer = String(participantId || "").trim();
  const sinceTs = Number(since) || 0;
  return (signals || [])
    .filter((item) => {
      if (!item || item.toParticipantId !== peer) return false;
      if (item.fromParticipantId === peer) return false;
      return Number(item.createdAt || 0) > sinceTs;
    })
    .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0) || String(a.id).localeCompare(String(b.id)))
    .slice(0, Math.max(1, Math.min(200, Number(limit) || 100)));
}

export function pruneSignals(signals = [], { maxAgeMs = 5 * 60 * 1000, now = Date.now(), maxCount = 200 } = {}) {
  const cutoff = Number(now) - Math.max(30_000, Number(maxAgeMs) || 0);
  return (signals || [])
    .filter((item) => Number(item.createdAt || 0) >= cutoff)
    .sort((a, b) => Number(a.createdAt || 0) - Number(b.createdAt || 0))
    .slice(-Math.max(20, Math.min(500, Number(maxCount) || 200)));
}

export function upsertAudioParticipant(participants = [], participantId, patch = {}, now = Date.now()) {
  const id = String(participantId || "").trim();
  if (!id) return participants || [];
  return (participants || []).map((person) => {
    if (person.id !== id) {
      return {
        ...person,
        present: person.lastSeenAt ? now - Number(person.lastSeenAt) < 20000 : Boolean(person.present),
        audioConnected: Boolean(person.audioConnected) && person.lastSeenAt ? now - Number(person.lastSeenAt) < 20000 : false,
      };
    }
    return {
      ...person,
      present: true,
      lastSeenAt: now,
      audioConnected: patch.audioConnected != null ? Boolean(patch.audioConnected) : Boolean(person.audioConnected),
      audioMuted: patch.audioMuted != null ? Boolean(patch.audioMuted) : Boolean(person.audioMuted),
    };
  });
}

export function listAudioPeers(participants = [], selfId) {
  return (participants || []).filter(
    (person) => person.id !== selfId && person.audioConnected && person.present !== false,
  );
}

/** Deterministic offerer avoids glare: lower participant id creates the offer. */
export function shouldCreateOffer(selfId, peerId) {
  return String(selfId) < String(peerId);
}

export const DEFAULT_ICE_SERVERS = [{ urls: "stun:stun.l.google.com:19302" }];
