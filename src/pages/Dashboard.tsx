import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { LogoMark } from "../components/Icons";
import {
  formatBytes,
  previewJobs,
  profileFromResume,
  statusLabel,
  type Job,
} from "../data";

export function DashboardPage() {
  const { user, resume, plan, billing, clearResume } = useApp();
  const [jobs, setJobs] = useState<Job[]>(() => previewJobs.map((job) => ({ ...job })));
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    if (!resume) return;
    setJobs(previewJobs.map((job) => ({ ...job })));
    setLog(["Reading your resume…"]);
    const timers = [
      window.setTimeout(() => {
        setLog((entries) => [...entries, "Profile ready. Searching open roles…"]);
      }, 700),
      window.setTimeout(() => {
        setLog((entries) => [...entries, "Simulated application: Product Manager at Spotify"]);
      }, 1400),
      window.setTimeout(() => {
        setJobs((current) =>
          current.map((job) => (job.id === "se" ? { ...job, status: "applied" } : job)),
        );
        setLog((entries) => [...entries, "Simulated application: Software Engineer at HubSpot"]);
      }, 2800),
      window.setTimeout(() => {
        setJobs((current) =>
          current.map((job) => (job.id === "da" ? { ...job, status: "applying" } : job)),
        );
        setLog((entries) => [...entries, "Tailoring an application for Data Analyst at Notion"]);
      }, 4200),
      window.setTimeout(() => {
        setJobs((current) =>
          current.map((job) => (job.id === "da" ? { ...job, status: "applied" } : job)),
        );
        setLog((entries) => [...entries, "Simulated application: Data Analyst at Notion"]);
      }, 6000),
    ];
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [resume?.uploadedAt]);

  if (!resume) {
    return (
      <div className="container page-hero">
        <p className="eyebrow">Dashboard</p>
        <h1>Upload a resume to start the search.</h1>
        <p className="lede">Your matches and the autopilot preview show up here after the file is in.</p>
        <Link className="btn btn-primary btn-lg" to="/get-started">
          Upload Resume
        </Link>
      </div>
    );
  }

  const profile = profileFromResume(resume.text, resume.name);
  const applied = jobs.filter((job) => job.status === "applied").length;
  const planName = plan === "autopilot" ? "Autopilot" : plan === "pro" ? "Pro" : "Free";

  return (
    <div className="container dash">
      <header className="dash-head">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>{profile.name === "Your profile" ? "Your search is on autopilot." : `${profile.name.split(" ")[0]}, your search is on autopilot.`}</h1>
          <p className="lede">
            {user ? `Signed in as ${user.email}. ` : ""}
            Preview mode — applications are simulated in this browser and are not sent to employers.
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

      <div className="ai-banner">
        <p>AI is finding and applying to jobs for you...</p>
        <div className="ai-track" aria-hidden="true">
          <span className="ai-fill" />
        </div>
      </div>

      <div className="dash-grid">
        <aside className="panel">
          <h2>Profile</h2>
          <p className="who">{resume.name}</p>
          <p className="role">{formatBytes(resume.size)}</p>
          <p>{profile.summary}</p>
          <div className="chips">
            {profile.skills.map((skill) => (
              <span className="chip" key={skill}>
                {skill}
              </span>
            ))}
          </div>
          <p className="role">{profile.fromFile ? "Skills found in your resume." : "Add a TXT file to read skills from the document."}</p>
          <button type="button" className="text-btn" onClick={clearResume}>
            Remove resume
          </button>
        </aside>
        <section>
          <div className="mini-stats">
            <p>
              <strong>{applied}</strong>
              <span>Simulated applications</span>
            </p>
            <p>
              <strong>{jobs.length}</strong>
              <span>Roles in review</span>
            </p>
            <p>
              <strong>92%</strong>
              <span>Top match</span>
            </p>
          </div>
          <div className="app-list">
            {jobs.map((job) => (
              <article className="app-row" key={job.id}>
                <LogoMark logo={job.logo} />
                <div className="job-meta">
                  <strong>{job.title}</strong>
                  <span>{job.company}</span>
                </div>
                <div className="match-col">
                  <span className={`pill pill-${job.status}`}>{statusLabel(job.status, job.match)}</span>
                  <div className="ai-track thin" aria-hidden="true">
                    <span style={{ width: `${job.match}%` }} />
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="panel activity-panel">
            <h2>Activity</h2>
            <ul className="activity" aria-live="polite">
              {log.map((entry) => (
                <li key={entry}>{entry}</li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
