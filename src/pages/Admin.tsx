import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useApp } from "../context/AppContext";
import { useSiteContent } from "../content/siteContent";
import type { User } from "../data";
import { AiAdmin, JobsAdmin, PaymentsAdmin, PlansAdmin } from "./admin/Controls";
import { HomepageEditor } from "./admin/HomepageEditor";

type Mail = { id: string; to_email: string; subject: string; body: string };
type Audit = {
  id: string;
  functionName?: string;
  function_name?: string;
  provider: string;
  model: string;
  status: string;
  createdAt?: number;
  created_at?: number;
  costLabel?: string;
  costMicros?: number;
};
type CostBucket = {
  calls: number;
  costMicros: number;
  costLabel: string;
  byFunction: { functionName: string; calls: number; costMicros: number; costLabel: string }[];
  byProvider: { provider: string; model: string; calls: number; costMicros: number; costLabel: string }[];
};
type AuditSummary = { last24Hours: CostBucket; last7Days: CostBucket; last30Days: CostBucket };

export function AdminPage() {
  const { user, ready, refresh } = useApp();
  const { content } = useSiteContent();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"home" | "users" | "admins" | "employers" | "mail" | "ai" | "plans" | "payments" | "jobs">("home");
  const [mfa, setMfa] = useState<{ required: boolean; enrolled: boolean; verified: boolean } | null>(null);
  const [mfaSetup, setMfaSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaError, setMfaError] = useState("");

  useEffect(() => {
    if (ready && user?.role !== "admin") navigate("/signin", { replace: true });
    if (ready && user?.mustChangePassword) navigate("/account/settings", { replace: true });
  }, [ready, user, navigate]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    void api<{ required: boolean; enrolled: boolean; verified: boolean }>("/api/admin/mfa")
      .then(setMfa)
      .catch((err: Error & { mfaRequired?: boolean; status?: number }) => {
        const message = String(err.message || "");
        if (err.mfaRequired || /mfa/i.test(message)) {
          setMfa({ required: true, enrolled: Boolean(user.mfaEnrolled), verified: Boolean(user.mfaVerified) });
        }
      });
  }, [user]);

  if (!user || user.role !== "admin" || user.mustChangePassword) return null;

  const needsMfaGate = Boolean(mfa?.required && (!mfa.enrolled || !mfa.verified));

  async function setupMfa() {
    setMfaError("");
    try {
      const data = await api<{ secret: string; otpauthUrl: string }>("/api/admin/mfa/setup", { method: "POST", body: "{}" });
      setMfaSetup(data);
    } catch (err) {
      setMfaError(err instanceof Error ? err.message : "MFA setup failed.");
    }
  }

  async function enableOrVerifyMfa() {
    setMfaError("");
    try {
      const path = mfa?.enrolled || user?.mfaEnrolled ? "/api/admin/mfa/verify" : "/api/admin/mfa/enable";
      await api(path, { method: "POST", body: JSON.stringify({ code: mfaCode }) });
      setMfaCode("");
      setMfaSetup(null);
      await refresh();
      const status = await api<{ required: boolean; enrolled: boolean; verified: boolean }>("/api/admin/mfa");
      setMfa(status);
    } catch (err) {
      setMfaError(err instanceof Error ? err.message : "Invalid code.");
    }
  }

  if (needsMfaGate) {
    return (
      <div className="admin-shell">
        <main className="admin-main">
          <section className="admin-card">
            <h1>Admin MFA required</h1>
            <p className="lede">Production admin access requires an authenticator app. Enroll once, then enter a 6-digit code for this session.</p>
            {mfaError ? <p className="form-error">{mfaError}</p> : null}
            {!mfa?.enrolled && !user?.mfaEnrolled ? (
              <button className="btn btn-primary btn-sm" type="button" onClick={() => void setupMfa()}>
                Generate authenticator secret
              </button>
            ) : null}
            {mfaSetup ? (
              <div className="role">
                <p>Secret: <code>{mfaSetup.secret}</code></p>
                <p className="role">otpauth: {mfaSetup.otpauthUrl}</p>
              </div>
            ) : null}
            <label className="field">
              <span>Authenticator code</span>
              <input value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} inputMode="numeric" maxLength={6} />
            </label>
            <button className="btn btn-primary btn-sm" type="button" onClick={() => void enableOrVerifyMfa()}>
              {mfa?.enrolled || user?.mfaEnrolled ? "Verify MFA" : "Enable MFA"}
            </button>
            <p className="role"><Link to="/">Back to site</Link></p>
          </section>
        </main>
      </div>
    );
  }

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
        <button type="button" className={tab === "employers" ? "on" : ""} onClick={() => setTab("employers")}>
          Employers
        </button>
        <button type="button" className={tab === "mail" ? "on" : ""} onClick={() => setTab("mail")}>
          Email
        </button>
        <button type="button" className={tab === "ai" ? "on" : ""} onClick={() => setTab("ai")}>
          AI pipelines
        </button>
        <button type="button" className={tab === "plans" ? "on" : ""} onClick={() => setTab("plans")}>
          Plans
        </button>
        <button type="button" className={tab === "payments" ? "on" : ""} onClick={() => setTab("payments")}>
          Payments
        </button>
        <button type="button" className={tab === "jobs" ? "on" : ""} onClick={() => setTab("jobs")}>
          Jobs
        </button>
      </aside>
      <main className="admin-main">
        {tab === "home" ? <HomepageEditor /> : null}
        {tab === "users" ? <PeopleEditor roleFilter="user" /> : null}
        {tab === "admins" ? <PeopleEditor roleFilter="admin" /> : null}
        {tab === "employers" ? <PeopleEditor roleFilter="employer" /> : null}
        {tab === "mail" ? <MailEditor /> : null}
        {tab === "ai" ? <AiAdmin /> : null}
        {tab === "plans" ? <PlansAdmin /> : null}
        {tab === "payments" ? <PaymentsAdmin /> : null}
        {tab === "jobs" ? <JobsAdmin /> : null}
      </main>
    </div>
  );
}

