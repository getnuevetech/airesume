import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useApp } from "../context/AppContext";
import { useAccount } from "./AccountContext";
import { ResumeSheet } from "./ResumeSheet";
import type { AccountData, ResumeView } from "./types";

function Gate({ feature, children }: { feature?: string; children?: ReactNode }) {
  const { data } = useAccount();
  if (!data?.profile) {
    return (
      <section className="account-card">
        <h1>Upload a resume to open this section.</h1>
        <Link className="btn btn-primary" to="/get-started">Upload resume</Link>
      </section>
    );
  }
  if (feature && !data.features[feature]) {
    return (
      <section className="account-card">
        <h1>This is not included on {data.plan.name}.</h1>
        <p className="lede">An admin chooses which sections each plan can use.</p>
        <Link className="btn btn-primary" to="/account/plan">View plans</Link>
      </section>
    );
  }
  return children;
}

export function OverviewPage() {
  const { user } = useApp();
  const { data, error } = useAccount();
  if (!data) return <p className="lede">{error || "Loading your account…"}</p>;
  if (!data.profile) return <Gate />;
  const first = user?.name.split(" ")[0];
  const recommended = data.jobs.filter((job) => job.score >= 70).slice(0, 3);
  return (
    <div className="account-page">
      <header className="account-head">
        <div>
          <p className="eyebrow">{data.plan.name}</p>
          <h1>Good to see you, {first}.</h1>
          <p className="lede">Your search at a glance. Open a section on the left when you want to work on it.</p>
        </div>
      </header>
      <div className="stat-grid">
        <Tile label="Resume rating" value={data.stats.resumeRating === null ? "—" : String(data.stats.resumeRating)} />
        <Tile label="Recommended" value={String(data.stats.recommended)} />
        <Tile label="Ready to submit" value={String(data.stats.ready || 0)} />
        <Tile label="Submitted" value={String(data.stats.applied)} />
      </div>
      <div className="account-split">
        <section className="account-card">
          <h2>Recommended jobs</h2>
          {recommended.length ? recommended.map((job) => (
            <div className="quiet-row" key={job.id}>
              <div>
                <strong>{job.title}</strong>
                <p>{job.applyCompany || job.company} · {job.location || job.remoteType}</p>
                {job.viaCompany ? <p className="role">Listed by {job.viaCompany}{job.sourceName ? ` on ${job.sourceName}` : ""}</p> : null}
              </div>
              <span className="match-badge">{job.score}%</span>
            </div>
          )) : <p className="role">Matches show here after jobs are available on your plan.</p>}
          <Link className="text-btn" to="/account/jobs">See all jobs</Link>
        </section>
        <section className="account-card">
          <h2>Continue</h2>
          <Link className="quiet-row" to="/account/resume"><strong>Review your resume</strong><span>Rating and recommendations</span></Link>
          <Link className="quiet-row" to="/account/insights"><strong>Career insights</strong><span>Skill demand, gaps, and focus areas</span></Link>
          <Link className="quiet-row" to="/account/interview"><strong>Interview prep</strong><span>STAR drafts and voice practice from resume facts</span></Link>
          <Link className="quiet-row" to="/account/invites"><strong>Employer invites</strong><span>Respond to roles employers send you</span></Link>
          <Link className="quiet-row" to="/account/templates"><strong>Choose a template</strong><span>{data.templateLimit} design{data.templateLimit === 1 ? "" : "s"} on this plan</span></Link>
          <Link className="quiet-row" to="/account/profile"><strong>Update your profile</strong><span>Contact, experience, and photo</span></Link>
        </section>
      </div>
    </div>
  );
}

type CareerInsights = {
  summary: {
    catalogJobs: number;
    visibleJobs: number;
    strongMatches: number;
    tracked: number;
    submitted: number;
    responses: number;
    responseRate: number | null;
    skillCount: number;
  };
  strengths: { skill: string; demand: number; kind: string }[];
  gaps: { skill: string; demand: number; kind: string }[];
  risingPreferred: { skill: string; demand: number; kind: string }[];
  categoryOutlook: { category: string; jobs: number; avgScore: number; strong: number }[];
  focus: { id: string; title: string; detail: string }[];
  topMatches: { id: string; title: string; company: string; score: number; label: string; missing: string[] }[];
};

export function InsightsPage() {
  const { setError } = useAccount();
  const [insights, setInsights] = useState<CareerInsights | null>(null);
  const [limited, setLimited] = useState(false);
  const [planName, setPlanName] = useState("");

  useEffect(() => {
    void api<{ insights: CareerInsights; limited: boolean; plan: { name: string } }>("/api/career/insights")
      .then((data) => {
        setInsights(data.insights);
        setLimited(Boolean(data.limited));
        setPlanName(data.plan?.name || "");
      })
      .catch((err: Error) => setError(err.message));
  }, [setError]);

  return (
    <Gate feature="job_browse">
      <div className="account-page">
        <header className="account-head">
          <div>
            <p className="eyebrow">Career intelligence</p>
            <h1>Insights</h1>
            <p className="lede">
              Demand and gaps are counted from open roles against skills already on your resume. Nothing is invented.
              {limited ? ` Your ${planName || "current"} plan shows a shorter skill list.` : ""}
            </p>
          </div>
        </header>
        {!insights ? <p className="lede">Building insights…</p> : (
          <>
            <div className="stat-grid">
              <Tile label="Catalog roles" value={String(insights.summary.catalogJobs)} />
              <Tile label="Strong matches" value={String(insights.summary.strongMatches)} />
              <Tile label="Tracked" value={String(insights.summary.tracked)} />
              <Tile label="Response rate" value={insights.summary.responseRate === null ? "—" : `${insights.summary.responseRate}%`} />
            </div>
            <div className="account-split">
              <section className="account-card">
                <h2>Focus next</h2>
                {insights.focus.length ? insights.focus.map((item) => (
                  <article className="insight-focus" key={item.id}>
                    <strong>{item.title}</strong>
                    <p className="role">{item.detail}</p>
                  </article>
                )) : <p className="role">Add skills or browse jobs to unlock focus tips.</p>}
              </section>
              <section className="account-card">
                <h2>Category outlook</h2>
                {insights.categoryOutlook.length ? insights.categoryOutlook.map((row) => (
                  <div className="quiet-row" key={row.category}>
                    <div>
                      <strong>{row.category}</strong>
                      <p className="role">{row.jobs} roles · {row.strong} strong</p>
                    </div>
                    <span className="match-badge">{row.avgScore}%</span>
                  </div>
                )) : <p className="role">No active jobs yet.</p>}
              </section>
            </div>
            <div className="account-split">
              <section className="account-card">
                <h2>Skills in demand you already have</h2>
                <div className="chips">
                  {insights.strengths.length ? insights.strengths.map((item) => (
                    <span className="chip" key={item.skill}>{item.skill} · {item.demand}</span>
                  )) : <p className="role">Confirm skills on your profile to see strengths.</p>}
                </div>
              </section>
              <section className="account-card">
                <h2>High-demand gaps</h2>
                <p className="role">Only add these if they are true for you.</p>
                <div className="chips">
                  {insights.gaps.length ? insights.gaps.map((item) => (
                    <span className="chip chip-gap" key={item.skill}>{item.skill} · {item.demand}</span>
                  )) : <p className="role">No clear gaps against current listings.</p>}
                </div>
                {insights.risingPreferred.length ? (
                  <>
                    <h3>Also preferred</h3>
                    <div className="chips">
                      {insights.risingPreferred.map((item) => (
                        <span className="chip" key={item.skill}>{item.skill}</span>
                      ))}
                    </div>
                  </>
                ) : null}
              </section>
            </div>
            <section className="account-card">
              <h2>Strong matches to prepare</h2>
              {insights.topMatches.length ? insights.topMatches.map((job) => (
                <div className="quiet-row" key={job.id}>
                  <div>
                    <strong>{job.title}</strong>
                    <p>{job.company}</p>
                    {job.missing.length ? <p className="role">Gap: {job.missing.join(", ")}</p> : null}
                  </div>
                  <span className="match-badge">{job.score}%</span>
                </div>
              )) : <p className="role">No strong matches in your current list.</p>}
              <Link className="text-btn" to="/account/jobs">Open jobs</Link>
            </section>
          </>
        )}
      </div>
    </Gate>
  );
}

