import { useEffect, useState, type FormEvent } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
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
          <p className="lede">Create a company account, search the public pool, and move shortlisted candidates through a hiring pipeline.</p>
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
  const [entries, setEntries] = useState<PipelineEntry[]>([]);
  const [summary, setSummary] = useState<{ total: number; active: number; counts: Record<string, number> } | null>(null);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

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
        </section>
      ) : null}
      {error ? <p className="form-error">{error}</p> : null}
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
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => void removeEntry(entry)}>Remove</button>
            </div>
          </div>
        </article>
      ))}
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