function PeopleEditor({ roleFilter }: { roleFilter: "user" | "admin" | "employer" }) {
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [plans, setPlans] = useState<{ id: string; name: string }[]>([]);

  async function load() {
    const data = await api<{ users: User[] }>("/api/admin/users");
    setUsers(data.users.filter((person) => person.role === roleFilter));
  }

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
    void api<{ plans: { id: string; name: string }[] }>("/api/plans").then((data) => setPlans(data.plans)).catch(() => undefined);
  }, [roleFilter]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ name, email, password, role: roleFilter, consent }),
      });
      setName("");
      setEmail("");
      setPassword("");
      setConsent(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the account.");
    }
  }

  return (
    <div>
      <h1>{roleFilter === "admin" ? "Admins" : roleFilter === "employer" ? "Employers" : "Users"}</h1>
      {error ? <p className="form-error">{error}</p> : null}
      {link ? <p className="role">Reset link: {link}</p> : null}
      {roleFilter === "employer" ? (
        <p className="lede">Employers create accounts at /employers. Disable an account here if needed.</p>
      ) : (
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
          <label className="check-row terms">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required />
            <span>This person has agreed to the terms.</span>
          </label>
          <button className="btn btn-primary" type="submit">
            Add {roleFilter}
          </button>
        </form>
      )}
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
              <select
                value={person.planId || "free"}
                onChange={(event) =>
                  void api(`/api/admin/users/${person.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({ planId: event.target.value }),
                  }).then(load)
                }
              >
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>
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

type MailSettings = { host: string; port: number; secure: boolean; user: string; fromEmail: string; fromName: string; hasPassword: boolean; configured: boolean };

function MailEditor() {
  const [messages, setMessages] = useState<Mail[]>([]);
  const [entries, setEntries] = useState<Audit[]>([]);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [settings, setSettings] = useState<MailSettings>({ host: "", port: 587, secure: false, user: "", fromEmail: "", fromName: "JobPilot", hasPassword: false, configured: false });
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function load() {
    void api<{ messages: Mail[] }>("/api/admin/outbox").then((data) => setMessages(data.messages));
    void api<{ entries: Audit[]; summary: AuditSummary }>("/api/admin/audit").then((data) => {
      setEntries(data.entries);
      setSummary(data.summary);
    });
    void api<{ settings: MailSettings }>("/api/admin/email").then((data) => setSettings(data.settings)).catch((err: Error) => setError(err.message));
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <h1>Outbound email</h1>
      <p className="lede">Password resets and applications sent to an employer email use these SMTP details. Until a host and from address are saved, messages stay in the list below.</p>
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="role">{message}</p> : null}
      <form
        className="admin-card"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          void api<{ settings: MailSettings }>("/api/admin/email", {
            method: "PUT",
            body: JSON.stringify({ ...settings, password }),
          })
            .then((data) => {
              setSettings(data.settings);
              setPassword("");
              setMessage("Email settings saved.");
            })
            .catch((err: Error) => setError(err.message));
        }}
      >
        <div className="admin-grid">
          <label className="field"><span>SMTP host</span><input value={settings.host} onChange={(event) => setSettings({ ...settings, host: event.target.value })} placeholder="smtp.example.com" /></label>
          <label className="field"><span>Port</span><input type="number" value={settings.port} onChange={(event) => setSettings({ ...settings, port: Number(event.target.value) })} /></label>
          <label className="field"><span>Username</span><input value={settings.user} onChange={(event) => setSettings({ ...settings, user: event.target.value })} /></label>
          <label className="field"><span>Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder={settings.hasPassword ? "Saved. Leave blank to keep it." : ""} /></label>
          <label className="field"><span>From name</span><input value={settings.fromName} onChange={(event) => setSettings({ ...settings, fromName: event.target.value })} /></label>
          <label className="field"><span>From email</span><input type="email" value={settings.fromEmail} onChange={(event) => setSettings({ ...settings, fromEmail: event.target.value })} /></label>
        </div>
        <label className="check-row"><input type="checkbox" checked={settings.secure} onChange={(event) => setSettings({ ...settings, secure: event.target.checked })} /> Use implicit TLS, usually port 465</label>
        <div className="admin-actions">
          <button className="btn btn-primary btn-sm" type="submit">Save email settings</button>
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={() => {
              setError("");
              void api("/api/admin/email/test", { method: "POST", body: "{}" })
                .then(() => setMessage("Test email sent."))
                .catch((err: Error) => setError(err.message));
            }}
          >
            Send a test
          </button>
        </div>
      </form>
      <h2>Sent and stored messages</h2>
      {messages.map((messageItem) => (
        <article className="admin-card" key={messageItem.id}>
          <strong>{messageItem.subject}</strong>
          <p className="role">{messageItem.to_email}</p>
          <p>{messageItem.body}</p>
        </article>
      ))}
      <h2>AI cost summary</h2>
      <p className="lede">Estimated spend from audited model calls. Built-in rules count as $0. Free plans cap resume reviews at 3/week to keep this in check.</p>
      {summary ? (
        <div className="admin-grid">
          {(
            [
              ["Last 24 hours", summary.last24Hours],
              ["Last 7 days", summary.last7Days],
              ["Last 30 days", summary.last30Days],
            ] as [string, CostBucket][]
          ).map(([label, item]) => (
              <article className="admin-card" key={label}>
                <strong>{label}</strong>
                <p className="role">{item.calls} calls · {item.costLabel}</p>
                {item.byFunction.slice(0, 4).map((row) => (
                  <p className="role" key={row.functionName}>
                    {row.functionName}: {row.calls} · {row.costLabel}
                  </p>
                ))}
              </article>
          ))}
        </div>
      ) : null}
      <h2>AI audit</h2>
      {entries.map((entry) => (
        <p key={entry.id} className="role">
          {entry.functionName || entry.function_name} · {entry.provider}/{entry.model} · {entry.status}
          {entry.costLabel ? ` · ${entry.costLabel}` : ""}
        </p>
      ))}
    </div>
  );
}