type InterviewPrep = {
  applicationId: string | null;
  status: string;
  title: string;
  company: string;
  score: number | null;
  label: string;
  listingUrl: string;
  briefing: {
    role: string;
    category: string;
    location: string;
    verification: string;
    signals: string[];
    missing: string[];
    matched: string[];
  };
  prompts: {
    id: string;
    prompt: string;
    kind: string;
    answer: string;
    ready: boolean;
    note: string;
    sourceBullet?: { title: string; employer: string; bullet: string } | null;
  }[];
  talkingPoints: { skill: string; detail: string; ready: boolean }[];
  askEmployer: string[];
  reminders: string[];
};

type VoiceFeedback = {
  score: number;
  label: string;
  usedSkills: string[];
  usedEmployers: string[];
  usedTitles: string[];
  usedNumbers: string[];
  unverifiedNumbers: string[];
  notes: string[];
  suggestion: string;
};

type VoiceSession = {
  id: string;
  applicationId: string;
  title: string;
  company: string;
  status: string;
  prompts: {
    id: string;
    prompt: string;
    kind: string;
    coachAnswer: string;
    ready: boolean;
    note: string;
    sourceBullet?: { title: string; employer: string; bullet: string } | null;
  }[];
  facts: { skills: string[]; employers: string[]; titles: string[]; knownNumbers: string[] };
  reminders: string[];
  turns: {
    promptId: string;
    prompt: string;
    kind: string;
    answer: string;
    mode: string;
    feedback: VoiceFeedback | null;
    answeredAt: number | null;
  }[];
  summary: { answered: number; total: number; averageScore: number; inventedMetricFlags: number; status: string };
};

export function InterviewPage() {
  const { data, setError } = useAccount();
  const eligible = (data?.applications || []).filter((item) =>
    ["Ready", "Applied", "Responded", "Interview", "Offer"].includes(item.status),
  );
  const priority = [...eligible].sort((a, b) => {
    const rank = (status: string) => ({ Interview: 0, Offer: 1, Responded: 2, Applied: 3, Ready: 4 }[status] ?? 9);
    return rank(a.status) - rank(b.status);
  });
  const [selected, setSelected] = useState("");
  const [mode, setMode] = useState<"prep" | "voice">("prep");
  useEffect(() => {
    if (!priority.length) {
      setSelected("");
      return;
    }
    setSelected((current) => (current && priority.some((item) => item.id === current) ? current : priority[0].id));
  }, [data?.applications]);

  return (
    <Gate feature="job_browse">
      <div className="account-page">
        <header className="account-head">
          <div>
            <p className="eyebrow">Interview prep</p>
            <h1>Prepare</h1>
            <p className="lede">STAR drafts, talking points, and voice practice from resume bullets. Metrics you cannot verify stay blank.</p>
          </div>
        </header>
        {!priority.length ? (
          <section className="account-card">
            <h2>No interview-ready applications yet</h2>
            <p className="lede">Prep unlocks for Ready, Applied, Responded, Interview, and Offer rows in your tracker.</p>
            <Link className="btn btn-primary btn-sm" to="/account/applications">Open tracker</Link>
          </section>
        ) : (
          <>
            <section className="account-card">
              <h2>Choose an application</h2>
              <div className="interview-pick">
                {priority.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={selected === item.id ? "on" : ""}
                    onClick={() => setSelected(item.id)}
                  >
                    <strong>{item.title}</strong>
                    <span className="role">{item.company} · {item.status} · {item.match}%</span>
                  </button>
                ))}
              </div>
              <div className="job-actions" style={{ justifyContent: "flex-start", marginTop: 12 }}>
                <button className={`btn btn-sm ${mode === "prep" ? "btn-primary" : "btn-ghost"}`} type="button" onClick={() => setMode("prep")}>Written prep</button>
                <button className={`btn btn-sm ${mode === "voice" ? "btn-primary" : "btn-ghost"}`} type="button" onClick={() => setMode("voice")}>Voice practice</button>
              </div>
            </section>
            {selected && mode === "prep" ? (
              <InterviewPrepPanel
                applicationId={selected}
                defaultOpen
                onError={(message) => setError(message)}
              />
            ) : null}
            {selected && mode === "voice" ? (
              <VoicePracticePanel
                applicationId={selected}
                onError={(message) => setError(message)}
              />
            ) : null}
          </>
        )}
      </div>
    </Gate>
  );
}

