import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api } from "../api";

type RoomParticipant = {
  id: string;
  role: string;
  displayName: string;
  present: boolean;
  lastSeenAt: number | null;
};

type RoomTurn = {
  id: string;
  promptId: string;
  kind: string;
  speakerRole: string;
  speakerName: string;
  speakerId: string;
  text: string;
  mode: string;
  feedback: { score: number; label: string; notes: string[]; unverifiedNumbers: string[] } | null;
  createdAt: number;
};

type InterviewRoom = {
  id: string;
  title: string;
  roleTitle: string;
  status: string;
  joinCode: string;
  interviewerCode: string;
  hostCode: string;
  joinPath: string;
  interviewerPath: string;
  hostPath: string;
  companyName: string;
  employerName: string;
  agenda: { id: string; prompt: string; kind: string }[];
  transcript: RoomTurn[];
  participants: RoomParticipant[];
  currentPromptId: string;
  privateNotes: Record<string, string>;
  summary: {
    present: number;
    participantCount: number;
    turns: number;
    candidateAnswers: number;
    averageScore: number;
    inventedMetricFlags: number;
  };
  candidate: { name: string; headline: string; resumeUrl: string } | null;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

export function InterviewRoomPage() {
  const { code = "" } = useParams();
  const [search] = useSearchParams();
  const [room, setRoom] = useState<InterviewRoom | null>(null);
  const [you, setYou] = useState<{ role: string; participantId: string } | null>(null);
  const [text, setText] = useState("");
  const [notes, setNotes] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const activePrompt = useMemo(
    () => room?.agenda.find((item) => item.id === room.currentPromptId) || room?.agenda[0] || null,
    [room],
  );

  async function refresh() {
    const data = await api<{ room: InterviewRoom; you: { role: string; participantId: string } }>(
      `/api/room/${code}?role=${encodeURIComponent(search.get("role") || "")}`,
    );
    setRoom(data.room);
    setYou(data.you);
    const mine = data.room.privateNotes?.[data.you.participantId] || "";
    setNotes(mine);
  }

  useEffect(() => {
    void refresh().catch((err: Error) => setError(err.message));
    const timer = window.setInterval(() => {
      void api<{ room: InterviewRoom; you: { role: string; participantId: string } }>(`/api/room/${code}/presence`, {
        method: "POST",
        body: JSON.stringify({ role: search.get("role") || "", displayName }),
      })
        .then((data) => {
          setRoom(data.room);
          setYou(data.you);
        })
        .catch(() => undefined);
    }, 4000);
    return () => {
      window.clearInterval(timer);
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, [code]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [room?.transcript.length]);

  function speak(value: string) {
    if (!value || !window.speechSynthesis) {
      setError("Speech synthesis is not available in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(value));
  }

  function stopListening() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }

  function startListening() {
    const SpeechRecognition = (window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition is not available. Type instead.");
      return;
    }
    stopListening();
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let next = "";
      for (let i = 0; i < event.results.length; i += 1) next += event.results[i][0].transcript;
      setText(next.trim());
    };
    recognition.onerror = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  async function postTurn(kind: "question" | "answer" | "note", mode: "typed" | "speech" = "typed") {
    if (!text.trim() || !you) return;
    setBusy(true);
    setError("");
    stopListening();
    try {
      const data = await api<{ room: InterviewRoom; you: { role: string; participantId: string } }>(`/api/room/${code}/turn`, {
        method: "POST",
        body: JSON.stringify({
          kind,
          text,
          mode,
          role: you.role,
          promptId: room?.currentPromptId || "",
        }),
      });
      setRoom(data.room);
      setYou(data.you);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not post to the room.");
    } finally {
      setBusy(false);
    }
  }

  async function setPrompt(promptId: string) {
    if (!you) return;
    try {
      const data = await api<{ room: InterviewRoom }>(`/api/room/${code}/prompt`, {
        method: "POST",
        body: JSON.stringify({ promptId, role: you.role }),
      });
      setRoom(data.room);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change prompt.");
    }
  }

  async function saveNotes() {
    if (!you) return;
    try {
      const data = await api<{ room: InterviewRoom }>(`/api/room/${code}/notes`, {
        method: "PUT",
        body: JSON.stringify({ notes, role: you.role }),
      });
      setRoom(data.room);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save notes.");
    }
  }

  if (error && !room) {
    return (
      <div className="container narrow-page">
        <header className="page-hero">
          <h1>Room unavailable</h1>
          <p className="lede">{error}</p>
        </header>
      </div>
    );
  }

  if (!room || !you) {
    return (
      <div className="container narrow-page">
        <p className="lede">Joining room…</p>
      </div>
    );
  }

  const isHostOrInterviewer = you.role === "host" || you.role === "interviewer";

  return (
    <div className="container narrow-page">
      <header className="page-hero">
        <p className="eyebrow">Interview room · {you.role}</p>
        <h1>{room.title}</h1>
        <p className="lede">
          {room.companyName || room.employerName} · {room.status}
          {` · ${room.summary.present}/${room.summary.participantCount} present`}
          {room.summary.averageScore ? ` · avg ${room.summary.averageScore}` : ""}
        </p>
      </header>
      {error ? <p className="form-error">{error}</p> : null}
      <section className="account-card">
        <h2>Participants</h2>
        <div className="chips">
          {room.participants.map((person) => (
            <span className={`chip ${person.present ? "on" : ""}`} key={person.id}>
              {person.displayName} · {person.role}{person.present ? " · here" : ""}
            </span>
          ))}
        </div>
        {you.role === "interviewer" ? (
          <label className="field">
            <span>Your display name</span>
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Alex, hiring manager" />
          </label>
        ) : null}
      </section>
      <section className="account-card">
        <h2>Agenda</h2>
        <div className="interview-pick">
          {room.agenda.map((item) => (
            <button
              key={item.id}
              type="button"
              className={room.currentPromptId === item.id ? "on" : ""}
              disabled={!isHostOrInterviewer || room.status === "ended"}
              onClick={() => void setPrompt(item.id)}
            >
              <strong>{item.prompt}</strong>
              <span className="role">{item.kind}</span>
            </button>
          ))}
        </div>
        {activePrompt ? (
          <div className="job-actions" style={{ justifyContent: "flex-start", marginTop: 12 }}>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => speak(activePrompt.prompt)}>Hear prompt</button>
            {room.candidate?.resumeUrl && isHostOrInterviewer ? (
              <Link className="btn btn-ghost btn-sm" to={room.candidate.resumeUrl} target="_blank">Candidate resume</Link>
            ) : null}
          </div>
        ) : null}
      </section>
      <section className="account-card voice-practice">
        <h2>Shared transcript</h2>
        <div className="room-transcript">
          {room.transcript.length ? room.transcript.map((turn) => (
            <article key={turn.id} className="room-turn">
              <p className="role">{turn.speakerName} · {turn.kind} · {turn.mode}</p>
              <p>{turn.text}</p>
              {turn.feedback ? (
                <p className="role">{turn.feedback.label} · {turn.feedback.score}{turn.feedback.unverifiedNumbers?.length ? " · invented metric flagged" : ""}</p>
              ) : null}
            </article>
          )) : <p className="role">No turns yet. Hosts ask, candidates answer, everyone can leave notes.</p>}
          <div ref={bottomRef} />
        </div>
        {room.status !== "ended" ? (
          <>
            <label className="field">
              <span>{you.role === "candidate" ? "Your answer" : "Your message"}{listening ? " (listening…)" : ""}</span>
              <textarea rows={4} value={text} onChange={(event) => setText(event.target.value)} placeholder={you.role === "candidate" ? "Speak from verified resume facts." : "Ask a follow-up or leave a shared note."} />
            </label>
            <div className="job-actions" style={{ justifyContent: "flex-start" }}>
              {listening ? (
                <button className="btn btn-ghost btn-sm" type="button" onClick={stopListening}>Stop mic</button>
              ) : (
                <button className="btn btn-ghost btn-sm" type="button" onClick={startListening}>Use mic</button>
              )}
              {you.role === "candidate" ? (
                <button className="btn btn-primary btn-sm" type="button" disabled={busy || !text.trim()} onClick={() => void postTurn("answer", listening ? "speech" : "typed")}>
                  {busy ? "Sending…" : "Send answer"}
                </button>
              ) : (
                <>
                  <button className="btn btn-primary btn-sm" type="button" disabled={busy || !text.trim()} onClick={() => void postTurn("question", listening ? "speech" : "typed")}>
                    {busy ? "Sending…" : "Ask / prompt"}
                  </button>
                  <button className="btn btn-ghost btn-sm" type="button" disabled={busy || !text.trim()} onClick={() => void postTurn("note")}>Shared note</button>
                </>
              )}
            </div>
          </>
        ) : null}
      </section>
      {isHostOrInterviewer ? (
        <section className="account-card">
          <h2>Private notes</h2>
          <label className="field">
            <span>Visible only to you in this seat</span>
            <textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => void saveNotes()}>Save notes</button>
        </section>
      ) : null}
    </div>
  );
}
