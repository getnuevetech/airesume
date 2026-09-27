import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useApp } from "../context/AppContext";
import { defaultHomepage, useSiteContent, type HomepageContent } from "../content/siteContent";
import type { User } from "../data";

type Mail = { id: string; to_email: string; subject: string; body: string };
type Audit = { id: string; function_name: string; provider: string; model: string; status: string; created_at: number };

export function AdminPage() {
  const { user, ready } = useApp();
  const { content } = useSiteContent();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"home" | "users" | "admins" | "mail">("home");

  useEffect(() => {
    if (ready && user?.role !== "admin") navigate("/signin", { replace: true });
  }, [ready, user, navigate]);

  if (!user || user.role !== "admin") return null;

  return (
    <div className="admin-shell">
      <aside className="admin-nav">
        <Link to="/" className="brand">
          {content.brand}
        </Link>
        <button type="button" className={tab === "home" ? "on" : ""} onClick={() => setTab("home")}>
          Homepage
        </button>
        <button type="button" className={tab === "users" ? "on" : ""} onClick={() => setTab("users")}>
          Users
        </button>
        <button type="button" className={tab === "admins" ? "on" : ""} onClick={() => setTab("admins")}>
          Admins
        </button>
        <button type="button" className={tab === "mail" ? "on" : ""} onClick={() => setTab("mail")}>
          Password links
        </button>
      </aside>
      <main className="admin-main">
        {tab === "home" ? <HomepageEditor /> : null}
        {tab === "users" ? <PeopleEditor roleFilter="user" /> : null}
        {tab === "admins" ? <PeopleEditor roleFilter="admin" /> : null}
        {tab === "mail" ? <MailEditor /> : null}
      </main>
    </div>
  );
}