function InterviewPrepPanel({
  applicationId,
  defaultOpen = false,
  onError,
}: {
  applicationId: string;
  defaultOpen?: boolean;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [prep, setPrep] = useState<InterviewPrep | null>(null);
  const [copied, setCopied] = useState("");

  async function load() {
    const data = await api<{ prep: InterviewPrep }>(`/api/applications/${applicationId}/interview-prep`);
    setPrep(data.prep);
  }

  useEffect(() => {
    if (defaultOpen) void load().catch((err: Error) => onError(err.message));
  }, [applicationId, defaultOpen, onError]);

  async function copyText(label: string, value: string) {
    if (!value.trim()) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied((current) => (current === label ? "" : current)), 1600);
    } catch {
      onError("Clipboard access was blocked.");
    }
  }

  return (
    <div className="interview-prep">
      {!defaultOpen ? (
        <button
          className="text-btn"
          type="button"
          onClick={() => {
            const next = !open;
            setOpen(next);
            if (next) void load().catch((err: Error) => onError(err.message));
          }}
        >
          {open ? "Hide interview prep" : "Interview prep"}
        </button>
      ) : null}
      {(open || defaultOpen) ? (
        <section className="account-card interview-prep-panel">
          {!prep ? <p className="role">Loading prep…</p> : (
            <>
              <header className="account-head" style={{ marginBottom: 8 }}>
                <div>
                  <h2>{prep.title}</h2>
                  <p className="role">{prep.company}{prep.score != null ? ` · ${prep.score}% match` : ""}</p>
                </div>
                {prep.listingUrl ? <a className="btn btn-ghost btn-sm" href={prep.listingUrl} target="_blank" rel="noreferrer">Open listing</a> : null}
              </header>
              <p className="lede">Matched: {(prep.briefing.matched || []).join(", ") || "limited overlap"}.{(prep.briefing.missing || []).length ? ` Gaps to discuss honestly: ${prep.briefing.missing.join(", ")}.` : ""}</p>
              {prep.briefing.signals.length ? (
                <>
                  <h3>From the listing</h3>
                  <ul className="interview-signals">
                    {prep.briefing.signals.map((line) => <li key={line}>{line}</li>)}
                  </ul>
                </>
              ) : null}
              <h3>Practice prompts</h3>
              {prep.prompts.map((item) => (
                <div className="apply-kit-row" key={item.id}>
                  <div>
                    <strong>{item.prompt}</strong>
                    <p className="role">{item.answer || item.note}</p>
                    {item.note && item.answer ? <p className="role">{item.note}</p> : null}
                  </div>
                  <button className="text-btn" type="button" disabled={!item.answer} onClick={() => void copyText(item.id, item.answer)}>
                    {copied === item.id ? "Copied" : "Copy"}
                  </button>
                </div>
              ))}
              <h3>Talking points</h3>
              {prep.talkingPoints.length ? prep.talkingPoints.map((item) => (
                <div className="apply-kit-row" key={item.skill}>
                  <div>
                    <strong>{item.skill}</strong>
                    <p className="role">{item.detail}</p>
                  </div>
                  <button className="text-btn" type="button" disabled={!item.ready} onClick={() => void copyText(item.skill, item.detail)}>
                    {copied === item.skill ? "Copied" : "Copy"}
                  </button>
                </div>
              )) : <p className="role">No matched skills to rehearse yet.</p>}
              <h3>Ask them</h3>
              <ul className="interview-signals">
                {prep.askEmployer.map((question) => <li key={question}>{question}</li>)}
              </ul>
              <h3>Reminders</h3>
              <ul className="interview-signals">
                {prep.reminders.map((line) => <li key={line}>{line}</li>)}
              </ul>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}

function VoicePracticePanel({
  applicationId,
  onError,
}: {
  applicationId: string;
  onError: (message: string) => void;
}) {
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    setSession(null);
    setIndex(0);
    setAnswer("");
    setListening(false);
    setSpeaking(false);
  }, [applicationId]);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
  }, []);

  async function startSession() {
    setBusy(true);
    try {
      const data = await api<{ session: VoiceSession }>(`/api/applications/${applicationId}/voice-practice`, {
        method: "POST",
        body: "{}",
      });
      setSession(data.session);
      setIndex(0);
      setAnswer("");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not start voice practice.");
    } finally {
      setBusy(false);
    }
  }

  const turn = session?.turns[index] || null;
  const prompt = session?.prompts[index] || null;

  function speakPrompt() {
    if (!prompt?.prompt || !window.speechSynthesis) {
      onError("Speech synthesis is not available in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(prompt.prompt);
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
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
      onError("Speech recognition is not available. Type your answer instead.");
      return;
    }
    stopListening();
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i += 1) {
        text += event.results[i][0].transcript;
      }
      setAnswer(text.trim());
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

  async function submitAnswer(mode: "typed" | "speech") {
    if (!session || !prompt) return;
    setBusy(true);
    stopListening();
    try {
      const data = await api<{ session: VoiceSession }>(`/api/voice-practice/${session.id}/answer`, {
        method: "POST",
        body: JSON.stringify({ promptId: prompt.id, answer, mode }),
      });
      setSession(data.session);
      setAnswer(data.session.turns[index]?.answer || answer);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not score the answer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="account-card interview-prep-panel">
      <header className="account-head" style={{ marginBottom: 8 }}>
        <div>
          <h2>Voice practice</h2>
          <p className="lede">Hear each prompt, answer by mic or keyboard, and get coaching that only trusts resume facts.</p>
        </div>
        {!session ? (
          <button className="btn btn-primary btn-sm" type="button" disabled={busy} onClick={() => void startSession()}>
            {busy ? "Starting…" : "Start session"}
          </button>
        ) : null}
      </header>
      {!session ? (
        <p className="role">Start a session to rehearse the same prompts as written prep, out loud.</p>
      ) : (
        <>
          <p className="role">
            {session.title} · {session.company} · {session.summary.answered}/{session.summary.total} answered
            {session.summary.averageScore ? ` · avg ${session.summary.averageScore}` : ""}
            {session.summary.inventedMetricFlags ? ` · ${session.summary.inventedMetricFlags} invented-metric flag(s)` : ""}
          </p>
          {prompt && turn ? (
            <div className="voice-practice">
              <div className="voice-prompt">
                <p className="eyebrow">Question {index + 1} of {session.prompts.length}</p>
                <h3>{prompt.prompt}</h3>
                <div className="job-actions" style={{ justifyContent: "flex-start" }}>
                  <button className="btn btn-ghost btn-sm" type="button" onClick={speakPrompt} disabled={speaking}>
                    {speaking ? "Speaking…" : "Hear question"}
                  </button>
                  {listening ? (
                    <button className="btn btn-ghost btn-sm" type="button" onClick={stopListening}>Stop mic</button>
                  ) : (
                    <button className="btn btn-ghost btn-sm" type="button" onClick={startListening}>Use mic</button>
                  )}
                </div>
              </div>
              <label className="field">
                <span>Your answer {listening ? "(listening…)" : turn.mode ? `(${turn.mode})` : ""}</span>
                <textarea
                  rows={5}
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  placeholder="Speak or type a STAR answer from verified resume facts."
                />
              </label>
              <div className="job-actions" style={{ justifyContent: "flex-start" }}>
                <button className="btn btn-primary btn-sm" type="button" disabled={busy || !answer.trim()} onClick={() => void submitAnswer(listening || turn.mode === "speech" ? "speech" : "typed")}>
                  {busy ? "Scoring…" : "Score answer"}
                </button>
                <button className="btn btn-ghost btn-sm" type="button" disabled={index <= 0} onClick={() => { setIndex((value) => Math.max(0, value - 1)); setAnswer(session.turns[Math.max(0, index - 1)]?.answer || ""); }}>
                  Previous
                </button>
                <button className="btn btn-ghost btn-sm" type="button" disabled={index >= session.prompts.length - 1} onClick={() => { setIndex((value) => Math.min(session.prompts.length - 1, value + 1)); setAnswer(session.turns[Math.min(session.prompts.length - 1, index + 1)]?.answer || ""); }}>
                  Next
                </button>
                <button className="btn btn-ghost btn-sm" type="button" disabled={busy} onClick={() => void startSession()}>New session</button>
              </div>
              {turn.feedback ? (
                <div className="voice-feedback">
                  <p className="role"><strong>{turn.feedback.label}</strong> · score {turn.feedback.score}</p>
                  <ul className="interview-signals">
                    {turn.feedback.notes.map((note) => <li key={note}>{note}</li>)}
                  </ul>
                  <p className="lede">{turn.feedback.suggestion}</p>
                </div>
              ) : null}
              {prompt.coachAnswer ? <p className="role">Coach draft (facts only): {prompt.coachAnswer}</p> : null}
            </div>
          ) : null}
          <ul className="interview-signals">
            {session.reminders.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </>
      )}
    </section>
  );
}

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

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <p className="stat account-tile">
      <span className="tile-mark" aria-hidden="true">{label.slice(0, 1)}</span>
      <strong>{value}</strong>
      <span>{label}</span>
    </p>
  );
}

export function ProfilePage() {
  const { user, refresh } = useApp();
  const { data, reload, setMessage, setError } = useAccount();
  const [editing, setEditing] = useState(false);
  if (!data) return <p className="lede">Loading profile…</p>;
  if (!data.profile) return <Gate />;
  return (
    <Gate>
      <ProfileView
        userName={user?.name || ""}
        email={user?.email || ""}
        phone={user?.phone || ""}
        profile={data.profile}
        canEnhance={Boolean(data.features.image_enhance)}
        editing={editing}
        setEditing={setEditing}
        onSaved={() => {
          setEditing(false);
          setMessage("Profile saved.");
          void reload();
          void refresh();
        }}
        onError={setError}
      />
    </Gate>
  );
}

function ProfileView({
  userName, email, phone, profile, canEnhance, editing, setEditing, onSaved, onError,
}: {
  userName: string;
  email: string;
  phone: string;
  profile: NonNullable<AccountData["profile"]>;
  canEnhance: boolean;
  editing: boolean;
  setEditing: (value: boolean) => void;
  onSaved: () => void;
  onError: (value: string) => void;
}) {
  const [name, setName] = useState(userName);
  const [nextPhone, setNextPhone] = useState(phone);
  const [headline, setHeadline] = useState(profile.headline);
  const [summary, setSummary] = useState(profile.summary);
  const [skills, setSkills] = useState(profile.skills.join(", "));
  const [education, setEducation] = useState(profile.education.join("\n"));
  const [city, setCity] = useState(profile.city);
  const [address, setAddress] = useState(profile.address);
  const [salary, setSalary] = useState(profile.preferences.salary || "");
  const [locations, setLocations] = useState(profile.preferences.locations || "");
  const [workArrangement, setWorkArrangement] = useState(profile.preferences.workArrangement || "");
  const [workAuthorization, setWorkAuthorization] = useState(profile.preferences.workAuthorization || "");
  const [shareContact, setShareContact] = useState(profile.shareContact);
  const [employment, setEmployment] = useState(profile.employment);
  const [photo, setPhoto] = useState(profile.photoUrl);
  const [error, setLocalError] = useState("");

  async function save(event: FormEvent) {
    event.preventDefault();
    setLocalError("");
    try {
      await api("/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          name, phone: nextPhone, headline, summary, city, address, salary, locations, workArrangement, workAuthorization, shareContact,
          slug: profile.slug,
          skills: skills.split(",").map((item) => item.trim()).filter(Boolean),
          education: education.split("\n").map((item) => item.trim()).filter(Boolean),
          employment,
        }),
      });
      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save.";
      setLocalError(message);
      onError(message);
    }
  }

  return (
    <form className="account-page" onSubmit={save}>
      <header className="account-head">
        <div>
          <p className="eyebrow">Profile</p>
          <h1>{name}</h1>
          <p className="lede">{headline || "Add a headline so employers see your focus."}</p>
        </div>
        <button className="btn btn-ghost" type="button" onClick={() => setEditing(!editing)}>{editing ? "Close editor" : "Edit profile"}</button>
      </header>
      {error ? <p className="form-error">{error}</p> : null}
      <section className="account-card identity-card">
        {photo ? <img src={photo} alt="" /> : <span className="resume-fallback">{name.slice(0, 1)}</span>}
        <div>
          <h2>{headline || "Headline"}</h2>
          <p>{[email, nextPhone, city].filter(Boolean).join(" · ")}</p>
          {editing ? (
            <div className="profile-photo-row">
              <label className="btn btn-ghost btn-sm">
                Photo
                <input type="file" accept="image/*" hidden onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const body = new FormData();
                  body.append("photo", file);
                  void api<{ photoUrl: string }>("/api/profile/photo", { method: "POST", body }).then((result) => setPhoto(result.photoUrl));
                }} />
              </label>
              <button className="btn btn-ghost btn-sm" type="button" disabled={!canEnhance || !photo} onClick={() => void api<{ photoUrl: string }>("/api/profile/photo/enhance", { method: "POST" }).then((result) => setPhoto(result.photoUrl)).catch((err: Error) => setLocalError(err.message))}>Enhance</button>
            </div>
          ) : null}
        </div>
      </section>
      {editing ? (
        <section className="account-card account-form">
          <label className="field"><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="field"><span>Headline</span><input value={headline} onChange={(event) => setHeadline(event.target.value)} /></label>
          <label className="field"><span>Phone</span><input value={nextPhone} onChange={(event) => setNextPhone(event.target.value)} /></label>
          <label className="field"><span>City</span><input value={city} onChange={(event) => setCity(event.target.value)} /></label>
          <label className="field"><span>Address</span><input value={address} onChange={(event) => setAddress(event.target.value)} /></label>
          <label className="field"><span>Summary</span><textarea rows={4} value={summary} onChange={(event) => setSummary(event.target.value)} /></label>
          <label className="field"><span>Skills</span><input value={skills} onChange={(event) => setSkills(event.target.value)} /></label>
          <label className="field"><span>Education</span><textarea rows={3} value={education} onChange={(event) => setEducation(event.target.value)} /></label>
        </section>
      ) : (
        <>
          <section className="account-card">
            <h2>Summary</h2>
            <p>{summary || "No summary yet."}</p>
          </section>
          <section className="account-card">
            <h2>Skills</h2>
            <div className="chips">{profile.skills.map((skill) => <span className="chip" key={skill}>{skill}</span>)}</div>
          </section>
        </>
      )}
      <section className="account-card">
        <h2>Experience</h2>
        {employment.map((job, index) => (
          <article className="experience-block" key={`${job.title}-${index}`}>
            {editing ? (
              <>
                <label className="field"><span>Title</span><input value={job.title} onChange={(event) => setEmployment((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, title: event.target.value } : row))} /></label>
                <label className="field"><span>Employer</span><input value={job.employer} onChange={(event) => setEmployment((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, employer: event.target.value } : row))} /></label>
                <label className="field"><span>Bullets</span><textarea rows={3} value={(job.bullets || []).join("\n")} onChange={(event) => setEmployment((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, bullets: event.target.value.split("\n").filter(Boolean) } : row))} /></label>
              </>
            ) : (
              <>
                <h3>{job.title}</h3>
                <p className="role">{job.employer}</p>
                <ul>{(job.bullets || []).map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
              </>
            )}
          </article>
        ))}
      </section>
      <section className="account-card">
        <h2>Search preferences</h2>
        {editing ? (
          <>
            <label className="field"><span>Target salary</span><input value={salary} onChange={(event) => setSalary(event.target.value)} /></label>
            <label className="field"><span>Locations</span><input value={locations} onChange={(event) => setLocations(event.target.value)} /></label>
            <label className="field"><span>Work arrangement</span><input value={workArrangement} onChange={(event) => setWorkArrangement(event.target.value)} /></label>
            <label className="field"><span>Work authorization</span><input value={workAuthorization} onChange={(event) => setWorkAuthorization(event.target.value)} /></label>
            <label className="check-row"><input type="checkbox" checked={shareContact} onChange={(event) => setShareContact(event.target.checked)} /> Show email and phone on the public resume</label>
          </>
        ) : (
          <dl className="detail-list">
            <div><dt>Salary</dt><dd>{salary || "Not set"}</dd></div>
            <div><dt>Locations</dt><dd>{locations || "Not set"}</dd></div>
            <div><dt>Arrangement</dt><dd>{workArrangement || "Not set"}</dd></div>
            <div><dt>Authorization</dt><dd>{workAuthorization || "Not set"}</dd></div>
          </dl>
        )}
      </section>
      {editing ? <button className="btn btn-primary" type="submit">Save profile</button> : null}
    </form>
  );
}

