import { Link } from "react-router-dom";
import { UploadPanel } from "../components/UploadPanel";
import { useSiteContent } from "../content/siteContent";
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
import { statusLabel } from "../data";

function StepArrow() {
  return (
    <span className="step-arrow" aria-hidden="true">
      <svg width="54" height="16" viewBox="0 0 54 16">
        <path d="M1 8h44" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M40 2.5 51 8 40 13.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function StepIcon({ icon }: { icon: string }) {
  if (icon === "search") return <Search />;
  if (icon === "plane") return <Plane size={22} />;
  return <FileText />;
}

function StatIcon({ icon }: { icon: string }) {
  if (icon === "users") return <Users />;
  if (icon === "star") return <Star size={22} />;
  if (icon === "shield") return <Shield />;
  return <Briefcase />;
}

function CtaIcon({ icon }: { icon: string }) {
  if (icon === "file") return <FileText size={18} />;
  if (icon === "plane") return <Plane size={18} />;
  return <Search size={18} />;
}

export function HomePage() {
  const { content } = useSiteContent();
  const { hero, stats, how, better, stories, cta } = content;

  return (
    <>
      <section className="container hero">
        <div className="hero-visual">
          <img className="hero-photo" src={hero.image} alt={hero.imageAlt} />
          <div className="float-cards">
            {hero.jobs.map((job) => (
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
              <p>{hero.aiCard}</p>
              <div className="ai-track" aria-hidden="true">
                <span className="ai-fill" />
              </div>
            </article>
          </div>
        </div>
        <div className="hero-copy">
          <p className="eyebrow">
            <Bolt /> {hero.eyebrow}
          </p>
          <h1>
            {hero.titleLines.map((line, index) => (
              <span key={line}>
                {index > 0 ? <br /> : null}
                {line}
              </span>
            ))}
          </h1>
          <p className="lede">{hero.lede}</p>
          <UploadPanel />
        </div>
      </section>

      <section className="container stats" aria-label="Results">
        {stats.map((stat) => (
          <div className="stat" key={stat.label}>
            <span className={stat.icon === "star" ? "stat-icon stat-star" : "stat-icon"}>
              <StatIcon icon={stat.icon} />
            </span>
            <p>
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </p>
          </div>
        ))}
      </section>

      <section className="container how">
        <p className="eyebrow">{how.eyebrow}</p>
        <h2>{how.title}</h2>
        <div className="steps">
          {how.steps.map((step, index) => (
            <span className="step-with-arrow" key={step.title}>
              {index > 0 ? <StepArrow /> : null}
              <article className="step">
                <span className="step-icon">
                  <StepIcon icon={step.icon} />
                </span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            </span>
          ))}
        </div>
      </section>

      <section className="container">
        <div className="better">
          <div>
            <p className="eyebrow">{better.eyebrow}</p>
            <h2>{better.title}</h2>
            <p className="lede">{better.lede}</p>
            <Link className="btn btn-primary btn-lg" to="/get-started">
              {better.button}
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
              {better.checks.map((item) => (
                <p className="check-row" key={item}>
                  <span className="check-dot">
                    <Check />
                  </span>
                  {item}
                </p>
              ))}
            </article>
            <p className="scribble scribble-resume">
              {better.scribble}
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
            <p className="eyebrow">{stories.eyebrow}</p>
            <h2>{stories.title}</h2>
          </div>
          <Link className="link-green" to="/stories">
            {stories.linkLabel}
          </Link>
        </div>
        <div className="stories-grid">
          {stories.items.map((story) => (
            <article className="story" key={story.name}>
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
            <h2>{cta.title}</h2>
            <p>{cta.lede}</p>
            <Link className="btn btn-primary btn-lg" to="/get-started">
              {cta.button}
            </Link>
          </div>
          <div className="cta-side">
            <article className="cta-card">
              {cta.items.map((item) => (
                <p className="cta-row" key={item.label}>
                  <span className="cta-ico">
                    <CtaIcon icon={item.icon} />
                  </span>
                  {item.label}
                </p>
              ))}
            </article>
            <p className="scribble scribble-cta">
              {cta.scribble}
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