function HomepageEditor() {
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
      setMessage("Homepage saved.");
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
        <h1>Homepage</h1>
        <button className="btn btn-primary" type="button" onClick={() => void save()}>
          Save homepage
        </button>
      </header>
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="role">{message}</p> : null}

      <section className="admin-card">
        <h2>Menu and buttons</h2>
        <label className="field">
          <span>Brand</span>
          <input value={content.brand} onChange={(event) => update("brand", event.target.value)} />
        </label>
        <div className="admin-grid">
          <label className="field">
            <span>Sign in label</span>
            <input value={content.signInLabel} onChange={(event) => update("signInLabel", event.target.value)} />
          </label>
          <label className="field">
            <span>Get started label</span>
            <input value={content.getStartedLabel} onChange={(event) => update("getStartedLabel", event.target.value)} />
          </label>
        </div>
        {content.nav.map((link, index) => (
          <div className="admin-grid" key={`nav-${index}`}>
            <label className="field">
              <span>Menu label</span>
              <input
                value={link.label}
                onChange={(event) => {
                  const nav = content.nav.slice();
                  nav[index] = { ...link, label: event.target.value };
                  update("nav", nav);
                }}
              />
            </label>
            <label className="field">
              <span>Menu link</span>
              <input
                value={link.to}
                onChange={(event) => {
                  const nav = content.nav.slice();
                  nav[index] = { ...link, to: event.target.value };
                  update("nav", nav);
                }}
              />
            </label>
          </div>
        ))}
      </section>

      <section className="admin-card">
        <h2>Hero banner</h2>
        <img className="admin-preview" src={content.hero.image} alt="" />
        <label className="field">
          <span>Replace hero image</span>
          <input
            type="file"
            accept="image/*"
            onChange={(event) =>
              void upload(event.target.files?.[0], (url) => update("hero", { ...content.hero, image: url }))
            }
          />
        </label>
        <label className="field">
          <span>Image description</span>
          <input value={content.hero.imageAlt} onChange={(event) => update("hero", { ...content.hero, imageAlt: event.target.value })} />
        </label>
        <label className="field">
          <span>Eyebrow</span>
          <input value={content.hero.eyebrow} onChange={(event) => update("hero", { ...content.hero, eyebrow: event.target.value })} />
        </label>
        {content.hero.titleLines.map((line, index) => (
          <label className="field" key={`title-${index}`}>
            <span>Headline line {index + 1}</span>
            <input
              value={line}
              onChange={(event) => {
                const titleLines = content.hero.titleLines.slice();
                titleLines[index] = event.target.value;
                update("hero", { ...content.hero, titleLines });
              }}
            />
          </label>
        ))}
        <label className="field">
          <span>Supporting text</span>
          <textarea rows={3} value={content.hero.lede} onChange={(event) => update("hero", { ...content.hero, lede: event.target.value })} />
        </label>
        <label className="field">
          <span>Upload box title</span>
          <input value={content.hero.dropTitle} onChange={(event) => update("hero", { ...content.hero, dropTitle: event.target.value })} />
        </label>
        <label className="field">
          <span>Upload hint</span>
          <input value={content.hero.dropHint} onChange={(event) => update("hero", { ...content.hero, dropHint: event.target.value })} />
        </label>
        <label className="field">
          <span>Upload button</span>
          <input value={content.hero.uploadLabel} onChange={(event) => update("hero", { ...content.hero, uploadLabel: event.target.value })} />
        </label>
        <label className="field">
          <span>Google button</span>
          <input value={content.hero.googleLabel} onChange={(event) => update("hero", { ...content.hero, googleLabel: event.target.value })} />
        </label>
        <label className="field">
          <span>Fine print</span>
          <input value={content.hero.finePrint} onChange={(event) => update("hero", { ...content.hero, finePrint: event.target.value })} />
        </label>
        <label className="field">
          <span>AI card</span>
          <input value={content.hero.aiCard} onChange={(event) => update("hero", { ...content.hero, aiCard: event.target.value })} />
        </label>
        {content.hero.jobs.map((job, index) => (
          <div className="admin-grid" key={job.id}>
            <label className="field">
              <span>Job title</span>
              <input
                value={job.title}
                onChange={(event) => {
                  const jobs = content.hero.jobs.slice();
                  jobs[index] = { ...job, title: event.target.value };
                  update("hero", { ...content.hero, jobs });
                }}
              />
            </label>
            <label className="field">
              <span>Company</span>
              <input
                value={job.company}
                onChange={(event) => {
                  const jobs = content.hero.jobs.slice();
                  jobs[index] = { ...job, company: event.target.value };
                  update("hero", { ...content.hero, jobs });
                }}
              />
            </label>
          </div>
        ))}
      </section>

      <section className="admin-card">
        <h2>Stats, steps, stories, and closing banner</h2>
        {content.stats.map((stat, index) => (
          <div className="admin-grid" key={stat.label}>
            <label className="field">
              <span>Stat</span>
              <input
                value={stat.value}
                onChange={(event) => {
                  const stats = content.stats.slice();
                  stats[index] = { ...stat, value: event.target.value };
                  update("stats", stats);
                }}
              />
            </label>
            <label className="field">
              <span>Label</span>
              <input
                value={stat.label}
                onChange={(event) => {
                  const stats = content.stats.slice();
                  stats[index] = { ...stat, label: event.target.value };
                  update("stats", stats);
                }}
              />
            </label>
          </div>
        ))}
        <label className="field">
          <span>How it works title</span>
          <input value={content.how.title} onChange={(event) => update("how", { ...content.how, title: event.target.value })} />
        </label>
        {content.how.steps.map((step, index) => (
          <div className="admin-grid" key={step.title}>
            <label className="field">
              <span>Step</span>
              <input
                value={step.title}
                onChange={(event) => {
                  const steps = content.how.steps.slice();
                  steps[index] = { ...step, title: event.target.value };
                  update("how", { ...content.how, steps });
                }}
              />
            </label>
            <label className="field">
              <span>Step text</span>
              <input
                value={step.text}
                onChange={(event) => {
                  const steps = content.how.steps.slice();
                  steps[index] = { ...step, text: event.target.value };
                  update("how", { ...content.how, steps });
                }}
              />
            </label>
          </div>
        ))}
        <label className="field">
          <span>Better applications title</span>
          <input value={content.better.title} onChange={(event) => update("better", { ...content.better, title: event.target.value })} />
        </label>
        <label className="field">
          <span>Better applications text</span>
          <textarea rows={2} value={content.better.lede} onChange={(event) => update("better", { ...content.better, lede: event.target.value })} />
        </label>
        <label className="field">
          <span>Checklist, one item per line</span>
          <textarea
            rows={4}
            value={content.better.checks.join("\n")}
            onChange={(event) => update("better", { ...content.better, checks: event.target.value.split("\n").filter(Boolean) })}
          />
        </label>
        {content.stories.items.map((story, index) => (
          <div key={story.name} className="admin-card">
            <label className="field">
              <span>Story name</span>
              <input
                value={story.name}
                onChange={(event) => {
                  const items = content.stories.items.slice();
                  items[index] = { ...story, name: event.target.value };
                  update("stories", { ...content.stories, items });
                }}
              />
            </label>
            <label className="field">
              <span>Role</span>
              <input
                value={story.role}
                onChange={(event) => {
                  const items = content.stories.items.slice();
                  items[index] = { ...story, role: event.target.value };
                  update("stories", { ...content.stories, items });
                }}
              />
            </label>
            <label className="field">
              <span>Quote</span>
              <textarea
                rows={2}
                value={story.quote}
                onChange={(event) => {
                  const items = content.stories.items.slice();
                  items[index] = { ...story, quote: event.target.value };
                  update("stories", { ...content.stories, items });
                }}
              />
            </label>
            <label className="field">
              <span>Portrait</span>
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
            </label>
          </div>
        ))}
        <label className="field">
          <span>Closing headline</span>
          <input value={content.cta.title} onChange={(event) => update("cta", { ...content.cta, title: event.target.value })} />
        </label>
        <label className="field">
          <span>Closing text</span>
          <textarea rows={2} value={content.cta.lede} onChange={(event) => update("cta", { ...content.cta, lede: event.target.value })} />
        </label>
        <label className="field">
          <span>Footer copyright</span>
          <input
            value={content.footer.copyright}
            onChange={(event) => update("footer", { ...content.footer, copyright: event.target.value })}
          />
        </label>
        {content.footer.links.map((link, index) => (
          <div className="admin-grid" key={`foot-${index}`}>
            <label className="field">
              <span>Footer label</span>
              <input
                value={link.label}
                onChange={(event) => {
                  const links = content.footer.links.slice();
                  links[index] = { ...link, label: event.target.value };
                  update("footer", { ...content.footer, links });
                }}
              />
            </label>
            <label className="field">
              <span>Footer link</span>
              <input
                value={link.to}
                onChange={(event) => {
                  const links = content.footer.links.slice();
                  links[index] = { ...link, to: event.target.value };
                  update("footer", { ...content.footer, links });
                }}
              />
            </label>
          </div>
        ))}
      </section>
    </div>
  );
}

