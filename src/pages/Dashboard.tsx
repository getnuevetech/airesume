import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useApp } from "../context/AppContext";

type CareerProfile = {
  summary: string;
  skills: string[];
  employment: { title: string; employer: string; bullets?: string[] }[];
  education: string[];
  facts: { fact_id: string; statement: string; confidence?: number }[];
  preferences: {
    salary?: string;
    workArrangement?: string;
    locations?: string;
    workAuthorization?: string;
  };
  resumeName: string;
};

export function DashboardPage() {
  const { user, plan, billing } = useApp();
  const [profile, setProfile] = useState<CareerProfile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    if (!user) {
      setLoaded(true);
      return;
    }
    void api<{ profile: CareerProfile | null }>("/api/profile")
      .then((data) => setProfile(data.profile))
      .catch(() => setProfile(null))
      .finally(() => setLoaded(true));
  }, [user]);

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    setPasswordError("");
    setPasswordMessage("");
    try {
      await api("/api/account/password", {
        method: "POST",
        body: JSON.stringify({ current, password }),
      });
      setCurrent("");
      setPassword("");
      setPasswordMessage("Password updated.");
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Could not update the password.");
    }
  }

  if (!loaded) {
    return (
      <div className="container page-hero">
        <p className="eyebrow">Dashboard</p>
        <h1>Loading your career profile.</h1>
      </div>
    );
  }

  if (!user || !profile) {
    return (
      <div className="container page-hero">
        <p className="eyebrow">Dashboard</p>
        <h1>Upload a resume to start your career profile.</h1>
        <p className="lede">
          JobPilot reads the file, asks you to confirm the facts, then keeps that profile as the source of truth for later matching.
        </p>
        <Link className="btn btn-primary btn-lg" to="/get-started">
          Upload Resume
        </Link>
      </div>
    );
  }

  const first = user.name.split(" ")[0];
  const planName = plan === "autopilot" ? "Autopilot" : plan === "pro" ? "Pro" : "Free";
  const prefs = [
    profile.preferences.salary ? `Salary ${profile.preferences.salary}` : "",
    profile.preferences.workArrangement || "",
    profile.preferences.locations || "",
    profile.preferences.workAuthorization || "",
  ].filter(Boolean);

  return (
    <div className="container dash">
      <header className="dash-head">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Good morning, {first}.</h1>
          <p className="lede">
            Signed in as {user.email}. Your master career profile is ready. Live job matching and tailored applications are the next build.
          </p>
        </div>
        <div className="dash-actions">
          <span className="chip">
            {planName} · {billing}
          </span>
          <Link className="link-green" to="/pricing">
            Change plan
          </Link>
        </div>
      </header>

      <div className="mini-stats">
        <p>
          <strong>{profile.facts.length}</strong>
          <span>Verified facts</span>
        </p>
        <p>
          <strong>{profile.employment.length}</strong>
          <span>Roles on file</span>
        </p>
        <p>
          <strong>{profile.skills.length}</strong>
          <span>Skills</span>
        </p>
      </div>

      <div className="dash-grid">
        <aside className="panel">
          <h2>Career profile</h2>
          <p className="who">{user.name}</p>
          <p className="role">{profile.resumeName || "Uploaded resume"}</p>
          {user.phone ? <p className="role">{user.phone}</p> : null}
          <p>{profile.summary || "No summary was extracted."}</p>
          <div className="chips">
            {profile.skills.map((skill) => (
              <span className="chip" key={skill}>
                {skill}
              </span>
            ))}
          </div>
          {prefs.length ? <p className="role">{prefs.join(" · ")}</p> : null}
        </aside>
        <section>
          <div className="panel">
            <h2>Fact ledger</h2>
            <ul className="fact-list">
              {profile.facts.map((fact) => (
                <li key={fact.fact_id}>{fact.statement}</li>
              ))}
            </ul>
          </div>
          <div className="panel activity-panel">
            <h2>Employment</h2>
            {profile.employment.length ? (
              profile.employment.map((job) => (
                <article key={`${job.title}-${job.employer}`}>
                  <strong>{job.title}</strong>
                  {job.employer ? <p className="role">{job.employer}</p> : null}
                  {(job.bullets || []).slice(0, 3).map((bullet) => (
                    <p key={bullet}>{bullet}</p>
                  ))}
                </article>
              ))
            ) : (
              <p className="role">No employment lines were confirmed from the resume.</p>
            )}
            {profile.education.length ? <p className="role">Education: {profile.education.join(" · ")}</p> : null}
          </div>
          {user.provider === "email" ? (
            <form className="panel activity-panel" onSubmit={changePassword}>
              <h2>Password</h2>
              {passwordError ? <p className="form-error">{passwordError}</p> : null}
              {passwordMessage ? <p className="role">{passwordMessage}</p> : null}
              <label className="field">
                <span>Current password</span>
                <input type="password" value={current} onChange={(event) => setCurrent(event.target.value)} required />
              </label>
              <label className="field">
                <span>New password</span>
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
              </label>
              <button className="btn btn-primary btn-sm" type="submit">
                Update password
              </button>
              <p className="role">
                Or use a <Link to="/forgot-password">reset link</Link>.
              </p>
            </form>
          ) : null}
        </section>
      </div>
    </div>
  );
}
