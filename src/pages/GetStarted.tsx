import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { UploadPanel } from "../components/UploadPanel";
import { useApp } from "../context/AppContext";
import { formatBytes, profileFromResume } from "../data";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function GetStartedPage() {
  const { user, resume, register } = useApp();
  const profile = resume ? profileFromResume(resume.text, resume.name) : null;
  const [name, setName] = useState(profile && profile.name !== "Your profile" ? profile.name : "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!resume) return;
    const next = profileFromResume(resume.text, resume.name);
    if (next.name !== "Your profile") setName(next.name);
  }, [resume]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2) {
      setError("Enter the name you want on your profile.");
      return;
    }
    if (!emailPattern.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    const message = register(name, email, password);
    setError(message ?? "");
  }

  return (
    <div className="container start-grid">
      <div className="page-hero">
        <p className="eyebrow">Get started</p>
        <h1>Upload your resume to create your account and get started.</h1>
        <p className="lede">
          Your resume helps us instantly build your profile and find the right jobs for you.
        </p>
        <ul className="ticks">
          <li>Profile created in seconds</li>
          <li>Matches based on your skills</li>
          <li>Applications previewed in this browser</li>
        </ul>
      </div>
      <div>
        {!resume ? (
          <UploadPanel showSample />
        ) : user ? (
          <div className="auth-card">
            <p className="eyebrow">Resume ready</p>
            <h2>{resume.name}</h2>
            <p className="role">{formatBytes(resume.size)}</p>
            {profile ? <p>{profile.summary}</p> : null}
            <div className="chips">
              {profile?.skills.map((skill) => (
                <span className="chip" key={skill}>
                  {skill}
                </span>
              ))}
            </div>
            <Link className="btn btn-primary btn-block" to="/dashboard">
              Go to your matches
            </Link>
            <ReplaceResume />
          </div>
        ) : (
          <form className="auth-card" onSubmit={onSubmit}>
            <p className="eyebrow">Create your account</p>
            <h2>We read {resume.name}</h2>
            <p className="role">{formatBytes(resume.size)} · saved in this browser</p>
            {profile ? <p>{profile.summary}</p> : null}
            <div className="chips">
              {profile?.skills.map((skill) => (
                <span className="chip" key={skill}>
                  {skill}
                </span>
              ))}
            </div>
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
            <label className="field">
              <span>Full name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} required />
            </label>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={8}
                required
              />
            </label>
            <button className="btn btn-primary btn-block" type="submit">
              Create account
            </button>
            <p className="fine-print">
              Already have an account? <Link to="/signin">Sign in</Link>
            </p>
            <ReplaceResume />
          </form>
        )}
      </div>
    </div>
  );
}

function ReplaceResume() {
  const { setResume, notify } = useApp();
  return (
    <label className="text-btn file-label">
      Replace resume
      <input
        type="file"
        accept=".pdf,.doc,.docx,.txt,application/pdf,text/plain"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          const lower = file.name.toLowerCase();
          if (!/\.(pdf|docx|doc|txt)$/.test(lower)) {
            notify("Use a PDF, DOCX, or TXT file.");
            return;
          }
          if (file.size > 10 * 1024 * 1024) {
            notify("That file is over 10MB.");
            return;
          }
          void (async () => {
            let text: string | null = null;
            if (lower.endsWith(".txt") || file.type.startsWith("text/")) {
              text = (await file.text()).slice(0, 20000);
            }
            setResume({ name: file.name, size: file.size, text, uploadedAt: Date.now() });
            notify("Resume replaced.");
          })();
        }}
      />
    </label>
  );
}