function PeopleEditor({ roleFilter }: { roleFilter: "user" | "admin" }) {
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [link, setLink] = useState("");

  async function load() {
    const data = await api<{ users: User[] }>("/api/admin/users");
    setUsers(data.users.filter((person) => person.role === roleFilter));
  }

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
  }, [roleFilter]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ name, email, password, role: roleFilter }),
      });
      setName("");
      setEmail("");
      setPassword("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the account.");
    }
  }

  return (
    <div>
      <h1>{roleFilter === "admin" ? "Admins" : "Users"}</h1>
      {error ? <p className="form-error">{error}</p> : null}
      {link ? <p className="role">Reset link: {link}</p> : null}
      <form className="admin-card admin-grid" onSubmit={create}>
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="field">
          <span>Email</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
        </label>
        <button className="btn btn-primary" type="submit">
          Add {roleFilter}
        </button>
      </form>
      <div className="admin-table">
        {users.map((person) => (
          <article key={person.id}>
            <div>
              <strong>{person.name}</strong>
              <p className="role">
                {person.email} · {person.role} · {person.status} · {person.provider}
              </p>
            </div>
            <div className="admin-actions">
              <button
                type="button"
                className="text-btn"
                onClick={() =>
                  void api(`/api/admin/users/${person.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ status: person.status === "disabled" ? "active" : "disabled" }),
                  }).then(load)
                }
              >
                {person.status === "disabled" ? "Enable" : "Disable"}
              </button>
              {person.provider === "email" ? (
                <button
                  type="button"
                  className="text-btn"
                  onClick={() =>
                    void api<{ link: string }>(`/api/admin/users/${person.id}/reset-link`, { method: "POST" }).then((data) =>
                      setLink(data.link),
                    )
                  }
                >
                  Reset link
                </button>
              ) : null}
              {roleFilter === "user" ? (
                <button
                  type="button"
                  className="text-btn"
                  onClick={() =>
                    void api(`/api/admin/users/${person.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({ role: person.role === "admin" ? "user" : "admin" }),
                    }).then(load)
                  }
                >
                  {person.role === "admin" ? "Make user" : "Make admin"}
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function MailEditor() {
  const [messages, setMessages] = useState<Mail[]>([]);
  const [entries, setEntries] = useState<Audit[]>([]);
  useEffect(() => {
    void api<{ messages: Mail[] }>("/api/admin/outbox").then((data) => setMessages(data.messages));
    void api<{ entries: Audit[] }>("/api/admin/audit").then((data) => setEntries(data.entries));
  }, []);
  return (
    <div>
      <h1>Password links and AI log</h1>
      <p className="lede">Until email delivery is configured, reset links are stored here.</p>
      {messages.map((message) => (
        <article className="admin-card" key={message.id}>
          <strong>{message.subject}</strong>
          <p className="role">{message.to_email}</p>
          <p>{message.body}</p>
        </article>
      ))}
      <h2>AI audit</h2>
      {entries.map((entry) => (
        <p key={entry.id} className="role">
          {entry.function_name} · {entry.provider}/{entry.model} · {entry.status}
        </p>
      ))}
    </div>
  );
}
