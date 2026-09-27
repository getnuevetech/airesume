import { Link } from "react-router-dom";
import { UploadPanel } from "../components/UploadPanel";
import {
  Bolt,
  Briefcase,
  Check,
  FileText,
  LogoMark,
  Plane,
  Search,
  Shield,
  Sparkle,
  Star,
  Stars,
  Users,
} from "../components/Icons";
import { previewJobs, statusLabel, stories } from "../data";

export function HomePage() {
  return (
    <>
      <section className="container hero">
        <div className="hero-visual">
          <img
            className="hero-photo"
            src="/images/hero-woman.png"
            alt="Smiling woman in a green sweater working on a laptop in a bright office"
          />
          <div className="float-cards">
            {previewJobs.map((job) => (
              <article className="job-card" key={job.id}>
                <LogoMark logo={job.logo} />
                <div className="job-meta">
                  <strong>{job.title}</strong>
                  <span>{job.company}</span>
                </div>
                <span className={`pill pill-${job.status}`}>{statusLabel(job.status, job.match)}</span>
              </article>
            ))}
            <article className="ai-card">
              <p>AI is finding and applying to jobs for you...</p>
              <div className="ai-track" aria-hidden="true">
                <span className="ai-fill" />
              </div>
            </article>
          </div>
        </div>
        <div className="hero-copy">
          <p className="eyebrow">
            <Bolt /> Quick &amp; easy setup
          </p>
          <h1>
            Upload your resume
            <br />
            to create your account
            <br />
            and get started.
          </h1>
          <p className="lede">
            Your resume helps us instantly build your profile and find the right jobs for you.
          </p>
          <UploadPanel />
        </div>
      </section>

      <section className="container stats" aria-label="Results">
        <div className="stat">
          <span className="stat-icon">
            <Briefcase />
          </span>
          <p>
            <strong>3x</strong>
            <span>More interviews</span>
          </p>
        </div>
        <div className="stat">
          <span className="stat-icon">
            <Users />
          </span>
          <p>
            <strong>63K+</strong>
            <span>People found jobs</span>
          </p>
        </div>
        <div className="stat">
          <span className="stat-icon stat-star">
            <Star size={22} />
          </span>
          <p>
            <strong>4.8/5</strong>
            <span>User rating</span>
          </p>
        </div>
        <div className="stat">
          <span className="stat-icon">
            <Shield />
          </span>
          <p>
            <strong>Private &amp; secure</strong>
            <span>Your data stays safe</span>
          </p>
        </div>
      </section>

      <section className="container how">
        <p className="eyebrow">How it works</p>
        <h2>Find the right job. On autopilot.</h2>
        <div className="steps">
          <article className="step">
            <span className="step-icon">
              <FileText />
            </span>
            <h3>1. Upload resume</h3>
            <p>Create your profile in seconds.</p>
          </article>
          <span className="step-arrow" aria-hidden="true">
            <svg width="54" height="16" viewBox="0 0 54 16">
              <path d="M1 8h44" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M40 2.5 51 8 40 13.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <article className="step">
            <span className="step-icon">
              <Search />
            </span>
            <h3>2. Get matched</h3>
            <p>We find the best jobs for your skills.</p>
          </article>
          <span className="step-arrow" aria-hidden="true">
            <svg width="54" height="16" viewBox="0 0 54 16">
              <path d="M1 8h44" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M40 2.5 51 8 40 13.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <article className="step">
            <span className="step-icon">
              <Plane size={22} />
            </span>
            <h3>3. AI applies</h3>
            <p>We tailor your application and apply for you.</p>
          </article>
        </div>
      </section>

      <section className="container">
        <div className="better">
          <div>
            <p className="eyebrow">Better applications</p>
            <h2>A stronger resume opens more doors.</h2>
            <p className="lede">
              Get AI-powered feedback and a tailored resume that gets you noticed.
            </p>
            <Link className="btn btn-primary btn-lg" to="/get-started">
              Upscale My Resume →
            </Link>
          </div>
          <div className="resume-stage">
            <article className="resume-sheet">
              <header>
                <FileText size={18} />
                <strong>Your Resume</strong>
              </header>
              <div className="skel" style={{ width: "78%" }} />
              <div className="skel" />
              <div className="skel" style={{ width: "92%" }} />
              <div className="skel" style={{ width: "64%" }} />
              <div className="skel" />
              <div className="skel" style={{ width: "84%" }} />
              <div className="skel" style={{ width: "48%" }} />
            </article>
            <article className="check-card">
              <span className="sparkles" aria-hidden="true">
                <Sparkle size={14} />
                <Sparkle size={10} />
              </span>
              {[
                "Improved with AI",
                "Tailored for each job",
                "Optimized keywords",
                "Higher match rate",
              ].map((item) => (
                <p className="check-row" key={item}>
                  <span className="check-dot">
                    <Check />
                  </span>
                  {item}
                </p>
              ))}
            </article>
            <p className="scribble scribble-resume">
              Turn your resume into more opportunities.
              <svg viewBox="0 0 80 48" aria-hidden="true">
                <path d="M68 6C46 8 34 24 18 38" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M18 38l10-1-2-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </p>
          </div>
        </div>
      </section>

      <section className="container stories">
        <div className="stories-head">
          <div>
            <p className="eyebrow">Real people</p>
            <h2>Real results.</h2>
          </div>
          <Link className="link-green" to="/stories">
            See more stories →
          </Link>
        </div>
        <div className="stories-grid">
          {stories.map((story) => (
            <article className="story" key={story.id}>
              <img src={story.avatar} alt="" />
              <p className="quote">“{story.quote}”</p>
              <p className="who">{story.name}</p>
              <p className="role">{story.role}</p>
              <Stars />
            </article>
          ))}
        </div>
      </section>

      <section className="container">
        <div className="cta">
          <span className="orb orb-a" aria-hidden="true" />
          <span className="orb orb-b" aria-hidden="true" />
          <div className="cta-copy">
            <span className="cta-plane">
              <Plane size={46} />
            </span>
            <h2>Your next opportunity is closer than you think.</h2>
            <p>Upload your resume, create your profile, and let AI do the rest.</p>
            <Link className="btn btn-primary btn-lg" to="/get-started">
              Get Started Free →
            </Link>
          </div>
          <div className="cta-side">
            <article className="cta-card">
              <p className="cta-row">
                <span className="cta-ico">
                  <Search size={18} />
                </span>
                Find matching jobs
              </p>
              <p className="cta-row">
                <span className="cta-ico">
                  <FileText size={18} />
                </span>
                Tailor your resume
              </p>
              <p className="cta-row">
                <span className="cta-ico">
                  <Plane size={18} />
                </span>
                Apply automatically
              </p>
            </article>
            <p className="scribble scribble-cta">
              Less searching.
              <br />
              More opportunities.
              <svg viewBox="0 0 70 46" aria-hidden="true">
                <path d="M58 8C40 12 28 22 14 36" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M14 36l10-2-1-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
