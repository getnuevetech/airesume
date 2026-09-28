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
};

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
          <p className="lede">Create a company account, then search the public candidate pool. Voice interviews come later.</p>
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
  const [loaded, setLoaded] = useState(false);

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

  return (
    <div className="account-page">
      <header className="account-head">
        <div>
          <p className="eyebrow">Candidates</p>
          <h1>Public profiles</h1>
          <p className="lede">Only members with an active public resume link appear here.</p>
        </div>
      </header>
      <form className="account-card admin-grid" onSubmit={search}>
        <label className="field"><span>Keywords</span><input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Product, activation…" /></label>
        <label className="field"><span>Skill</span><input value={skill} onChange={(event) => setSkill(event.target.value)} placeholder="SQL" /></label>
        <label className="field"><span>City</span><input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Austin" /></label>
        <button className="btn btn-primary btn-sm" type="submit">Search</button>
      </form>
      {error ? <p className="form-error">{error}</p> : null}
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
