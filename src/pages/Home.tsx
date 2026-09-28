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
  if (icon === "spark") return <Sparkle size={22} />;
  return <FileText />;
}

function StatIcon({ icon }: { icon: string }) {
  if (icon === "users") return <Users />;
  if (icon === "star") return <Star size={22} />;
  if (icon === "shield") return <Shield />;
  return <Briefcase />;
}

function TrustIcon({ icon }: { icon: string }) {
  if (icon === "check") return <Check />;
  if (icon === "lock") return <Shield />;
  if (icon === "eye") return <Search />;
  return <Shield />;
}

function CtaIcon({ icon }: { icon: string }) {
  if (icon === "file") return <FileText size={18} />;
  if (icon === "plane") return <Plane size={18} />;
  return <Search size={18} />;
}

export function HomePage() {
  const { content } = useSiteContent();
  const { hero, trust, stats, how, fit, efficiency, better, results, stories, pricing, cta } = content;

  return (
    <>
      <section className="container hero hero-convert">
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
          {hero.secondaryCta ? (
            <p className="hero-secondary">
              <a className="link-green" href={hero.secondaryCtaTo || "#how-it-works"}>
                {hero.secondaryCta} →
              </a>
            </p>
          ) : null}
          <div className="hero-demo" aria-hidden="true">
            {hero.jobs.slice(0, 2).map((job) => (
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
              <div className="ai-track">
                <span className="ai-fill" />
              </div>
            </article>
          </div>
        </div>
        <div className="hero-action">
          <UploadPanel />
        </div>
      </section>

      <section className="container trust-strip" aria-label="Trust and privacy">
        {trust.items.map((item) => (
          <article className="trust-item" key={item.title}>
            <span className="trust-icon">
              <TrustIcon icon={item.icon} />
            </span>
            <div>
              <strong>{item.title}</strong>
              <p>{item.text}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="container stats" aria-label="Positioning">
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

      <section className="container how" id="how-it-works">
        <p className="eyebrow">{how.eyebrow}</p>
        <h2>{how.title}</h2>
        <div className="steps steps-four">
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

      <section className="container fit-section">
        <div className="fit-copy">
          <p className="eyebrow">{fit.eyebrow}</p>
          <h2>{fit.title}</h2>
          <p className="lede">{fit.lede}</p>
        </div>
        <article className="fit-card">
          <header className="fit-card-head">
            <div>
              <strong>{fit.demo.title}</strong>
              <span>{fit.demo.company}</span>
            </div>
            <div className="fit-score">
              <span className="fit-score-value">{fit.demo.score}%</span>
              <span className="pill pill-match">{fit.demo.label}</span>
            </div>
          </header>
          <div className="fit-meta">
            {fit.demo.meta.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
          <div className="fit-cols">
            <div>
              <p className="fit-label">Why you match</p>
              <ul>
                {fit.demo.why.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="fit-label">Gaps to watch</p>
              <ul>
                {fit.demo.gaps.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </article>
      </section>

      <section className="container efficiency-section">
        <p className="eyebrow">{efficiency.eyebrow}</p>
        <h2>{efficiency.title}</h2>
        <p className="lede center-lede">{efficiency.lede}</p>
        <ol className="efficiency-stages">
          {efficiency.stages.map((stage, index) => (
            <li key={stage}>
              <span className="efficiency-num">{index + 1}</span>
              <span>{stage}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="container">
        <div className="better">
          <div>
            <p className="eyebrow">{better.eyebrow}</p>
            <h2>{better.title}</h2>
            <p className="lede">{better.lede}</p>
            <div className="upscale-compare">
              <blockquote>
                <span className="upscale-label">{better.beforeLabel || "Before"}</span>
                <p>{better.before}</p>
              </blockquote>
              <blockquote className="upscale-after">
                <span className="upscale-label">{better.afterLabel || "After"}</span>
                <p>{better.after}</p>
              </blockquote>
            </div>
            <Link className="btn btn-primary btn-lg" to="/get-started">
              {better.button}
            </Link>
          </div>
          <div className="resume-stage">
            <article className="check-card check-card-static">
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
            <p className="scribble scribble-resume">{better.scribble}</p>
          </div>
        </div>
      </section>

      <section className="container results-section">
        <p className="eyebrow">{results.eyebrow}</p>
        <h2>{results.title}</h2>
        <p className="lede center-lede">{results.lede}</p>
        <div className="results-grid">
          {results.metrics.map((metric) => (
            <article className="result-metric" key={metric.label}>
              <strong>{metric.value}</strong>
              <span>{metric.label}</span>
            </article>
          ))}
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

      <section className="container pricing-teaser">
        <p className="eyebrow">{pricing.eyebrow}</p>
        <h2>{pricing.title}</h2>
        <p className="lede center-lede">{pricing.lede}</p>
        <div className="pricing-teaser-grid">
          {pricing.plans.map((plan) => (
            <article className="pricing-teaser-card" key={plan.name}>
              <strong>{plan.name}</strong>
              <span className="pricing-teaser-price">{plan.price}</span>
              <p>{plan.blurb}</p>
            </article>
          ))}
        </div>
        <Link className="btn btn-ghost btn-lg" to={pricing.buttonTo}>
          {pricing.button}
        </Link>
      </section>

      <section className="container">
        <div className="cta cta-upload">
          <span className="orb orb-a" aria-hidden="true" />
          <span className="orb orb-b" aria-hidden="true" />
          <div className="cta-copy">
            <span className="cta-plane">
              <Plane size={46} />
            </span>
            <h2>{cta.title}</h2>
            <p>{cta.lede}</p>
            <div className="cta-items">
              {cta.items.map((item) => (
                <p className="cta-row-inline" key={item.label}>
                  <span className="cta-ico">
                    <CtaIcon icon={item.icon} />
                  </span>
                  {item.label}
                </p>
              ))}
            </div>
          </div>
          <div className="cta-upload-panel">
            <UploadPanel />
          </div>
        </div>
      </section>
    </>
  );
}
