import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { useApp } from "../context/AppContext";

type EmployerProfile = { companyName: string; website: string; blurb: string };
type Candidate = {
  userId: string;
  name: string;
  headline: string;
  summary: string;
  skills: string[];
  city: string;
  photoUrl: string;
  slug: string;
  resumeUrl: string;
  email: string;
  phone: string;
  saved?: boolean;
};

type PipelineEntry = {
  id: string;
  candidateUserId: string;
  status: string;
  roleTitle: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
  candidate: Candidate;
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
  pipelineId: string;
  roleTitle: string;
  joinCode: string;
  joinPath: string;
  status: string;
  notes: string;
  questions: { id: string; prompt: string; kind: string }[];
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
  candidate: Candidate;
  employerName?: string;
  companyName?: string;
};

const PIPELINE_STATUSES = ["Saved", "Reviewing", "Interviewing", "Offer", "Hired", "Passed"];

export function EmployerShell() {
  const { user, ready, signOut } = useApp();
  const navigate = useNavigate();

  useEffect(() => {
    if (!ready) return;
    if (!user) navigate("/employers", { replace: true });
    else if (user.role !== "employer") navigate(user.role === "admin" ? "/admin" : "/account", { replace: true });
  }, [ready, user, navigate]);

  if (!ready || !user || user.role !== "employer") return null;

  return (
    <div className="account-shell">
      <aside className="account-nav">
        <Link to="/" className="account-brand">JobPilot</Link>
        <nav>
          <NavLink to="/employer" end className={({ isActive }) => (isActive ? "on" : "")}>Candidates</NavLink>
          <NavLink to="/employer/pipeline" className={({ isActive }) => (isActive ? "on" : "")}>Pipeline</NavLink>
          <NavLink to="/employer/postings" className={({ isActive }) => (isActive ? "on" : "")}>Postings</NavLink>
          <NavLink to="/employer/interviews" className={({ isActive }) => (isActive ? "on" : "")}>Interviews</NavLink>
          <NavLink to="/employer/rooms" className={({ isActive }) => (isActive ? "on" : "")}>Rooms</NavLink>
          <NavLink to="/employer/company" className={({ isActive }) => (isActive ? "on" : "")}>Company</NavLink>
        </nav>
        <div className="account-user">
          <span>{(user.name || "?").split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
          <div>
            <strong>{user.name}</strong>
            <p>Employer</p>
          </div>
          <button type="button" onClick={signOut} aria-label="Sign out">Out</button>
        </div>
      </aside>
      <main className="account-main">
        <Outlet />
      </main>
    </div>
  );
}

export function EmployerLandingPage() {
  const { user, ready, refresh } = useApp();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"intro" | "register">("intro");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (ready && user?.role === "employer") navigate("/employer", { replace: true });
  }, [ready, user, navigate]);

  async function register(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api("/api/employer/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password, companyName, website }),
      });
      await refresh();
      navigate("/employer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the employer account.");
    }
  }

  return (
    <div className="container narrow-page">
      <header className="page-hero">
        <p className="eyebrow">For employers</p>
        <h1>Find candidates who already made their profile public.</h1>
        <p className="lede">Search skills and headlines from JobPilot members who opted into a public resume link. Contact details stay hidden unless they chose to share them.</p>
      </header>
      {mode === "intro" ? (
        <section className="account-card">
          <h2>Employer workspace</h2>
          <p className="lede">Create a company account, post open roles, invite candidates, and run multi-party interview rooms.</p>
          <div className="job-actions" style={{ justifyContent: "flex-start" }}>
            <button className="btn btn-primary" type="button" onClick={() => setMode("register")}>Create employer account</button>
            <Link className="btn btn-ghost" to="/signin">Sign in</Link>
          </div>
        </section>
      ) : (
        <form className="account-card" onSubmit={register}>
          <h2>Create employer account</h2>
          {error ? <p className="form-error">{error}</p> : null}
          <div className="admin-grid">
            <label className="field"><span>Your name</span><input value={name} onChange={(event) => setName(event.target.value)} required /></label>
            <label className="field"><span>Work email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label className="field"><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></label>
            <label className="field"><span>Company</span><input value={companyName} onChange={(event) => setCompanyName(event.target.value)} required /></label>
            <label className="field"><span>Website</span><input value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="https://" /></label>
          </div>
          <div className="job-actions" style={{ justifyContent: "flex-start" }}>
            <button className="btn btn-primary" type="submit">Create account</button>
            <button className="btn btn-ghost" type="button" onClick={() => setMode("intro")}>Back</button>
          </div>
        </form>
      )}
    </div>
  );
}

