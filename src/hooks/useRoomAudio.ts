import { useEffect, useRef, useState } from "react";
import { api } from "../api";

type AudioParticipant = {
  id: string;
  displayName?: string;
  audioConnected?: boolean;
  audioMuted?: boolean;
};

type Signal = {
  id: string;
  fromParticipantId: string;
  toParticipantId: string;
  type: "offer" | "answer" | "ice" | "hangup";
  payload: {
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
  };
  createdAt: number;
};

function shouldCreateOffer(selfId: string, peerId: string) {
  return selfId < peerId;
}

export function useRoomAudio({
  code,
  role,
  participantId,
  enabled,
}: {
  code: string;
  role: string;
  participantId: string;
  enabled: boolean;
}) {
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState("");
  const [peers, setPeers] = useState<AudioParticipant[]>([]);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const cursorRef = useRef(0);
  const iceServersRef = useRef<RTCIceServer[]>([{ urls: "stun:stun.l.google.com:19302" }]);
  const makingOfferRef = useRef<Set<string>>(new Set());

  function cleanupPeer(peerId: string) {
    const pc = peersRef.current.get(peerId);
    if (pc) {
      pc.close();
      peersRef.current.delete(peerId);
    }
    const audio = audioElsRef.current.get(peerId);
    if (audio) {
      audio.srcObject = null;
      audio.remove();
      audioElsRef.current.delete(peerId);
    }
    makingOfferRef.current.delete(peerId);
  }

  function cleanupAll() {
    for (const peerId of [...peersRef.current.keys()]) cleanupPeer(peerId);
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
  }

  async function sendSignal(type: Signal["type"], toParticipantId: string, payload: Signal["payload"]) {
    await api(`/api/room/${code}/signals`, {
      method: "POST",
      body: JSON.stringify({ role, type, toParticipantId, payload }),
    });
  }

  async function ensurePeer(peerId: string) {
    const existing = peersRef.current.get(peerId);
    if (existing) return existing;
    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });
    peersRef.current.set(peerId, pc);
    const stream = localStreamRef.current;
    if (stream) {
      for (const track of stream.getTracks()) pc.addTrack(track, stream);
    }
    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      void sendSignal("ice", peerId, { candidate: event.candidate.toJSON() }).catch(() => undefined);
    };
    pc.ontrack = (event) => {
      let audio = audioElsRef.current.get(peerId);
      if (!audio) {
        audio = document.createElement("audio");
        audio.autoplay = true;
        audio.dataset.peerId = peerId;
        document.body.appendChild(audio);
        audioElsRef.current.set(peerId, audio);
      }
      audio.srcObject = event.streams[0] || new MediaStream([event.track]);
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "closed" || pc.connectionState === "disconnected") {
        cleanupPeer(peerId);
      }
    };
    return pc;
  }

  async function createOffer(peerId: string) {
    if (!shouldCreateOffer(participantId, peerId)) return;
    if (makingOfferRef.current.has(peerId)) return;
    makingOfferRef.current.add(peerId);
    try {
      const pc = await ensurePeer(peerId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal("offer", peerId, { sdp: pc.localDescription || offer });
    } finally {
      makingOfferRef.current.delete(peerId);
    }
  }

  async function handleSignal(signal: Signal) {
    if (signal.type === "hangup") {
      cleanupPeer(signal.fromParticipantId);
      return;
    }
    const pc = await ensurePeer(signal.fromParticipantId);
    if (signal.type === "offer" && signal.payload.sdp) {
      await pc.setRemoteDescription(signal.payload.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal("answer", signal.fromParticipantId, { sdp: pc.localDescription || answer });
      return;
    }
    if (signal.type === "answer" && signal.payload.sdp) {
      if (!pc.currentRemoteDescription) await pc.setRemoteDescription(signal.payload.sdp);
      return;
    }
    if (signal.type === "ice" && signal.payload.candidate) {
      try {
        await pc.addIceCandidate(signal.payload.candidate);
      } catch {
        // Candidate may arrive before remote description; ignore quietly.
      }
    }
  }

  async function syncPeers(participants: AudioParticipant[]) {
    setPeers(participants.filter((person) => person.id !== participantId && person.audioConnected));
    const connectedIds = new Set(
      participants.filter((person) => person.id !== participantId && person.audioConnected).map((person) => person.id),
    );
    for (const peerId of connectedIds) {
      if (!peersRef.current.has(peerId) && shouldCreateOffer(participantId, peerId)) {
        await createOffer(peerId);
      }
    }
    for (const peerId of [...peersRef.current.keys()]) {
      if (!connectedIds.has(peerId)) cleanupPeer(peerId);
    }
  }

  async function join() {
    setError("");
    try {
      const config = await api<{ iceServers: RTCIceServer[] }>(`/api/room/${code}/rtc?role=${encodeURIComponent(role)}`);
      if (config.iceServers?.length) iceServersRef.current = config.iceServers;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
      const data = await api<{ room: { participants: AudioParticipant[] } }>(`/api/room/${code}/audio`, {
        method: "POST",
        body: JSON.stringify({ role, audioConnected: true, audioMuted: muted }),
      });
      setJoined(true);
      cursorRef.current = Date.now() - 1000;
      await syncPeers(data.room.participants || []);
    } catch (err) {
      cleanupAll();
      setJoined(false);
      setError(err instanceof Error ? err.message : "Could not join audio.");
    }
  }

  async function leave() {
    setError("");
    try {
      await api(`/api/room/${code}/audio`, {
        method: "POST",
        body: JSON.stringify({ role, audioConnected: false, audioMuted: false }),
      });
    } catch {
      // still clean local state
    }
    cleanupAll();
    setJoined(false);
    setPeers([]);
  }

  async function toggleMute() {
    const next = !muted;
    setMuted(next);
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    if (joined) {
      await api(`/api/room/${code}/audio`, {
        method: "POST",
        body: JSON.stringify({ role, audioConnected: true, audioMuted: next }),
      }).catch(() => undefined);
    }
  }

  useEffect(() => {
    if (!enabled || !joined || !participantId) return;
    let cancelled = false;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const data = await api<{
            signals: Signal[];
            cursor: number;
            participants: AudioParticipant[];
          }>(`/api/room/${code}/signals?role=${encodeURIComponent(role)}&since=${cursorRef.current}`);
          if (cancelled) return;
          if (data.cursor) cursorRef.current = data.cursor;
          await syncPeers(data.participants || []);
          for (const signal of data.signals || []) {
            await handleSignal(signal);
          }
        } catch {
          // keep polling
        }
      })();
    }, 1500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [enabled, joined, participantId, code, role]);

  useEffect(() => () => {
    cleanupAll();
  }, []);

  return {
    joined,
    muted,
    error,
    peers,
    join,
    leave,
    toggleMute,
  };
}
