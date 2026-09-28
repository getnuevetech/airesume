import { useEffect, useState, type ReactNode } from "react";
import { api } from "../../api";
import { defaultHomepage, type HomepageContent } from "../../content/siteContent";

function parseLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function HomepageEditor() {
  const [content, setContent] = useState<HomepageContent>(defaultHomepage);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void api<HomepageContent>("/api/admin/homepage").then(setContent).catch((err: Error) => setError(err.message));
  }, []);

  function update<K extends keyof HomepageContent>(key: K, value: HomepageContent[K]) {
    setContent((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    setError("");
    try {
      await api("/api/admin/homepage", { method: "PUT", body: JSON.stringify(content) });
      window.dispatchEvent(new Event("homepage-updated"));
      setMessage("Homepage saved. Open the landing page to review.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    }
  }

  async function upload(file: File | undefined, apply: (url: string) => void) {
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    const data = await api<{ url: string }>("/api/admin/upload", { method: "POST", body });
    apply(data.url);
  }

  return (
    <div>
      <header className="admin-head">
        <div>
          <h1>Homepage</h1>
          <p className="role">Edit every landing-page section, then save. Changes appear on the public home page.</p>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => void save()}>
          Save homepage
        </button>
      </header>
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="role">{message}</p> : null}

      <nav className="admin-toc" aria-label="Homepage sections">
        {[
          ["nav", "Menu"],
          ["hero", "Hero banner"],
          ["trust", "Trust strip"],
          ["stats", "Stats"],
          ["how", "How it works"],
          ["fit", "Job fit"],
          ["efficiency", "Efficiency"],
          ["better", "Resume upscale"],
          ["results", "Results"],
          ["stories", "Testimonials"],
          ["pricing", "Pricing teaser"],
          ["cta", "Closing CTA"],
          ["footer", "Footer"],
        ].map(([id, label]) => (
          <a key={id} href={`#home-${id}`}>
            {label}
          </a>
        ))}
      </nav>

      <section className="admin-card" id="home-nav">
        <h2>Menu and buttons</h2>
        <Field label="Brand">
          <input value={content.brand} onChange={(event) => update("brand", event.target.value)} />
        </Field>
        <div className="admin-grid">
          <Field label="Sign in label">
            <input value={content.signInLabel} onChange={(event) => update("signInLabel", event.target.value)} />
          </Field>
          <Field label="Get started label">
            <input value={content.getStartedLabel} onChange={(event) => update("getStartedLabel", event.target.value)} />
          </Field>
          <Field label="Dashboard label">
            <input value={content.dashboardLabel} onChange={(event) => update("dashboardLabel", event.target.value)} />
          </Field>
        </div>
        {content.nav.map((link, index) => (
          <div className="admin-grid" key={`nav-${index}`}>
            <Field label={`Menu label ${index + 1}`}>
              <input
                value={link.label}
                onChange={(event) => {
                  const nav = content.nav.slice();
                  nav[index] = { ...link, label: event.target.value };
                  update("nav", nav);
                }}
              />
            </Field>
            <Field label="Menu link">
              <input
                value={link.to}
                onChange={(event) => {
                  const nav = content.nav.slice();
                  nav[index] = { ...link, to: event.target.value };
                  update("nav", nav);
                }}
              />
            </Field>
          </div>
        ))}
      </section>

      <section className="admin-card" id="home-hero">
        <h2>Hero banner</h2>
        <img className="admin-preview" src={content.hero.image} alt="" />
        <Field label="Replace hero image">
          <input
            type="file"
            accept="image/*"
            onChange={(event) => void upload(event.target.files?.[0], (url) => update("hero", { ...content.hero, image: url }))}
          />
        </Field>
        <Field label="Image description">
          <input value={content.hero.imageAlt} onChange={(event) => update("hero", { ...content.hero, imageAlt: event.target.value })} />
        </Field>
        <Field label="Eyebrow">
          <input value={content.hero.eyebrow} onChange={(event) => update("hero", { ...content.hero, eyebrow: event.target.value })} />
        </Field>
        {content.hero.titleLines.map((line, index) => (
          <Field label={`Headline line ${index + 1}`} key={`title-${index}`}>
            <input
              value={line}
              onChange={(event) => {
                const titleLines = content.hero.titleLines.slice();
                titleLines[index] = event.target.value;
                update("hero", { ...content.hero, titleLines });
              }}
            />
          </Field>
        ))}
        <Field label="Supporting text">
          <textarea rows={3} value={content.hero.lede} onChange={(event) => update("hero", { ...content.hero, lede: event.target.value })} />
        </Field>
        <div className="admin-grid">
          <Field label="Secondary CTA label">
            <input
              value={content.hero.secondaryCta || ""}
              onChange={(event) => update("hero", { ...content.hero, secondaryCta: event.target.value })}
            />
          </Field>
          <Field label="Secondary CTA link">
            <input
              value={content.hero.secondaryCtaTo || ""}
              onChange={(event) => update("hero", { ...content.hero, secondaryCtaTo: event.target.value })}
            />
          </Field>
        </div>
        <div className="admin-grid">
          <Field label="Upload box title">
            <input value={content.hero.dropTitle} onChange={(event) => update("hero", { ...content.hero, dropTitle: event.target.value })} />
          </Field>
          <Field label="Upload hint">
            <input value={content.hero.dropHint} onChange={(event) => update("hero", { ...content.hero, dropHint: event.target.value })} />
          </Field>
          <Field label="Upload button">
            <input value={content.hero.uploadLabel} onChange={(event) => update("hero", { ...content.hero, uploadLabel: event.target.value })} />
          </Field>
          <Field label="Continue button">
            <input value={content.hero.continueLabel} onChange={(event) => update("hero", { ...content.hero, continueLabel: event.target.value })} />
          </Field>
          <Field label="Change-file button">
            <input
              value={content.hero.changeFileLabel}
              onChange={(event) => update("hero", { ...content.hero, changeFileLabel: event.target.value })}
            />
          </Field>
          <Field label="Continue-with-file button">
            <input
              value={content.hero.continueSelectedLabel}
              onChange={(event) => update("hero", { ...content.hero, continueSelectedLabel: event.target.value })}
            />
          </Field>
          <Field label="Or label">
            <input value={content.hero.orLabel} onChange={(event) => update("hero", { ...content.hero, orLabel: event.target.value })} />
          </Field>
          <Field label="Google button">
            <input value={content.hero.googleLabel} onChange={(event) => update("hero", { ...content.hero, googleLabel: event.target.value })} />
          </Field>
        </div>
        <Field label="Fine print">
          <input value={content.hero.finePrint} onChange={(event) => update("hero", { ...content.hero, finePrint: event.target.value })} />
        </Field>
        <Field label="AI progress card">
          <input value={content.hero.aiCard} onChange={(event) => update("hero", { ...content.hero, aiCard: event.target.value })} />
        </Field>
        <h3>Floating job cards</h3>
        {content.hero.jobs.map((job, index) => (
          <div className="admin-grid" key={job.id}>
            <Field label="Job title">
              <input
                value={job.title}
                onChange={(event) => {
                  const jobs = content.hero.jobs.slice();
                  jobs[index] = { ...job, title: event.target.value };
                  update("hero", { ...content.hero, jobs });
                }}
              />
            </Field>
            <Field label="Company">
              <input
                value={job.company}
                onChange={(event) => {
                  const jobs = content.hero.jobs.slice();
                  jobs[index] = { ...job, company: event.target.value };
                  update("hero", { ...content.hero, jobs });
                }}
              />
            </Field>
            <Field label="Logo (spotify / hubspot / notion)">
              <input
                value={job.logo}
                onChange={(event) => {
                  const jobs = content.hero.jobs.slice();
                  jobs[index] = { ...job, logo: event.target.value as typeof job.logo };
                  update("hero", { ...content.hero, jobs });
                }}
              />
            </Field>
            <Field label="Status (match / applying / applied)">
              <input
                value={job.status}
                onChange={(event) => {
                  const jobs = content.hero.jobs.slice();
                  jobs[index] = { ...job, status: event.target.value as typeof job.status };
                  update("hero", { ...content.hero, jobs });
                }}
              />
            </Field>
            <Field label="Match %">
              <input
                type="number"
                value={job.match}
                onChange={(event) => {
                  const jobs = content.hero.jobs.slice();
                  jobs[index] = { ...job, match: Number(event.target.value) || 0 };
                  update("hero", { ...content.hero, jobs });
                }}
              />
            </Field>
          </div>
        ))}
      </section>

      <section className="admin-card" id="home-trust">
        <h2>Trust strip</h2>
        {content.trust.items.map((item, index) => (
          <div className="admin-grid" key={`trust-${index}`}>
            <Field label="Icon (shield / check / lock / eye)">
              <input
                value={item.icon}
                onChange={(event) => {
                  const items = content.trust.items.slice();
                  items[index] = { ...item, icon: event.target.value as typeof item.icon };
                  update("trust", { items });
                }}
              />
            </Field>
            <Field label="Title">
              <input
                value={item.title}
                onChange={(event) => {
                  const items = content.trust.items.slice();
                  items[index] = { ...item, title: event.target.value };
                  update("trust", { items });
                }}
              />
            </Field>
            <Field label="Text">
              <input
                value={item.text}
                onChange={(event) => {
                  const items = content.trust.items.slice();
                  items[index] = { ...item, text: event.target.value };
                  update("trust", { items });
                }}
              />
            </Field>
          </div>
        ))}
      </section>

      <section className="admin-card" id="home-stats">
        <h2>Stats</h2>
        {content.stats.map((stat, index) => (
          <div className="admin-grid" key={`stat-${index}`}>
            <Field label="Icon (briefcase / users / star / shield)">
              <input
                value={stat.icon}
                onChange={(event) => {
                  const stats = content.stats.slice();
                  stats[index] = { ...stat, icon: event.target.value as typeof stat.icon };
                  update("stats", stats);
                }}
              />
            </Field>
            <Field label="Value">
              <input
                value={stat.value}
                onChange={(event) => {
                  const stats = content.stats.slice();
                  stats[index] = { ...stat, value: event.target.value };
                  update("stats", stats);
                }}
              />
            </Field>
            <Field label="Label">
              <input
                value={stat.label}
                onChange={(event) => {
                  const stats = content.stats.slice();
                  stats[index] = { ...stat, label: event.target.value };
                  update("stats", stats);
                }}
              />
            </Field>
          </div>
        ))}
      </section>

      <section className="admin-card" id="home-how">
        <h2>How it works</h2>
        <Field label="Eyebrow">
          <input value={content.how.eyebrow} onChange={(event) => update("how", { ...content.how, eyebrow: event.target.value })} />
        </Field>
        <Field label="Title">
          <input value={content.how.title} onChange={(event) => update("how", { ...content.how, title: event.target.value })} />
        </Field>
        {content.how.steps.map((step, index) => (
          <div className="admin-grid" key={`how-${index}`}>
            <Field label="Icon (file / search / plane / spark)">
              <input
                value={step.icon}
                onChange={(event) => {
                  const steps = content.how.steps.slice();
                  steps[index] = { ...step, icon: event.target.value as typeof step.icon };
                  update("how", { ...content.how, steps });
                }}
              />
            </Field>
            <Field label="Step title">
              <input
                value={step.title}
                onChange={(event) => {
                  const steps = content.how.steps.slice();
                  steps[index] = { ...step, title: event.target.value };
                  update("how", { ...content.how, steps });
                }}
              />
            </Field>
            <Field label="Step text">
              <input
                value={step.text}
                onChange={(event) => {
                  const steps = content.how.steps.slice();
                  steps[index] = { ...step, text: event.target.value };
                  update("how", { ...content.how, steps });
                }}
              />
            </Field>
          </div>
        ))}
      </section>

      <section className="admin-card" id="home-fit">
        <h2>Job fit section</h2>
        <Field label="Eyebrow">
          <input value={content.fit.eyebrow} onChange={(event) => update("fit", { ...content.fit, eyebrow: event.target.value })} />
        </Field>
        <Field label="Title">
          <input value={content.fit.title} onChange={(event) => update("fit", { ...content.fit, title: event.target.value })} />
        </Field>
        <Field label="Supporting text">
          <textarea rows={2} value={content.fit.lede} onChange={(event) => update("fit", { ...content.fit, lede: event.target.value })} />
        </Field>
        <div className="admin-grid">
          <Field label="Demo role title">
            <input
              value={content.fit.demo.title}
              onChange={(event) => update("fit", { ...content.fit, demo: { ...content.fit.demo, title: event.target.value } })}
            />
          </Field>
          <Field label="Demo company">
            <input
              value={content.fit.demo.company}
              onChange={(event) => update("fit", { ...content.fit, demo: { ...content.fit.demo, company: event.target.value } })}
            />
          </Field>
          <Field label="Match score">
            <input
              type="number"
              value={content.fit.demo.score}
              onChange={(event) =>
                update("fit", { ...content.fit, demo: { ...content.fit.demo, score: Number(event.target.value) || 0 } })
              }
            />
          </Field>
          <Field label="Match label">
            <input
              value={content.fit.demo.label}
              onChange={(event) => update("fit", { ...content.fit, demo: { ...content.fit.demo, label: event.target.value } })}
            />
          </Field>
        </div>
        <Field label="Meta chips (one per line)">
          <textarea
            rows={3}
            value={content.fit.demo.meta.join("\n")}
            onChange={(event) => update("fit", { ...content.fit, demo: { ...content.fit.demo, meta: parseLines(event.target.value) } })}
          />
        </Field>
        <Field label="Why you match (one per line)">
          <textarea
            rows={3}
            value={content.fit.demo.why.join("\n")}
            onChange={(event) => update("fit", { ...content.fit, demo: { ...content.fit.demo, why: parseLines(event.target.value) } })}
          />
        </Field>
        <Field label="Gaps to watch (one per line)">
          <textarea
            rows={3}
            value={content.fit.demo.gaps.join("\n")}
            onChange={(event) => update("fit", { ...content.fit, demo: { ...content.fit.demo, gaps: parseLines(event.target.value) } })}
          />
        </Field>
      </section>

      <section className="admin-card" id="home-efficiency">
        <h2>Efficiency section</h2>
        <Field label="Eyebrow">
          <input
            value={content.efficiency.eyebrow}
            onChange={(event) => update("efficiency", { ...content.efficiency, eyebrow: event.target.value })}
          />
        </Field>
        <Field label="Title">
          <input
            value={content.efficiency.title}
            onChange={(event) => update("efficiency", { ...content.efficiency, title: event.target.value })}
          />
        </Field>
        <Field label="Supporting text">
          <textarea
            rows={2}
            value={content.efficiency.lede}
            onChange={(event) => update("efficiency", { ...content.efficiency, lede: event.target.value })}
          />
        </Field>
        <Field label="Stages (one per line)">
          <textarea
            rows={5}
            value={content.efficiency.stages.join("\n")}
            onChange={(event) => update("efficiency", { ...content.efficiency, stages: parseLines(event.target.value) })}
          />
        </Field>
      </section>

      <section className="admin-card" id="home-better">
        <h2>Resume upscale section</h2>
        <Field label="Eyebrow">
          <input value={content.better.eyebrow} onChange={(event) => update("better", { ...content.better, eyebrow: event.target.value })} />
        </Field>
        <Field label="Title">
          <input value={content.better.title} onChange={(event) => update("better", { ...content.better, title: event.target.value })} />
        </Field>
        <Field label="Supporting text">
          <textarea rows={2} value={content.better.lede} onChange={(event) => update("better", { ...content.better, lede: event.target.value })} />
        </Field>
        <div className="admin-grid">
          <Field label="Before label">
            <input
              value={content.better.beforeLabel || ""}
              onChange={(event) => update("better", { ...content.better, beforeLabel: event.target.value })}
            />
          </Field>
          <Field label="After label">
            <input
              value={content.better.afterLabel || ""}
              onChange={(event) => update("better", { ...content.better, afterLabel: event.target.value })}
            />
          </Field>
        </div>
        <Field label="Before example">
          <textarea
            rows={2}
            value={content.better.before || ""}
            onChange={(event) => update("better", { ...content.better, before: event.target.value })}
          />
        </Field>
        <Field label="After example">
          <textarea
            rows={2}
            value={content.better.after || ""}
            onChange={(event) => update("better", { ...content.better, after: event.target.value })}
          />
        </Field>
        <Field label="Button label">
          <input value={content.better.button} onChange={(event) => update("better", { ...content.better, button: event.target.value })} />
        </Field>
        <Field label="Checklist (one per line)">
          <textarea
            rows={4}
            value={content.better.checks.join("\n")}
            onChange={(event) => update("better", { ...content.better, checks: parseLines(event.target.value) })}
          />
        </Field>
        <Field label="Scribble note">
          <input value={content.better.scribble} onChange={(event) => update("better", { ...content.better, scribble: event.target.value })} />
        </Field>
      </section>

      <section className="admin-card" id="home-results">
        <h2>Results metrics</h2>
        <Field label="Eyebrow">
          <input value={content.results.eyebrow} onChange={(event) => update("results", { ...content.results, eyebrow: event.target.value })} />
        </Field>
        <Field label="Title">
          <input value={content.results.title} onChange={(event) => update("results", { ...content.results, title: event.target.value })} />
        </Field>
        <Field label="Supporting text">
          <textarea
            rows={2}
            value={content.results.lede}
            onChange={(event) => update("results", { ...content.results, lede: event.target.value })}
          />
        </Field>
        {content.results.metrics.map((metric, index) => (
          <div className="admin-grid" key={`metric-${index}`}>
            <Field label="Metric value">
              <input
                value={metric.value}
                onChange={(event) => {
                  const metrics = content.results.metrics.slice();
                  metrics[index] = { ...metric, value: event.target.value };
                  update("results", { ...content.results, metrics });
                }}
              />
            </Field>
            <Field label="Metric label">
              <input
                value={metric.label}
                onChange={(event) => {
                  const metrics = content.results.metrics.slice();
                  metrics[index] = { ...metric, label: event.target.value };
                  update("results", { ...content.results, metrics });
                }}
              />
            </Field>
          </div>
        ))}
      </section>

      <section className="admin-card" id="home-stories">
        <h2>Testimonials / success stories</h2>
        <Field label="Eyebrow">
          <input value={content.stories.eyebrow} onChange={(event) => update("stories", { ...content.stories, eyebrow: event.target.value })} />
        </Field>
        <Field label="Title">
          <input value={content.stories.title} onChange={(event) => update("stories", { ...content.stories, title: event.target.value })} />
        </Field>
        <Field label="Link label">
          <input
            value={content.stories.linkLabel}
            onChange={(event) => update("stories", { ...content.stories, linkLabel: event.target.value })}
          />
        </Field>
        {content.stories.items.map((story, index) => (
          <div key={`story-${index}`} className="admin-subcard">
            <div className="admin-head">
              <h3>Story {index + 1}</h3>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={() => {
                  const items = content.stories.items.filter((_, i) => i !== index);
                  update("stories", { ...content.stories, items: items.length ? items : content.stories.items });
                }}
              >
                Remove
              </button>
            </div>
            {story.avatar ? <img className="admin-preview admin-preview-sm" src={story.avatar} alt="" /> : null}
            <Field label="Name">
              <input
                value={story.name}
                onChange={(event) => {
                  const items = content.stories.items.slice();
                  items[index] = { ...story, name: event.target.value };
                  update("stories", { ...content.stories, items });
                }}
              />
            </Field>
            <Field label="Role">
              <input
                value={story.role}
                onChange={(event) => {
                  const items = content.stories.items.slice();
                  items[index] = { ...story, role: event.target.value };
                  update("stories", { ...content.stories, items });
                }}
              />
            </Field>
            <Field label="Quote">
              <textarea
                rows={3}
                value={story.quote}
                onChange={(event) => {
                  const items = content.stories.items.slice();
                  items[index] = { ...story, quote: event.target.value };
                  update("stories", { ...content.stories, items });
                }}
              />
            </Field>
            <Field label="Portrait">
              <input
                type="file"
                accept="image/*"
                onChange={(event) =>
                  void upload(event.target.files?.[0], (url) => {
                    const items = content.stories.items.slice();
                    items[index] = { ...story, avatar: url };
                    update("stories", { ...content.stories, items });
                  })
                }
              />
            </Field>
          </div>
        ))}
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() =>
            update("stories", {
              ...content.stories,
              items: [...content.stories.items, { name: "New story", role: "Role", quote: "Add a quote…", avatar: "" }],
            })
          }
        >
          Add testimonial
        </button>
      </section>

      <section className="admin-card" id="home-pricing">
        <h2>Pricing teaser</h2>
        <Field label="Eyebrow">
          <input value={content.pricing.eyebrow} onChange={(event) => update("pricing", { ...content.pricing, eyebrow: event.target.value })} />
        </Field>
        <Field label="Title">
          <input value={content.pricing.title} onChange={(event) => update("pricing", { ...content.pricing, title: event.target.value })} />
        </Field>
        <Field label="Supporting text">
          <textarea
            rows={2}
            value={content.pricing.lede}
            onChange={(event) => update("pricing", { ...content.pricing, lede: event.target.value })}
          />
        </Field>
        <div className="admin-grid">
          <Field label="Button label">
            <input
              value={content.pricing.button}
              onChange={(event) => update("pricing", { ...content.pricing, button: event.target.value })}
            />
          </Field>
          <Field label="Button link">
            <input
              value={content.pricing.buttonTo}
              onChange={(event) => update("pricing", { ...content.pricing, buttonTo: event.target.value })}
            />
          </Field>
        </div>
        {content.pricing.plans.map((plan, index) => (
          <div className="admin-grid" key={`plan-${index}`}>
            <Field label="Plan name">
              <input
                value={plan.name}
                onChange={(event) => {
                  const plans = content.pricing.plans.slice();
                  plans[index] = { ...plan, name: event.target.value };
                  update("pricing", { ...content.pricing, plans });
                }}
              />
            </Field>
            <Field label="Price">
              <input
                value={plan.price}
                onChange={(event) => {
                  const plans = content.pricing.plans.slice();
                  plans[index] = { ...plan, price: event.target.value };
                  update("pricing", { ...content.pricing, plans });
                }}
              />
            </Field>
            <Field label="Blurb">
              <input
                value={plan.blurb}
                onChange={(event) => {
                  const plans = content.pricing.plans.slice();
                  plans[index] = { ...plan, blurb: event.target.value };
                  update("pricing", { ...content.pricing, plans });
                }}
              />
            </Field>
          </div>
        ))}
      </section>

      <section className="admin-card" id="home-cta">
        <h2>Closing CTA</h2>
        <Field label="Title">
          <input value={content.cta.title} onChange={(event) => update("cta", { ...content.cta, title: event.target.value })} />
        </Field>
        <Field label="Supporting text">
          <textarea rows={2} value={content.cta.lede} onChange={(event) => update("cta", { ...content.cta, lede: event.target.value })} />
        </Field>
        <div className="admin-grid">
          <Field label="Button label">
            <input value={content.cta.button} onChange={(event) => update("cta", { ...content.cta, button: event.target.value })} />
          </Field>
          <Field label="Scribble note">
            <input value={content.cta.scribble} onChange={(event) => update("cta", { ...content.cta, scribble: event.target.value })} />
          </Field>
        </div>
        {content.cta.items.map((item, index) => (
          <div className="admin-grid" key={`cta-item-${index}`}>
            <Field label="Icon (file / search / plane)">
              <input
                value={item.icon}
                onChange={(event) => {
                  const items = content.cta.items.slice();
                  items[index] = { ...item, icon: event.target.value as typeof item.icon };
                  update("cta", { ...content.cta, items });
                }}
              />
            </Field>
            <Field label="Item label">
              <input
                value={item.label}
                onChange={(event) => {
                  const items = content.cta.items.slice();
                  items[index] = { ...item, label: event.target.value };
                  update("cta", { ...content.cta, items });
                }}
              />
            </Field>
          </div>
        ))}
      </section>

      <section className="admin-card" id="home-footer">
        <h2>Footer</h2>
        <Field label="Copyright">
          <input
            value={content.footer.copyright}
            onChange={(event) => update("footer", { ...content.footer, copyright: event.target.value })}
          />
        </Field>
        {content.footer.links.map((link, index) => (
          <div className="admin-grid" key={`foot-${index}`}>
            <Field label="Footer label">
              <input
                value={link.label}
                onChange={(event) => {
                  const links = content.footer.links.slice();
                  links[index] = { ...link, label: event.target.value };
                  update("footer", { ...content.footer, links });
                }}
              />
            </Field>
            <Field label="Footer link">
              <input
                value={link.to}
                onChange={(event) => {
                  const links = content.footer.links.slice();
                  links[index] = { ...link, to: event.target.value };
                  update("footer", { ...content.footer, links });
                }}
              />
            </Field>
          </div>
        ))}
      </section>

      <div className="admin-sticky-save">
        <button className="btn btn-primary" type="button" onClick={() => void save()}>
          Save homepage
        </button>
      </div>
    </div>
  );
}