export function EmployerCandidatesPage() {
  const [q, setQ] = useState("");
  const [skill, setSkill] = useState("");
  const [city, setCity] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [savingId, setSavingId] = useState("");

  async function search(event?: FormEvent) {
    event?.preventDefault();
    setError("");
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (skill.trim()) params.set("skill", skill.trim());
    if (city.trim()) params.set("city", city.trim());
    try {
      const data = await api<{ candidates: Candidate[] }>(`/api/employer/candidates?${params.toString()}`);
      setCandidates(data.candidates);
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    }
  }

  useEffect(() => {
    void search();
  }, []);

  async function saveCandidate(person: Candidate) {
    setSavingId(person.userId);
    setError("");
    setMessage("");
    try {
      await api("/api/employer/pipeline", {
        method: "POST",
        body: JSON.stringify({ candidateUserId: person.userId }),
      });
      setCandidates((current) =>
        current.map((item) => (item.userId === person.userId ? { ...item, saved: true } : item)),
      );
      setMessage(`${person.name} saved to your pipeline.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save candidate.");
    } finally {
      setSavingId("");
    }
  }

  return (
    <div className="account-page">
      <header className="account-head">
        <div>
          <p className="eyebrow">Candidates</p>
          <h1>Public profiles</h1>
          <p className="lede">Only members with an active public resume link appear here. Save people into your hiring pipeline.</p>
        </div>
        <Link className="btn btn-ghost btn-sm" to="/employer/pipeline">Open pipeline</Link>
      </header>
      <form className="account-card admin-grid" onSubmit={search}>
        <label className="field"><span>Keywords</span><input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Product, activation…" /></label>
        <label className="field"><span>Skill</span><input value={skill} onChange={(event) => setSkill(event.target.value)} placeholder="SQL" /></label>
        <label className="field"><span>City</span><input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Austin" /></label>
        <button className="btn btn-primary btn-sm" type="submit">Search</button>
      </form>
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="role">{message}</p> : null}
      {!loaded ? <p className="lede">Loading candidates…</p> : null}
      {loaded && !candidates.length ? <section className="account-card"><p className="lede">No public candidates matched that search.</p></section> : null}
      {candidates.map((person) => (
        <article className="account-card" key={person.userId}>
          <div className="job-card" style={{ padding: 0, boxShadow: "none", background: "transparent" }}>
            <div>
              <h2>{person.name}</h2>
              <p className="role">{person.headline || "Member"}{person.city ? ` · ${person.city}` : ""}</p>
              {person.summary ? <p>{person.summary}</p> : null}
              <div className="chips">{person.skills.map((item) => <span className="chip" key={item}>{item}</span>)}</div>
              {(person.email || person.phone) ? <p className="role">{[person.email, person.phone].filter(Boolean).join(" · ")}</p> : <p className="role">Contact hidden by the candidate.</p>}
            </div>
            <div className="job-side">
              <Link className="btn btn-primary btn-sm" to={person.resumeUrl} target="_blank">View resume</Link>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                disabled={person.saved || savingId === person.userId}
                onClick={() => void saveCandidate(person)}
              >
                {person.saved ? "In pipeline" : savingId === person.userId ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function EmployerPipelinePage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<PipelineEntry[]>([]);
  const [summary, setSummary] = useState<{ total: number; active: number; counts: Record<string, number> } | null>(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [startingId, setStartingId] = useState("");
  const [roomStartingId, setRoomStartingId] = useState("");
  const [postings, setPostings] = useState<{ id: string; title: string; status: string }[]>([]);
  const [inviteFor, setInviteFor] = useState("");
  const [invitePostingId, setInvitePostingId] = useState("");

  async function load(status = filter) {
    setError("");
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    try {
      const data = await api<{
        entries: PipelineEntry[];
        summary: { total: number; active: number; counts: Record<string, number> };
      }>(`/api/employer/pipeline?${params.toString()}`);
      setEntries(data.entries);
      setSummary(data.summary);
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load pipeline.");
    }
  }

  useEffect(() => {
    void load();
    void api<{ postings: { id: string; title: string; status: string }[] }>("/api/employer/postings")
      .then((data) => {
        const open = data.postings.filter((item) => item.status === "open");
        setPostings(open);
        if (open[0]) setInvitePostingId(open[0].id);
      })
      .catch(() => undefined);
  }, []);

  async function updateEntry(entry: PipelineEntry, patch: Partial<Pick<PipelineEntry, "status" | "roleTitle" | "notes">>) {
    setError("");
    try {
      const data = await api<{ entry: PipelineEntry }>(`/api/employer/pipeline/${entry.id}`, {
        method: "PUT",
        body: JSON.stringify(patch),
      });
      setEntries((current) => current.map((item) => (item.id === entry.id ? data.entry : item)));
      await load(filter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    }
  }

  async function removeEntry(entry: PipelineEntry) {
    setError("");
    try {
      await api(`/api/employer/pipeline/${entry.id}`, { method: "DELETE" });
      await load(filter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove candidate.");
    }
  }

  async function startVoice(entry: PipelineEntry) {
    setStartingId(entry.id);
    setError("");
    try {
      const data = await api<{ session: VoiceSession }>("/api/employer/voice-sessions", {
        method: "POST",
        body: JSON.stringify({ pipelineId: entry.id, roleTitle: entry.roleTitle }),
      });
      navigate(`/employer/interviews/${data.session.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start voice interview.");
    } finally {
      setStartingId("");
    }
  }

  async function startRoom(entry: PipelineEntry) {
    setRoomStartingId(entry.id);
    setError("");
    try {
      const data = await api<{ room: { id: string; hostPath: string } }>("/api/employer/rooms", {
        method: "POST",
        body: JSON.stringify({
          pipelineId: entry.id,
          roleTitle: entry.roleTitle,
          interviewers: [{ displayName: "Interviewer" }],
        }),
      });
      navigate(`/employer/rooms/${data.room.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open interview room.");
    } finally {
      setRoomStartingId("");
    }
  }

  async function sendInvite(entry: PipelineEntry) {
    if (!invitePostingId) {
      setError("Create an open posting before inviting candidates.");
      return;
    }
    setInviteFor(entry.id);
    setError("");
    setMessage("");
    try {
      await api("/api/employer/invites", {
        method: "POST",
        body: JSON.stringify({
          postingId: invitePostingId,
          candidateUserId: entry.candidateUserId,
          pipelineId: entry.id,
        }),
      });
      setMessage(`Invite sent to ${entry.candidate.name}.`);
      await load(filter);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send invite.");
    } finally {
      setInviteFor("");
    }
  }

  return (
    <div className="account-page">
      <header className="account-head">
        <div>
          <p className="eyebrow">Hiring</p>
          <h1>Pipeline</h1>
          <p className="lede">Move shortlisted public candidates from Saved through Interviewing, Offer, Hired, or Passed.</p>
        </div>
        <Link className="btn btn-ghost btn-sm" to="/employer">Find candidates</Link>
      </header>
      {summary ? (
        <section className="account-card">
          <p className="role">{summary.active} active · {summary.total} total</p>
          <div className="chips">
            <button type="button" className={`chip ${filter === "" ? "on" : ""}`} onClick={() => { setFilter(""); void load(""); }}>All</button>
            {PIPELINE_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                className={`chip ${filter === status ? "on" : ""}`}
                onClick={() => { setFilter(status); void load(status); }}
              >
                {status} ({summary.counts[status] || 0})
              </button>
            ))}
          </div>
          {postings.length ? (
            <label className="field" style={{ marginTop: 12 }}>
              <span>Invite to posting</span>
              <select value={invitePostingId} onChange={(event) => setInvitePostingId(event.target.value)}>
                {postings.map((posting) => <option key={posting.id} value={posting.id}>{posting.title}</option>)}
              </select>
            </label>
          ) : (
            <p className="role" style={{ marginTop: 12 }}>Open a posting to invite pipeline candidates. <Link to="/employer/postings">Create posting</Link></p>
          )}
        </section>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="role">{message}</p> : null}
      {!loaded ? <p className="lede">Loading pipeline…</p> : null}
      {loaded && !entries.length ? (
        <section className="account-card">
          <h2>No candidates in this stage</h2>
          <p className="lede">Save people from the public candidate search to start a hiring workflow.</p>
          <Link className="btn btn-primary btn-sm" to="/employer">Search candidates</Link>
        </section>
      ) : null}
      {entries.map((entry) => (
        <article className="account-card" key={entry.id}>
          <div className="job-card" style={{ padding: 0, boxShadow: "none", background: "transparent" }}>
            <div>
              <h2>{entry.candidate.name}</h2>
              <p className="role">
                {entry.candidate.headline || "Member"}
                {entry.candidate.city ? ` · ${entry.candidate.city}` : ""}
                {` · ${entry.status}`}
              </p>
              <div className="chips">{entry.candidate.skills.map((item) => <span className="chip" key={item}>{item}</span>)}</div>
              <div className="admin-grid" style={{ marginTop: 12 }}>
                <label className="field">
                  <span>Stage</span>
                  <select
                    value={entry.status}
                    onChange={(event) => void updateEntry(entry, { status: event.target.value })}
                  >
                    {PIPELINE_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
                <label className="field">
                  <span>Role</span>
                  <input
                    value={entry.roleTitle}
                    placeholder="Product Manager"
                    onChange={(event) => {
                      const roleTitle = event.target.value;
                      setEntries((current) => current.map((item) => (item.id === entry.id ? { ...item, roleTitle } : item)));
                    }}
                    onBlur={(event) => void updateEntry(entry, { roleTitle: event.target.value })}
                  />
                </label>
              </div>
              <label className="field">
                <span>Notes</span>
                <textarea
                  rows={3}
                  value={entry.notes}
                  placeholder="Interview feedback, next steps…"
                  onChange={(event) => {
                    const notes = event.target.value;
                    setEntries((current) => current.map((item) => (item.id === entry.id ? { ...item, notes } : item)));
                  }}
                  onBlur={(event) => void updateEntry(entry, { notes: event.target.value })}
                />
              </label>
            </div>
            <div className="job-side">
              {entry.candidate.resumeUrl ? (
                <Link className="btn btn-primary btn-sm" to={entry.candidate.resumeUrl} target="_blank">View resume</Link>
              ) : null}
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                disabled={!postings.length || inviteFor === entry.id || ["Hired", "Passed"].includes(entry.status)}
                onClick={() => void sendInvite(entry)}
              >
                {inviteFor === entry.id ? "Inviting…" : "Invite"}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                disabled={roomStartingId === entry.id || ["Hired", "Passed"].includes(entry.status)}
                onClick={() => void startRoom(entry)}
              >
                {roomStartingId === entry.id ? "Opening…" : "Open room"}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                disabled={startingId === entry.id || ["Hired", "Passed"].includes(entry.status)}
                onClick={() => void startVoice(entry)}
              >
                {startingId === entry.id ? "Starting…" : "Voice interview"}
              </button>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => void removeEntry(entry)}>Remove</button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function EmployerPostingsPage() {
  const { user } = useApp();
  const empty = {
    title: "",
    company: "",
    location: "",
    remoteType: "remote",
    employmentType: "full-time",
    salaryMin: "",
    salaryMax: "",
    description: "",
    skills: "",
    category: "",
    role: "",
    applyUrl: "",
    status: "draft",
  };
  const [form, setForm] = useState(empty);
  const [postings, setPostings] = useState<{
    id: string;
    title: string;
    company: string;
    location: string;
    remoteType: string;
    status: string;
    skills: string[];
    description: string;
    jobId: string;
  }[]>([]);
  const [summary, setSummary] = useState<{ total: number; open: number } | null>(null);
  const [editingId, setEditingId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [invites, setInvites] = useState<{ id: string; status: string; candidate?: Candidate; posting?: { title: string } }[]>([]);

  async function load() {
    const data = await api<{
      postings: typeof postings;
      summary: { total: number; open: number };
    }>("/api/employer/postings");
    setPostings(data.postings);
    setSummary(data.summary);
    const inviteData = await api<{ invites: typeof invites }>("/api/employer/invites");
    setInvites(inviteData.invites);
  }

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
    void api<{ employer: EmployerProfile }>("/api/employer/me")
      .then((data) => setForm((current) => ({ ...current, company: data.employer.companyName || current.company })))
      .catch(() => undefined);
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    const payload = {
      ...form,
      salaryMin: form.salaryMin ? Number(form.salaryMin) : null,
      salaryMax: form.salaryMax ? Number(form.salaryMax) : null,
      skills: form.skills,
    };
    try {
      if (editingId) {
        await api(`/api/employer/postings/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
        setMessage("Posting updated.");
      } else {
        await api("/api/employer/postings", { method: "POST", body: JSON.stringify(payload) });
        setMessage("Posting created.");
      }
      setEditingId("");
      setForm({ ...empty, company: form.company });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save posting.");
    }
  }

  function edit(posting: (typeof postings)[number]) {
    setEditingId(posting.id);
    setForm({
      title: posting.title,
      company: posting.company,
      location: posting.location || "",
      remoteType: posting.remoteType || "remote",
      employmentType: "full-time",
      salaryMin: "",
      salaryMax: "",
      description: posting.description || "",
      skills: (posting.skills || []).join(", "),
      category: "",
      role: posting.title,
      applyUrl: "",
      status: posting.status,
    });
  }

  return (
    <div className="account-page">
      <header className="account-head">
        <div>
          <p className="eyebrow">Roles</p>
          <h1>Postings</h1>
          <p className="lede">Publish open roles into the JobPilot catalog, then invite shortlisted public candidates.</p>
        </div>
        {summary ? <p className="role">{summary.open} open · {summary.total} total</p> : null}
      </header>
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="role">{message}</p> : null}
      <form className="account-card" onSubmit={save}>
        <h2>{editingId ? "Edit posting" : "New posting"}</h2>
        <div className="admin-grid">
          <label className="field"><span>Title</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required /></label>
          <label className="field"><span>Company</span><input value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} required /></label>
          <label className="field"><span>Location</span><input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label>
          <label className="field">
            <span>Remote</span>
            <select value={form.remoteType} onChange={(event) => setForm({ ...form, remoteType: event.target.value })}>
              <option value="remote">Remote</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">Onsite</option>
            </select>
          </label>
          <label className="field"><span>Skills (comma separated)</span><input value={form.skills} onChange={(event) => setForm({ ...form, skills: event.target.value })} placeholder="SQL, Product management" /></label>
          <label className="field">
            <span>Status</span>
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
              <option value="draft">draft</option>
              <option value="open">open</option>
              <option value="closed">closed</option>
            </select>
          </label>
        </div>
        <label className="field"><span>Description</span><textarea rows={5} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="What the role owns and how success is measured." /></label>
        <label className="field"><span>Apply URL</span><input value={form.applyUrl} onChange={(event) => setForm({ ...form, applyUrl: event.target.value })} placeholder="https://" /></label>
        <div className="job-actions" style={{ justifyContent: "flex-start" }}>
          <button className="btn btn-primary btn-sm" type="submit">{editingId ? "Save changes" : "Create posting"}</button>
          {editingId ? <button className="btn btn-ghost btn-sm" type="button" onClick={() => { setEditingId(""); setForm({ ...empty, company: form.company || user?.name || "" }); }}>Cancel</button> : null}
        </div>
      </form>
      {postings.map((posting) => (
        <article className="account-card" key={posting.id}>
          <div className="job-card" style={{ padding: 0, boxShadow: "none", background: "transparent" }}>
            <div>
              <h2>{posting.title}</h2>
              <p className="role">{posting.company} · {posting.status}{posting.location ? ` · ${posting.location}` : ""}</p>
              <div className="chips">{(posting.skills || []).map((skill) => <span className="chip" key={skill}>{skill}</span>)}</div>
              {posting.description ? <p className="role">{posting.description.slice(0, 220)}</p> : null}
            </div>
            <div className="job-side">
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => edit(posting)}>Edit</button>
              {posting.status !== "open" ? (
                <button className="btn btn-primary btn-sm" type="button" onClick={() => void api(`/api/employer/postings/${posting.id}`, { method: "PUT", body: JSON.stringify({ status: "open" }) }).then(() => load()).catch((err: Error) => setError(err.message))}>Open</button>
              ) : (
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => void api(`/api/employer/postings/${posting.id}`, { method: "PUT", body: JSON.stringify({ status: "closed" }) }).then(() => load()).catch((err: Error) => setError(err.message))}>Close</button>
              )}
            </div>
          </div>
        </article>
      ))}
      <section className="account-card">
        <h2>Outbound invites</h2>
        {!invites.length ? <p className="role">Invites you send from the pipeline appear here.</p> : null}
        {invites.map((invite) => (
          <div className="quiet-row" key={invite.id}>
            <div>
              <strong>{invite.candidate?.name || "Candidate"}</strong>
              <p className="role">{invite.posting?.title || "Role"} · {invite.status}</p>
            </div>
            <span className="match-badge">{invite.status}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

export function EmployerCompanyPage() {
  const { refresh } = useApp();
  const [employer, setEmployer] = useState<EmployerProfile>({ companyName: "", website: "", blurb: "" });
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void api<{ user: { name: string }; employer: EmployerProfile }>("/api/employer/me")
      .then((data) => {
        setEmployer(data.employer);
        setName(data.user.name);
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const data = await api<{ employer: EmployerProfile }>("/api/employer/profile", {
        method: "PUT",
        body: JSON.stringify({ ...employer, name }),
      });
      setEmployer(data.employer);
      setMessage("Company profile saved.");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    }
  }

  return (
    <div className="account-page">
      <header className="account-head">
        <div>
          <p className="eyebrow">Company</p>
          <h1>Employer profile</h1>
        </div>
      </header>
      <form className="account-card" onSubmit={save}>
        {error ? <p className="form-error">{error}</p> : null}
        {message ? <p className="role">{message}</p> : null}
        <label className="field"><span>Your name</span><input value={name} onChange={(event) => setName(event.target.value)} required /></label>
        <label className="field"><span>Company</span><input value={employer.companyName} onChange={(event) => setEmployer({ ...employer, companyName: event.target.value })} required /></label>
        <label className="field"><span>Website</span><input value={employer.website} onChange={(event) => setEmployer({ ...employer, website: event.target.value })} /></label>
        <label className="field"><span>About the team</span><textarea rows={4} value={employer.blurb} onChange={(event) => setEmployer({ ...employer, blurb: event.target.value })} /></label>
        <button className="btn btn-primary btn-sm" type="submit">Save</button>
      </form>
    </div>
  );
}

export function EmployerRoomsPage() {
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<{
    id: string;
    title: string;
    status: string;
    joinCode: string;
    interviewerCode: string;
    hostPath: string;
    joinPath: string;
    interviewerPath: string;
    summary: { present: number; participantCount: number; candidateAnswers: number };
    candidate: { name: string } | null;
  }[]>([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void api<{ rooms: typeof rooms }>("/api/employer/rooms")
      .then((data) => {
        setRooms(data.rooms);
        setLoaded(true);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoaded(true);
      });
  }, []);

  return (
    <div className="account-page">
      <header className="account-head">
        <div>
          <p className="eyebrow">Live rooms</p>
          <h1>Interview rooms</h1>
          <p className="lede">Multi-party rooms with host, interviewer, and candidate links. Shared transcript polls live; candidate answers stay fact-safe.</p>
        </div>
        <Link className="btn btn-ghost btn-sm" to="/employer/pipeline">Open pipeline</Link>
      </header>
      {error ? <p className="form-error">{error}</p> : null}
      {!loaded ? <p className="lede">Loading rooms…</p> : null}
      {loaded && !rooms.length ? (
        <section className="account-card">
          <h2>No rooms yet</h2>
          <p className="lede">From the pipeline, choose Open room on a shortlisted candidate.</p>
        </section>
      ) : null}
      {rooms.map((room) => (
        <article className="account-card" key={room.id}>
          <div className="job-card" style={{ padding: 0, boxShadow: "none", background: "transparent" }}>
            <div>
              <h2>{room.title}</h2>
              <p className="role">
                {room.candidate?.name || "Candidate"} · {room.status}
                {` · ${room.summary.present}/${room.summary.participantCount} present`}
                {room.summary.candidateAnswers ? ` · ${room.summary.candidateAnswers} answers` : ""}
              </p>
              <p className="role">Candidate {room.joinCode} · Interviewer {room.interviewerCode}</p>
            </div>
            <div className="job-side">
              <button className="btn btn-primary btn-sm" type="button" onClick={() => navigate(`/employer/rooms/${room.id}`)}>Manage</button>
              <Link className="btn btn-ghost btn-sm" to={room.hostPath}>Enter as host</Link>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function EmployerRoomHostPage() {
  const { id = "" } = useParams();
  const [room, setRoom] = useState<{
    id: string;
    title: string;
    status: string;
    joinCode: string;
    interviewerCode: string;
    hostCode: string;
    joinPath: string;
    interviewerPath: string;
    hostPath: string;
    summary: { present: number; participantCount: number; averageScore: number; inventedMetricFlags: number };
    candidate: { name: string; resumeUrl: string } | null;
  } | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const data = await api<{ room: NonNullable<typeof room> }>(`/api/employer/rooms/${id}`);
    setRoom(data.room);
  }

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
    const timer = window.setInterval(() => {
      void load().catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [id]);

  async function setStatus(status: "live" | "ended") {
    setBusy(true);
    setError("");
    try {
      const data = await api<{ room: NonNullable<typeof room> }>(`/api/employer/rooms/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      setRoom(data.room);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update room.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value.startsWith("/") ? `${window.location.origin}${value}` : value);
      setCopied(label);
      window.setTimeout(() => setCopied((current) => (current === label ? "" : current)), 1600);
    } catch {
      setError("Clipboard access was blocked.");
    }
  }

  if (!room) {
    return (
      <div className="account-page">
        {error ? <p className="form-error">{error}</p> : <p className="lede">Loading room…</p>}
      </div>
    );
  }

  return (
    <div className="account-page">
      <header className="account-head">
        <div>
          <p className="eyebrow">Room</p>
          <h1>{room.title}</h1>
          <p className="lede">
            {room.status}
            {` · ${room.summary.present}/${room.summary.participantCount} present`}
            {room.summary.averageScore ? ` · avg ${room.summary.averageScore}` : ""}
            {room.summary.inventedMetricFlags ? ` · ${room.summary.inventedMetricFlags} invented-metric flag(s)` : ""}
          </p>
        </div>
        <Link className="btn btn-ghost btn-sm" to="/employer/rooms">All rooms</Link>
      </header>
      {error ? <p className="form-error">{error}</p> : null}
      <section className="account-card">
        <h2>Share links</h2>
        <div className="apply-kit-row">
          <div><strong>Candidate</strong><p className="role">{room.joinPath} · code {room.joinCode}</p></div>
          <button className="text-btn" type="button" onClick={() => void copy("candidate", room.joinPath)}>{copied === "candidate" ? "Copied" : "Copy"}</button>
        </div>
        <div className="apply-kit-row">
          <div><strong>Interviewer</strong><p className="role">{room.interviewerPath} · code {room.interviewerCode}</p></div>
          <button className="text-btn" type="button" onClick={() => void copy("interviewer", room.interviewerPath)}>{copied === "interviewer" ? "Copied" : "Copy"}</button>
        </div>
        <div className="apply-kit-row">
          <div><strong>Host</strong><p className="role">{room.hostPath}</p></div>
          <button className="text-btn" type="button" onClick={() => void copy("host", room.hostPath)}>{copied === "host" ? "Copied" : "Copy"}</button>
        </div>
        <div className="job-actions" style={{ justifyContent: "flex-start", marginTop: 12 }}>
          {room.status === "lobby" ? (
            <button className="btn btn-primary btn-sm" type="button" disabled={busy} onClick={() => void setStatus("live")}>Go live</button>
          ) : null}
          {room.status !== "ended" ? (
            <button className="btn btn-ghost btn-sm" type="button" disabled={busy} onClick={() => void setStatus("ended")}>End room</button>
          ) : null}
          <Link className="btn btn-primary btn-sm" to={room.hostPath}>Enter room</Link>
          {room.candidate?.resumeUrl ? <Link className="btn btn-ghost btn-sm" to={room.candidate.resumeUrl} target="_blank">Resume</Link> : null}
        </div>
      </section>
    </div>
  );
}

export function EmployerInterviewsPage() {
  const [sessions, setSessions] = useState<VoiceSession[]>([]);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void api<{ sessions: VoiceSession[] }>("/api/employer/voice-sessions")
      .then((data) => {
        setSessions(data.sessions);
        setLoaded(true);
      })
      .catch((err: Error) => {
        setError(err.message);
        setLoaded(true);
      });
  }, []);

  return (
    <div className="account-page">
      <header className="account-head">
        <div>
          <p className="eyebrow">Interviews</p>
          <h1>Live voice interviews</h1>
          <p className="lede">Start from a pipeline candidate, share the join code, and capture answers with fact-safe coaching notes.</p>
        </div>
        <Link className="btn btn-ghost btn-sm" to="/employer/pipeline">Open pipeline</Link>
      </header>
      {error ? <p className="form-error">{error}</p> : null}
      {!loaded ? <p className="lede">Loading interviews…</p> : null}
      {loaded && !sessions.length ? (
        <section className="account-card">
          <h2>No interviews yet</h2>
          <p className="lede">Save a public candidate, then choose Voice interview from the pipeline.</p>
        </section>
      ) : null}
      {sessions.map((session) => (
        <article className="account-card" key={session.id}>
          <div className="job-card" style={{ padding: 0, boxShadow: "none", background: "transparent" }}>
            <div>
              <h2>{session.candidate.name || "Candidate"}</h2>
              <p className="role">
                {session.roleTitle || session.candidate.headline || "Role"} · {session.status}
                {session.summary.answered ? ` · ${session.summary.answered}/${session.summary.total} answered` : ""}
              </p>
              <p className="role">Join code {session.joinCode}</p>
            </div>
            <div className="job-side">
              <Link className="btn btn-primary btn-sm" to={`/employer/interviews/${session.id}`}>Open</Link>
            </div>
          </div>
        </article>
      ))}
    </div>
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

function useVoiceCapture(onError: (message: string) => void) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
  }, []);

  function speak(text: string) {
    if (!text || !window.speechSynthesis) {
      onError("Speech synthesis is not available in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
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

  function startListening(setAnswer: (value: string) => void) {
    const SpeechRecognition = (window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onError("Speech recognition is not available. Type the answer instead.");
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

  return { listening, speaking, speak, startListening, stopListening };
}

export function EmployerVoiceSessionPage() {
  const { id = "" } = useParams();
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const voice = useVoiceCapture((message) => setError(message));

  async function load() {
    const data = await api<{ session: VoiceSession }>(`/api/employer/voice-sessions/${id}`);
    setSession(data.session);
    setNotes(data.session.notes || "");
    setAnswer(data.session.turns[index]?.answer || "");
  }

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
  }, [id]);

  useEffect(() => {
    if (!session) return;
    setAnswer(session.turns[index]?.answer || "");
  }, [index, session?.id]);

  const turn = session?.turns[index] || null;
  const prompt = session?.questions[index] || null;

  async function start() {
    setBusy(true);
    setError("");
    try {
      const data = await api<{ session: VoiceSession }>(`/api/employer/voice-sessions/${id}/start`, { method: "POST", body: "{}" });
      setSession(data.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start interview.");
    } finally {
      setBusy(false);
    }
  }

  async function submitAnswer(mode: "typed" | "speech") {
    if (!session || !prompt) return;
    setBusy(true);
    voice.stopListening();
    try {
      const data = await api<{ session: VoiceSession }>(`/api/employer/voice-sessions/${session.id}/answer`, {
        method: "POST",
        body: JSON.stringify({ promptId: prompt.id, answer, mode }),
      });
      setSession(data.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save answer.");
    } finally {
      setBusy(false);
    }
  }

  async function complete() {
    setBusy(true);
    setError("");
    try {
      const data = await api<{ session: VoiceSession }>(`/api/employer/voice-sessions/${id}/complete`, {
        method: "POST",
        body: JSON.stringify({ notes }),
      });
      setSession(data.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete interview.");
    } finally {
      setBusy(false);
    }
  }

  async function copyJoin() {
    if (!session) return;
    try {
      const url = `${window.location.origin}${session.joinPath}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setError("Clipboard access was blocked.");
    }
  }

  if (!session) {
    return (
      <div className="account-page">
        {error ? <p className="form-error">{error}</p> : <p className="lede">Loading interview…</p>}
      </div>
    );
  }

  return (
    <div className="account-page">
      <header className="account-head">
        <div>
          <p className="eyebrow">Live interview</p>
          <h1>{session.candidate.name}</h1>
          <p className="lede">
            {session.roleTitle || "Role"} · {session.status}
            {session.summary.answered ? ` · ${session.summary.answered}/${session.summary.total} answered` : ""}
            {session.summary.averageScore ? ` · avg ${session.summary.averageScore}` : ""}
          </p>
        </div>
        <Link className="btn btn-ghost btn-sm" to="/employer/interviews">All interviews</Link>
      </header>
      {error ? <p className="form-error">{error}</p> : null}
      <section className="account-card">
        <h2>Share with candidate</h2>
        <p className="role">Join code <strong>{session.joinCode}</strong> · path {session.joinPath}</p>
        <div className="job-actions" style={{ justifyContent: "flex-start" }}>
          <button className="btn btn-primary btn-sm" type="button" onClick={() => void copyJoin()}>{copied ? "Copied" : "Copy join link"}</button>
          {session.status === "scheduled" ? (
            <button className="btn btn-ghost btn-sm" type="button" disabled={busy} onClick={() => void start()}>Mark live</button>
          ) : null}
          {session.status !== "complete" && session.status !== "cancelled" ? (
            <button className="btn btn-ghost btn-sm" type="button" disabled={busy} onClick={() => void complete()}>Complete</button>
          ) : null}
        </div>
      </section>
      {prompt && turn ? (
        <section className="account-card voice-practice">
          <div className="voice-prompt">
            <p className="eyebrow">Question {index + 1} of {session.questions.length}</p>
            <h3>{prompt.prompt}</h3>
            <div className="job-actions" style={{ justifyContent: "flex-start" }}>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => voice.speak(prompt.prompt)} disabled={voice.speaking}>
                {voice.speaking ? "Speaking…" : "Hear question"}
              </button>
              {voice.listening ? (
                <button className="btn btn-ghost btn-sm" type="button" onClick={voice.stopListening}>Stop mic</button>
              ) : (
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => voice.startListening(setAnswer)}>Capture answer</button>
              )}
            </div>
          </div>
          <label className="field">
            <span>Answer {voice.listening ? "(listening…)" : turn.mode ? `(${turn.mode})` : ""}</span>
            <textarea rows={5} value={answer} onChange={(event) => setAnswer(event.target.value)} />
          </label>
          <div className="job-actions" style={{ justifyContent: "flex-start" }}>
            <button className="btn btn-primary btn-sm" type="button" disabled={busy || !answer.trim() || session.status === "complete"} onClick={() => void submitAnswer(voice.listening || turn.mode === "speech" ? "speech" : "typed")}>
              {busy ? "Saving…" : "Save & score"}
            </button>
            <button className="btn btn-ghost btn-sm" type="button" disabled={index <= 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}>Previous</button>
            <button className="btn btn-ghost btn-sm" type="button" disabled={index >= session.questions.length - 1} onClick={() => setIndex((value) => Math.min(session.questions.length - 1, value + 1))}>Next</button>
          </div>
          {turn.feedback ? (
            <div className="voice-feedback">
              <p className="role"><strong>{turn.feedback.label}</strong> · score {turn.feedback.score}</p>
              <ul className="interview-signals">
                {turn.feedback.notes.map((note) => <li key={note}>{note}</li>)}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}
      <section className="account-card">
        <label className="field">
          <span>Employer notes</span>
          <textarea rows={4} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Hiring decision notes…" />
        </label>
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          disabled={busy}
          onClick={() => {
            void api<{ session: VoiceSession }>(`/api/employer/voice-sessions/${id}`, {
              method: "PUT",
              body: JSON.stringify({ notes }),
            })
              .then((data) => setSession(data.session))
              .catch((err: Error) => setError(err.message));
          }}
        >
          Save notes
        </button>
      </section>
    </div>
  );
}

export function VoiceJoinPage() {
  const { code = "" } = useParams();
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const voice = useVoiceCapture((message) => setError(message));

  useEffect(() => {
    void api<{ session: VoiceSession }>(`/api/voice-join/${code}`)
      .then((data) => {
        setSession(data.session);
        setAnswer(data.session.turns[0]?.answer || "");
      })
      .catch((err: Error) => setError(err.message));
  }, [code]);

  useEffect(() => {
    if (!session) return;
    setAnswer(session.turns[index]?.answer || "");
  }, [index, session?.id]);

  const turn = session?.turns[index] || null;
  const prompt = session?.questions[index] || null;

  async function submitAnswer(mode: "typed" | "speech") {
    if (!session || !prompt) return;
    setBusy(true);
    voice.stopListening();
    try {
      const data = await api<{ session: VoiceSession }>(`/api/voice-join/${code}/answer`, {
        method: "POST",
        body: JSON.stringify({ promptId: prompt.id, answer, mode }),
      });
      setSession(data.session);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save answer.");
    } finally {
      setBusy(false);
    }
  }

  if (error && !session) {
    return (
      <div className="container narrow-page">
        <header className="page-hero">
          <h1>Interview unavailable</h1>
          <p className="lede">{error}</p>
        </header>
      </div>
    );
  }

  if (!session || !prompt || !turn) {
    return (
      <div className="container narrow-page">
        <p className="lede">Loading interview…</p>
      </div>
    );
  }

  return (
    <div className="container narrow-page">
      <header className="page-hero">
        <p className="eyebrow">Live interview</p>
        <h1>{session.companyName || session.employerName || "Employer"}</h1>
        <p className="lede">
          {session.roleTitle || "Role"} · {session.status}. Answer by mic or keyboard. Coaching only trusts facts already on your public resume.
        </p>
      </header>
      {error ? <p className="form-error">{error}</p> : null}
      <section className="account-card voice-practice">
        <div className="voice-prompt">
          <p className="eyebrow">Question {index + 1} of {session.questions.length}</p>
          <h3>{prompt.prompt}</h3>
          <div className="job-actions" style={{ justifyContent: "flex-start" }}>
            <button className="btn btn-ghost btn-sm" type="button" onClick={() => voice.speak(prompt.prompt)} disabled={voice.speaking}>
              {voice.speaking ? "Speaking…" : "Hear question"}
            </button>
            {voice.listening ? (
              <button className="btn btn-ghost btn-sm" type="button" onClick={voice.stopListening}>Stop mic</button>
            ) : (
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => voice.startListening(setAnswer)}>Use mic</button>
            )}
          </div>
        </div>
        <label className="field">
          <span>Your answer</span>
          <textarea
            rows={5}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            disabled={session.status === "complete"}
            placeholder="Speak from verified resume facts."
          />
        </label>
        <div className="job-actions" style={{ justifyContent: "flex-start" }}>
          <button className="btn btn-primary btn-sm" type="button" disabled={busy || !answer.trim() || session.status === "complete"} onClick={() => void submitAnswer(voice.listening || turn.mode === "speech" ? "speech" : "typed")}>
            {busy ? "Saving…" : "Submit answer"}
          </button>
          <button className="btn btn-ghost btn-sm" type="button" disabled={index <= 0} onClick={() => setIndex((value) => Math.max(0, value - 1))}>Previous</button>
          <button className="btn btn-ghost btn-sm" type="button" disabled={index >= session.questions.length - 1} onClick={() => setIndex((value) => Math.min(session.questions.length - 1, value + 1))}>Next</button>
        </div>
        {turn.feedback ? (
          <div className="voice-feedback">
            <p className="role"><strong>{turn.feedback.label}</strong> · score {turn.feedback.score}</p>
            <ul className="interview-signals">
              {turn.feedback.notes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          </div>
        ) : null}
      </section>
    </div>
  );
}