export function ResumePage() {
  const { data, reload, setError, setMessage } = useAccount();
  const [selected, setSelected] = useState<string[]>([]);
  if (!data) return null;
  return (
    <Gate feature="resume_review">
      <div className="account-page">
        <header className="account-head">
          <div>
            <p className="eyebrow">Resume</p>
            <h1>Review and versions</h1>
            <p className="lede">Feedback stays here. A rewrite you accept becomes a new version. Your public resume does not change until you choose one.</p>
            {data.reviewQuota && !data.reviewQuota.unlimited ? (
              <p className="role">Resume reviews this week: {data.reviewQuota.used} used, {data.reviewQuota.remaining} left on {data.plan.name}.</p>
            ) : null}
          </div>
          <button className="btn btn-primary" type="button" onClick={() => void api("/api/resume/review", { method: "POST" }).then(reload).catch((err: Error) => setError(err.message))}>Analyze resume</button>
        </header>
        <div className="account-split">
          <section className="account-card">
            <h2>{data.review ? `Rating ${data.review.rating}` : "No review yet"}</h2>
            {data.review ? (
              <>
                {data.review.feedback.map((line) => <p key={line}>{line}</p>)}
                {data.review.recommendations.map((item) => (
                  <label className="check-row" key={item.id}>
                    <input type="checkbox" disabled={item.kind !== "rewrite"} checked={selected.includes(item.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} />
                    <span><strong>{item.title}</strong><br />{item.detail}</span>
                  </label>
                ))}
                <button className="btn btn-primary btn-sm" type="button" disabled={!data.features.resume_upscale || !selected.length} onClick={() => void api("/api/resume/apply", { method: "POST", body: JSON.stringify({ reviewId: data.review?.id, recommendationIds: selected }) }).then(() => { setSelected([]); setMessage("New version saved."); return reload(); }).catch((err: Error) => setError(err.message))}>
                  {data.features.resume_upscale ? "Create version from selected" : "Upscale is not on this plan"}
                </button>
              </>
            ) : <p>Run an analysis to see what to improve.</p>}
          </section>
          <section className="account-card">
            <h2>Versions</h2>
            {data.versions.map((version) => (
              <article key={version.id} className="version-mini">
                <strong>{version.label}</strong>
                <p className="role">{version.active ? "Public resume" : version.kind}</p>
                {!version.active ? <button className="text-btn" type="button" onClick={() => void api(`/api/resume/versions/${version.id}/activate`, { method: "POST" }).then(() => { setMessage("Public resume updated."); return reload(); })}>Use this version</button> : null}
              </article>
            ))}
          </section>
        </div>
      </div>
    </Gate>
  );
}

export function TemplatesPage() {
  const { user } = useApp();
  const { data, reload, setError, setMessage } = useAccount();
  if (!data) return <p className="lede">Loading templates…</p>;
  if (!data.profile || !user) return <Gate feature="public_profile" />;
  const preview: ResumeView = {
    name: user.name,
    headline: data.profile.headline,
    summary: data.profile.summary,
    skills: data.profile.skills,
    employment: data.profile.employment,
    education: data.profile.education,
    photoUrl: data.profile.photoUrl,
    city: data.profile.city,
    email: data.profile.shareContact ? user.email : "",
    phone: data.profile.shareContact ? user.phone || "" : "",
    template: data.template,
  };
  return (
    <Gate feature="public_profile">
      <div className="account-page">
        <header className="account-head">
          <div>
            <p className="eyebrow">Templates</p>
            <h1>Public resume design</h1>
            <p className="lede">Your plan includes {data.templateLimit} of {data.templates.length} designs. The one you select is what people see at your link.</p>
          </div>
          {data.profile.slug ? <Link className="btn btn-ghost" to={`/resume/${data.profile.slug}`}>Open public page</Link> : null}
        </header>
        <div className="template-grid">
          {data.templates.map((item, index) => {
            const locked = index >= data.templateLimit;
            const active = item.id === data.template;
            return (
              <button
                key={item.id}
                type="button"
                className={active ? "template-card on" : "template-card"}
                disabled={locked}
                onClick={() => void api("/api/account/template", { method: "PUT", body: JSON.stringify({ template: item.id }) }).then(() => { setMessage(`${item.name} is now your public design.`); return reload(); }).catch((err: Error) => setError(err.message))}
              >
                <span className={`template-swatch swatch-${item.id}`} />
                <strong>{item.name}</strong>
                <span>{locked ? "Higher plan" : item.detail}</span>
              </button>
            );
          })}
        </div>
        <div className="template-preview">
          <ResumeSheet resume={preview} />
        </div>
      </div>
    </Gate>
  );
}

export function InvitesPage() {
  const { setError, setMessage, reload } = useAccount();
  const [invites, setInvites] = useState<{
    id: string;
    status: string;
    message: string;
    overlap: { score: number; matched: string[]; missing: string[] };
    posting: {
      id: string;
      title: string;
      company: string;
      location: string;
      description: string;
      skills: string[];
      jobId: string;
      applyUrl: string;
    } | null;
  }[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const data = await api<{ invites: typeof invites }>("/api/invites");
    setInvites(data.invites);
    setLoaded(true);
  }

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
  }, [setError]);

  async function respond(inviteId: string, status: "viewed" | "accepted" | "declined") {
    try {
      const data = await api<{ invite: (typeof invites)[number]; applicationId?: string }>(`/api/invites/${inviteId}/respond`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      setInvites((current) => current.map((item) => (item.id === inviteId ? { ...item, ...data.invite } : item)));
      if (status === "accepted") {
        setMessage(data.applicationId ? "Invite accepted and added to your tracker." : "Invite accepted.");
        await reload();
      } else if (status === "declined") {
        setMessage("Invite declined.");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update invite.");
    }
  }

  return (
    <Gate feature="job_browse">
      <div className="account-page">
        <header className="account-head">
          <div>
            <p className="eyebrow">Inbound</p>
            <h1>Employer invites</h1>
            <p className="lede">Employers who found your public profile can invite you to open roles. Accepting adds the role to your tracker.</p>
          </div>
        </header>
        {!loaded ? <p className="lede">Loading invites…</p> : null}
        {loaded && !invites.length ? (
          <section className="account-card">
            <h2>No invites yet</h2>
            <p className="lede">Keep a public resume link on if you want employers to reach you.</p>
            <Link className="btn btn-primary btn-sm" to="/account/settings">Open settings</Link>
          </section>
        ) : null}
        {invites.map((invite) => (
          <article className="account-card" key={invite.id}>
            <h2>{invite.posting?.title || "Role"}</h2>
            <p className="role">
              {invite.posting?.company || "Employer"}
              {invite.posting?.location ? ` · ${invite.posting.location}` : ""}
              {` · ${invite.status}`}
              {invite.overlap?.score != null ? ` · ${invite.overlap.score}% skill overlap` : ""}
            </p>
            {invite.message ? <p>{invite.message}</p> : null}
            {(invite.overlap?.matched || []).length ? (
              <p className="role">Matched: {invite.overlap.matched.join(", ")}</p>
            ) : null}
            {(invite.overlap?.missing || []).length ? (
              <p className="role">Gaps called out honestly: {invite.overlap.missing.join(", ")}</p>
            ) : null}
            <div className="job-actions" style={{ justifyContent: "flex-start" }}>
              {invite.status === "pending" ? (
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => void respond(invite.id, "viewed")}>Mark viewed</button>
              ) : null}
              {["pending", "viewed"].includes(invite.status) ? (
                <>
                  <button className="btn btn-primary btn-sm" type="button" onClick={() => void respond(invite.id, "accepted")}>Accept</button>
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => void respond(invite.id, "declined")}>Decline</button>
                </>
              ) : null}
              {invite.posting?.jobId ? <Link className="btn btn-ghost btn-sm" to="/account/jobs">Browse jobs</Link> : null}
            </div>
          </article>
        ))}
      </div>
    </Gate>
  );
}

export function JobsPage() {
  const { data, reload, setError, setMessage } = useAccount();
  const [pasteText, setPasteText] = useState("");
  const [pasteUrl, setPasteUrl] = useState("");
  const [busy, setBusy] = useState(false);
  if (!data) return null;

  async function importJob(action: "" | "prepare" | "track") {
    setBusy(true);
    try {
      await api("/api/jobs/paste", {
        method: "POST",
        body: JSON.stringify({ text: pasteText, url: pasteUrl, action }),
      });
      setPasteText("");
      setPasteUrl("");
      setMessage(action === "prepare" ? "Job imported and prepared." : action === "track" ? "Job imported and tracked." : "Job imported.");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import that job.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Gate feature="job_browse">
      <div className="account-page">
        <header className="account-head">
          <div>
            <p className="eyebrow">Jobs</p>
            <h1>Tailored to your resume</h1>
            <p className="lede">{data.stats.available} roles in this list. {data.stats.recommended} are strong matches.</p>
            {data.matchQuota && !data.matchQuota.unlimited ? (
              <p className="role">Match explanations this week: {data.matchQuota.used} used, {data.matchQuota.remaining} left on {data.plan.name}.</p>
            ) : null}
          </div>
        </header>
        <section className="account-card">
          <h2>Paste a job</h2>
          <p className="lede">Drop in a listing URL or the full description. We extract requirements and score it against your resume.</p>
          <label className="field"><span>Listing URL</span><input value={pasteUrl} onChange={(event) => setPasteUrl(event.target.value)} placeholder="https://..." /></label>
          <label className="field"><span>Or paste description</span><textarea rows={5} value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder={"Title\nCompany\nRequirements..."} /></label>
          <div className="job-actions">
            <button className="btn btn-primary btn-sm" type="button" disabled={busy || (!pasteText.trim() && !pasteUrl.trim())} onClick={() => void importJob("")}>Import</button>
            {data.features.manual_apply ? (
              <>
                <button className="btn btn-ghost btn-sm" type="button" disabled={busy || (!pasteText.trim() && !pasteUrl.trim())} onClick={() => void importJob("prepare")}>Import & Assisted Apply</button>
                <button className="btn btn-ghost btn-sm" type="button" disabled={busy || (!pasteText.trim() && !pasteUrl.trim())} onClick={() => void importJob("track")}>Import & track</button>
              </>
            ) : null}
          </div>
        </section>
        {data.jobs.map((job) => (
          <article className="account-card job-card" key={job.id}>
            <div>
              <p className="role">{job.category} · {job.verification}</p>
              <h2>{job.title}</h2>
              <p>{job.applyCompany || job.company} · {job.location || job.remoteType}</p>
              {job.viaCompany ? <p className="role">Listed by {job.viaCompany}{job.sourceName ? ` on ${job.sourceName}` : ""}. This application goes to {job.applyCompany}.</p> : null}
              <p className="lede">{job.description}</p>
              {job.explanation ? <p className="role">{job.label ? `${job.label}: ` : ""}{job.explanation}</p> : null}
              {job.explanationLocked ? <p className="role">Explanation locked — weekly Free/Starter quota reached. Upgrade for more.</p> : null}
              <p className="role">{job.explanationLocked ? "Details hidden until an explanation slot is available" : (job.matched.join(", ") || "Limited skill overlap")}{!job.explanationLocked && job.missing.length ? ` · Gap: ${job.missing.join(", ")}` : ""}</p>
            </div>
            <div className="job-side">
              <span className="match-badge">{job.score}%</span>
              {job.label ? <p className="role">{job.label}</p> : null}
              {job.applied ? <p className="role">In your tracker</p> : (
                <div className="job-actions">
                  <button className="btn btn-primary btn-sm" type="button" disabled={!data.features.manual_apply} onClick={() => void api("/api/applications", { method: "POST", body: JSON.stringify({ jobId: job.id, action: "prepare" }) }).then(reload).catch((err: Error) => setError(err.message))}>
                    {data.features.manual_apply ? "Assisted Apply" : "Upgrade to apply"}
                  </button>
                  {data.features.manual_apply ? (
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => void api("/api/applications", { method: "POST", body: JSON.stringify({ jobId: job.id, action: "track" }) }).then(reload).catch((err: Error) => setError(err.message))}>
                      Track
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </Gate>
  );
}

export function ApplicationsPage() {
  const { data, reload, setMessage, setError } = useAccount();
  if (!data) return null;
  const statuses = data.statuses?.length ? data.statuses : ["Found", "Reviewed", "Skipped", "Resume preparing", "Ready", "Review required", "Applied", "Responded", "Interview", "Offer", "Rejected", "Withdrawn"];
  return (
    <Gate>
      <div className="account-page">
        <header className="account-head">
          <div>
            <p className="eyebrow">Applications</p>
            <h1>Tracker</h1>
            <p className="lede">
              {data.stats.tracked ?? data.stats.applied} in your tracker. {data.stats.ready || 0} ready. {data.stats.reviewRequired || 0} need review.
              Assisted Apply is the default — review the kit, paste into the employer form, then mark Applied.
              {typeof data.stats.kitCompletionRate === "number"
                ? ` Kit completion ${data.stats.kitCompletionRate}% (${data.stats.kitCompleted || 0}/${data.stats.kitOpened || 0}).`
                : ""}
            </p>
          </div>
        </header>
        {data.features.auto_apply ? (
          <AutoApply
            enabled={data.autoApply}
            minMatch={data.autoMin}
            dailyCap={data.autoDailyCap || 5}
            capUsed={data.autoCapUsed || 0}
            excludeCompanies={data.profile?.preferences?.excludeCompanies || ""}
            excludeKeywords={data.profile?.preferences?.excludeKeywords || ""}
            onDone={() => { setMessage("Auto apply updated."); void reload(); }}
          />
        ) : (
          <section className="account-card">
            <h2>Review-first Assisted Apply</h2>
            <p>Assisted Apply prepares a tailored resume and copy kit. You review everything, submit on the employer site, then mark Applied here. Email submit stays available only when readiness clears.</p>
          </section>
        )}
        {data.applications.map((item, index) => {
          const assistedOpen =
            index === data.applications.findIndex((row) =>
              ["Ready", "Review required", "Resume preparing"].includes(row.status),
            );
          return (
          <article className="account-card" key={item.id}>
            <div className="job-card" style={{ padding: 0, boxShadow: "none", background: "transparent" }}>
              <div>
                <h2>{item.title}</h2>
                <p className="role">{item.company} · {item.mode} · {item.match}% match · {item.status}</p>
                {item.versionLabel ? <p className="role">Pinned resume: {item.versionLabel}</p> : null}
                {item.viaCompany ? <p className="role">Found through {item.viaCompany}{item.sourceName ? ` on ${item.sourceName}` : ""}</p> : null}
                {item.delivery ? <p className="role">{item.delivery}</p> : null}
                {item.targetUrl ? <a href={item.targetUrl} target="_blank" rel="noreferrer">Open employer listing</a> : null}
              </div>
              <div className="job-side">
                {["Ready", "Review required", "Resume preparing", "Found"].includes(item.status) && data.features.manual_apply && data.versions.length ? (
                  <select
                    aria-label="Pinned resume version"
                    value={item.versionId || ""}
                    onChange={(event) =>
                      void api(`/api/applications/${item.id}/version`, {
                        method: "PUT",
                        body: JSON.stringify({ versionId: event.target.value }),
                      })
                        .then(() => { setMessage("Resume version pinned."); return reload(); })
                        .catch((err: Error) => setError(err.message))
                    }
                  >
                    <option value="" disabled>Pin resume version</option>
                    {data.versions.map((version) => (
                      <option key={version.id} value={version.id}>{version.label}</option>
                    ))}
                  </select>
                ) : null}
                {["Ready", "Review required", "Resume preparing"].includes(item.status) && data.features.manual_apply ? (
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    onClick={() => void api(`/api/applications/${item.id}/submit`, { method: "POST" }).then(() => { setMessage("Application submitted."); return reload(); }).catch((err: Error) => setError(err.message))}
                  >
                    Email submit
                  </button>
                ) : null}
                <select value={item.status} onChange={(event) => void api(`/api/applications/${item.id}`, { method: "PATCH", body: JSON.stringify({ status: event.target.value }) }).then(reload)}>
                  {statuses.map((status) => <option key={status}>{status}</option>)}
                </select>
              </div>
            </div>
            {["Ready", "Review required", "Resume preparing"].includes(item.status) && data.features.manual_apply ? (
              <BrowserApplyAssistant
                applicationId={item.id}
                defaultOpen={assistedOpen}
                versions={data.versions}
                versionId={item.versionId}
                onDone={() => { setMessage("Marked Applied after Assisted Apply."); void reload(); }}
                onError={(message) => setError(message)}
              />
            ) : null}
            {["Ready", "Applied", "Responded", "Interview", "Offer"].includes(item.status) ? (
              <InterviewPrepPanel
                applicationId={item.id}
                onError={(message) => setError(message)}
              />
            ) : null}
            {(item.questions?.length || ["Ready", "Review required", "Resume preparing", "Found"].includes(item.status)) ? (
              <QuestionDrafts
                applicationId={item.id}
                initial={item.questions || []}
                onSaved={() => { setMessage("Answers saved."); void reload(); }}
                onError={(message) => setError(message)}
              />
            ) : null}
          </article>
          );
        })}
      </div>
    </Gate>
  );
}

type ApplyKit = {
  applicationId: string;
  status: string;
  mode?: string;
  eligible: boolean;
  title: string;
  company: string;
  viaCompany: string;
  listingUrl: string;
  contact: { key: string; label: string; value: string; ready: boolean; note: string }[];
  resumeText: string;
  versionId?: string;
  versionLabel?: string;
  versionPinned?: boolean;
  answers: { id: string; prompt: string; answer: string; kind: string; blankReason: string; hint: string; ready: boolean }[];
  blankCount: number;
  steps: { id: string; title: string; detail: string; ready: boolean }[];
  canComplete: boolean;
  readiness?: {
    state: string;
    matchScore: number;
    resumeAlignment: number;
    questionsComplete: number;
    documentsComplete: number;
    blockers: string[];
  };
  metrics?: {
    opened: number;
    copied: number;
    completed: number;
    completionRate: number;
  };
};

function BrowserApplyAssistant({
  applicationId,
  defaultOpen = false,
  onDone,
  onError,
}: {
  applicationId: string;
  defaultOpen?: boolean;
  versions?: { id: string; label: string }[];
  versionId?: string;
  onDone: () => void;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [kit, setKit] = useState<ApplyKit | null>(null);
  const [copied, setCopied] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (defaultOpen) {
      setOpen(true);
      void load().catch((err: Error) => onError(err.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId, defaultOpen]);

  async function load() {
    const data = await api<{ kit: ApplyKit }>(`/api/applications/${applicationId}/apply-kit`);
    setKit(data.kit);
  }

  async function copyText(label: string, value: string) {
    if (!value.trim()) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied((current) => (current === label ? "" : current)), 1600);
      void api(`/api/applications/${applicationId}/apply-kit/event`, {
        method: "POST",
        body: JSON.stringify({ event: "copied", detail: label }),
      }).catch(() => undefined);
    } catch {
      onError("Clipboard access was blocked. Select and copy the text manually.");
    }
  }

  return (
    <div className="apply-kit">
      <button
        className="btn btn-primary btn-sm"
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) void load().catch((err: Error) => onError(err.message));
        }}
      >
        {open ? "Hide Assisted Apply kit" : "Assisted Apply kit"}
      </button>
      {open ? (
        <div className="apply-kit-panel">
          {!kit ? <p className="role">Loading apply kit…</p> : (
            <>
              <p className="lede">
                Keep this open beside the employer form. Copy contact, resume, and answers — JobPilot never invents values.
                {kit.blankCount ? ` ${kit.blankCount} answer${kit.blankCount === 1 ? "" : "s"} still need you.` : ""}
              </p>
              {kit.versionLabel ? <p className="role">Pinned resume: {kit.versionLabel}</p> : null}
              {kit.readiness ? (
                <p className={kit.readiness.state === "APPLICATION_READY" ? "role" : "form-error"} role="status">
                  {kit.readiness.state === "APPLICATION_READY"
                    ? `Application ready · match ${kit.readiness.matchScore}% · resume alignment ${kit.readiness.resumeAlignment}%`
                    : `User action required · ${(kit.readiness.blockers || []).slice(0, 2).join(" ")}`}
                </p>
              ) : null}
              {kit.metrics ? (
                <p className="role">Kit opens {kit.metrics.opened} · copies {kit.metrics.copied} · completed {kit.metrics.completed}</p>
              ) : null}
              <ol className="apply-kit-steps">
                {kit.steps.map((step) => (
                  <li key={step.id} className={step.ready ? "ready" : "pending"}>
                    <strong>{step.title}</strong>
                    <span>{step.detail}</span>
                  </li>
                ))}
              </ol>
              <div className="job-actions">
                {kit.listingUrl ? (
                  <a className="btn btn-primary btn-sm" href={kit.listingUrl} target="_blank" rel="noreferrer">
                    Open listing
                  </a>
                ) : null}
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  disabled={busy || !kit.canComplete}
                  onClick={() => {
                    setBusy(true);
                    void api(`/api/applications/${applicationId}/apply-kit/complete`, { method: "POST" })
                      .then(onDone)
                      .catch((err: Error) => onError(err.message))
                      .finally(() => setBusy(false));
                  }}
                >
                  I submitted on their site
                </button>
              </div>
              <h3>Contact</h3>
              {kit.contact.map((field) => (
                <div className="apply-kit-row" key={field.key}>
                  <div>
                    <strong>{field.label}</strong>
                    <p className="role">{field.value || field.note || "Empty"}</p>
                  </div>
                  <button className="text-btn" type="button" disabled={!field.value} onClick={() => void copyText(field.label, field.value)}>
                    {copied === field.label ? "Copied" : "Copy"}
                  </button>
                </div>
              ))}
              <h3>Tailored resume</h3>
              <div className="apply-kit-row">
                <p className="role">{kit.resumeText ? `${kit.resumeText.slice(0, 160)}${kit.resumeText.length > 160 ? "…" : ""}` : "No tailored resume yet."}</p>
                <button className="text-btn" type="button" disabled={!kit.resumeText} onClick={() => void copyText("Resume", kit.resumeText)}>
                  {copied === "Resume" ? "Copied" : "Copy all"}
                </button>
              </div>
              {kit.resumeText ? <pre className="apply-kit-resume">{kit.resumeText}</pre> : null}
              <h3>Answers</h3>
              {kit.answers.length ? kit.answers.map((item) => (
                <div className="apply-kit-row" key={item.id}>
                  <div>
                    <strong>{item.prompt}</strong>
                    <p className="role">{item.answer || item.blankReason || item.hint || "Fill this yourself."}</p>
                  </div>
                  <button className="text-btn" type="button" disabled={!item.answer} onClick={() => void copyText(item.id, item.answer)}>
                    {copied === item.id ? "Copied" : "Copy"}
                  </button>
                </div>
              )) : <p className="role">No question drafts for this listing.</p>}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function QuestionDrafts({
  applicationId,
  initial,
  onSaved,
  onError,
}: {
  applicationId: string;
  initial: { id: string; prompt: string; kind: string; answer: string; blankReason?: string; hint?: string }[];
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [questions, setQuestions] = useState(initial);
  useEffect(() => {
    setQuestions(initial);
  }, [initial]);
  if (!questions.length && !open) {
    return null;
  }
  return (
    <div className="question-drafts">
      <button className="text-btn" type="button" onClick={() => setOpen((value) => !value)}>
        {open ? "Hide application answers" : `Application answers (${questions.length})`}
      </button>
      {open ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void api(`/api/applications/${applicationId}/questions`, {
              method: "PUT",
              body: JSON.stringify({ questions }),
            })
              .then(onSaved)
              .catch((err: Error) => onError(err.message));
          }}
        >
          {questions.map((item, index) => (
            <label className="field" key={item.id}>
              <span>{item.prompt}{item.kind === "user" ? " (you fill)" : ""}</span>
              <textarea
                rows={3}
                value={item.answer}
                placeholder={item.blankReason || item.hint || ""}
                onChange={(event) => setQuestions((rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, answer: event.target.value } : row)))}
              />
              {item.blankReason ? <span className="role">{item.blankReason}</span> : null}
              {!item.blankReason && item.hint ? <span className="role">{item.hint}</span> : null}
            </label>
          ))}
          <button className="btn btn-primary btn-sm" type="submit">Save answers</button>
        </form>
      ) : null}
    </div>
  );
}

function AutoApply({
  enabled,
  minMatch,
  dailyCap,
  capUsed,
  excludeCompanies,
  excludeKeywords,
  onDone,
}: {
  enabled: boolean;
  minMatch: number;
  dailyCap: number;
  capUsed: number;
  excludeCompanies: string;
  excludeKeywords: string;
  onDone: () => void;
}) {
  const [on, setOn] = useState(enabled);
  const [min, setMin] = useState(minMatch);
  const [cap, setCap] = useState(dailyCap);
  const [companies, setCompanies] = useState(excludeCompanies);
  const [keywords, setKeywords] = useState(excludeKeywords);
  return (
    <form
      className="account-card"
      onSubmit={(event) => {
        event.preventDefault();
        void api("/api/account/auto-apply", {
          method: "PUT",
          body: JSON.stringify({
            enabled: on,
            minMatch: min,
            dailyCap: cap,
            excludeCompanies: companies,
            excludeKeywords: keywords,
          }),
        })
          .then(() => (on ? api("/api/applications/auto", { method: "POST" }) : undefined))
          .then(onDone);
      }}
    >
      <h2>Autopilot queue</h2>
      <p className="lede">Autopilot never submits on a guess. It queues Ready or Review required rows for you to submit. Used {capUsed} of {cap} today.</p>
      <label className="check-row"><input type="checkbox" checked={on} onChange={(event) => setOn(event.target.checked)} /> Queue matching jobs for review</label>
      <label className="field"><span>Minimum match</span><input type="number" min={50} max={99} value={min} onChange={(event) => setMin(Number(event.target.value))} /></label>
      <label className="field"><span>Daily cap</span><input type="number" min={1} max={25} value={cap} onChange={(event) => setCap(Number(event.target.value))} /></label>
      <label className="field"><span>Exclude companies</span><input value={companies} onChange={(event) => setCompanies(event.target.value)} placeholder="Acme, Staffing Hub" /></label>
      <label className="field"><span>Exclude keywords</span><input value={keywords} onChange={(event) => setKeywords(event.target.value)} placeholder="unpaid, clearance" /></label>
      <button className="btn btn-primary btn-sm" type="submit">{on ? "Save and queue" : "Save manual-only"}</button>
    </form>
  );
}

export function PlanPage() {
  const { refresh } = useApp();
  const { data, reload, setError, setMessage } = useAccount();
  const [params, setParams] = useSearchParams();
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [gatewayId, setGatewayId] = useState("");

  useEffect(() => {
    if (data?.gateways[0] && !gatewayId) setGatewayId(data.gateways[0].id);
  }, [data, gatewayId]);

  useEffect(() => {
    const checkoutId = params.get("checkout_id");
    if (params.get("checkout") === "success" && checkoutId) {
      void api("/api/billing/confirm", { method: "POST", body: JSON.stringify({ checkoutId }) })
        .then(() => refresh())
        .then(reload)
        .then(() => setMessage("Plan updated."))
        .catch((err: Error) => setError(err.message));
      setParams({}, { replace: true });
    }
  }, [params, refresh, reload, setMessage, setError, setParams]);

  if (!data) return null;
  return (
    <div className="account-page">
      <header className="account-head">
        <div>
          <p className="eyebrow">Plan</p>
          <h1>{data.plan.name}</h1>
          <p className="lede">{data.policy.allowUpgrade ? "Upgrades are open." : "Upgrades are closed."} {data.policy.allowDowngrade ? "Downgrades are open." : "Downgrades are closed."} {data.policy.allowProration ? "Unused time is credited." : ""} {data.policy.allowRefund ? "Downgrades record a refund." : ""}</p>
        </div>
      </header>
      <div className="toggle">
        <button type="button" className={cycle === "monthly" ? "on" : ""} onClick={() => setCycle("monthly")}>Monthly</button>
        <button type="button" className={cycle === "yearly" ? "on" : ""} onClick={() => setCycle("yearly")}>Yearly</button>
      </div>
      <label className="field"><span>Payment method</span>
        <select value={gatewayId} onChange={(event) => setGatewayId(event.target.value)}>
          {data.gateways.map((gateway) => <option key={gateway.id} value={gateway.id}>{gateway.name}</option>)}
        </select>
      </label>
      <div className="price-grid">
        {data.plans.map((plan) => (
          <article className="price-card" key={plan.id}>
            <h2>{plan.name}</h2>
            <p className="price"><strong>${((cycle === "yearly" ? plan.yearlyCents : plan.monthlyCents) / 100).toFixed(0)}</strong><span>{cycle === "yearly" ? "/yr" : "/mo"}</span></p>
            <p className="role">{plan.blurb}</p>
            <button className="btn btn-primary btn-block" type="button" disabled={plan.id === data.plan.id} onClick={() => void api<{ url?: string }>("/api/billing/checkout", { method: "POST", body: JSON.stringify({ planId: plan.id, gatewayId, cycle }) }).then((result) => { if (result.url) window.location.href = result.url; else { setMessage("Plan updated."); void refresh(); return reload(); } }).catch((err: Error) => setError(err.message))}>
              {plan.id === data.plan.id ? "Current plan" : `Choose ${plan.name}`}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { user, refresh, notify } = useApp();
  const { data, reload, setMessage, setError } = useAccount();
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  if (!data && !user?.mustChangePassword) return null;
  const link = data?.profile?.slug ? `${window.location.origin}/resume/${data.profile.slug}` : "";
  const needsCurrentPassword = Boolean(user?.provider === "email" && user?.hasPassword);
  return (
    <div className="account-page">
      <header className="account-head">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Account</h1>
          {user?.mustChangePassword ? (
            <p className="lede">Change the bootstrap password before using admin or account tools.</p>
          ) : null}
        </div>
      </header>
      {link ? (
        <section className="account-card">
          <h2>Public link</h2>
          <p className="role">{link}</p>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => void navigator.clipboard.writeText(link).then(() => setMessage("Link copied."))}>Copy link</button>
        </section>
      ) : null}
      {user?.provider === "email" ? (
        <form className="account-card" onSubmit={(event) => {
          event.preventDefault();
          void api<{ ok: boolean; user?: typeof user }>("/api/account/password", { method: "POST", body: JSON.stringify({ current, password }) })
            .then(async (result) => {
              setCurrent("");
              setPassword("");
              setMessage("Password updated.");
              notify("Password updated.");
              await refresh();
              if (result.user && !result.user.mustChangePassword) {
                void reload?.();
              }
            })
            .catch((err: Error) => setError(err.message));
        }}>
          <h2>{user?.mustChangePassword ? "Choose a new password" : "Password"}</h2>
          {needsCurrentPassword || user?.mustChangePassword ? (
            <label className="field"><span>Current password</span><input type="password" value={current} onChange={(event) => setCurrent(event.target.value)} required /></label>
          ) : (
            <p className="role">This account was activated by email. Set a password to sign in with email next time.</p>
          )}
          <label className="field"><span>New password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></label>
          <button className="btn btn-primary btn-sm" type="submit">Update password</button>
        </form>
      ) : null}
      <section className="account-card">
        <h2>Privacy</h2>
        <p className="role">Download a copy of your account data, or permanently delete your account and profile.</p>
        <div className="admin-actions">
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={() => {
              void api("/api/account/export")
                .then((bundle) => {
                  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const anchor = document.createElement("a");
                  anchor.href = url;
                  anchor.download = `jobpilot-export-${user?.id || "account"}.json`;
                  anchor.click();
                  URL.revokeObjectURL(url);
                  setMessage("Export downloaded.");
                })
                .catch((err: Error) => setError(err.message));
            }}
          >
            Export my data
          </button>
        </div>
        <form
          className="danger-zone"
          onSubmit={(event) => {
            event.preventDefault();
            if (!window.confirm("Delete this account permanently? This cannot be undone.")) return;
            void api("/api/account/delete", {
              method: "POST",
              body: JSON.stringify({ confirm: deleteConfirm, password: deletePassword }),
            })
              .then(async () => {
                notify("Account deleted.");
                await refresh();
                navigate("/");
              })
              .catch((err: Error) => setError(err.message));
          }}
        >
          <h3>Delete account</h3>
          <label className="field">
            <span>Type your email to confirm</span>
            <input value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} required />
          </label>
          {user?.provider === "email" ? (
            <label className="field">
              <span>Password</span>
              <input type="password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} />
            </label>
          ) : null}
          <button className="btn btn-ghost btn-sm" type="submit">Delete my account</button>
        </form>
      </section>
      <section className="account-card">
        <h2>Session</h2>
        <p className="role">Signed in as {user?.email}. Plan changes and template access refresh when you save them.</p>
        {data ? <button className="text-btn" type="button" onClick={() => void reload()}>Refresh account</button> : null}
      </section>
    </div>
  );
}
