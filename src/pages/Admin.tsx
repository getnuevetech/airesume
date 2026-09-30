import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useApp } from "../context/AppContext";
import { useSiteContent } from "../content/siteContent";
import type { User } from "../data";
import { MfaGate, useMfaGate } from "../components/MfaGate";
import { AiAdmin, JobsAdmin, PaymentsAdmin, PlansAdmin } from "./admin/Controls";
import { HomepageEditor } from "./admin/HomepageEditor";
import { LaunchReadinessAdmin } from "./admin/LaunchReadinessAdmin";
import { MfaPolicyAdmin } from "./admin/MfaPolicyAdmin";
import { AccessLevelsAdmin } from "./admin/AccessLevelsAdmin";

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
type AccessLevelOption = { id: string; name: string; isSuper?: boolean };
type AdminTab =
  | "home"
  | "launch"
  | "security"
  | "access"
  | "users"
  | "admins"
  | "employers"
  | "mail"
  | "ai"
  | "plans"
  | "payments"
  | "jobs";

function can(user: User | null | undefined, permission: string) {
  if (!user || user.role !== "admin") return false;
  if (user.isSuperAdmin) return true;
  return Array.isArray(user.permissions) && user.permissions.includes(permission);
}

export function AdminPage() {
  const { user, ready, refresh, notify } = useApp();
  const { content } = useSiteContent();
  const navigate = useNavigate();
  const [tab, setTab] = useState<AdminTab>("home");
  const { needsGate: needsMfaGate, checked: mfaChecked } = useMfaGate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  const visibleTabs = useMemo(() => {
    const all: { id: AdminTab; label: string; allowed: boolean }[] = [
      { id: "home", label: "Homepage", allowed: can(user, "admin.homepage.read") },
      { id: "launch", label: "Launch", allowed: can(user, "admin.launch.read") },
      { id: "security", label: "Security", allowed: can(user, "admin.security.mfa_policy.read") },
      { id: "access", label: "Access levels", allowed: can(user, "admin.access_levels.read") },
      { id: "users", label: "Users", allowed: can(user, "admin.users.read") },
      { id: "admins", label: "Admins", allowed: can(user, "admin.admins.read") },
      { id: "employers", label: "Employers", allowed: can(user, "admin.employers.read") },
      {
        id: "mail",
        label: "Email",
        allowed:
          can(user, "admin.email.read") ||
          can(user, "admin.email.outbox.read") ||
          can(user, "admin.audit.read") ||
          can(user, "admin.audit.costs.read"),
      },
      { id: "ai", label: "AI pipelines", allowed: can(user, "admin.ai.read") },
      { id: "plans", label: "Plans", allowed: can(user, "admin.plans.read") },
      {
        id: "payments",
        label: "Payments",
        allowed: can(user, "admin.payments.gateways.read") || can(user, "admin.payments.events.read"),
      },
      { id: "jobs", label: "Jobs", allowed: can(user, "admin.jobs.read") },
    ];
    return all.filter((item) => item.allowed).map(({ id, label }) => ({ id, label }));
  }, [user]);

  useEffect(() => {
    if (ready && !user) navigate("/signin", { replace: true });
    else if (ready && user && user.role !== "admin") navigate("/signin", { replace: true });
  }, [ready, user, navigate]);

  useEffect(() => {
    if (!visibleTabs.length) return;
    if (!visibleTabs.some((item) => item.id === tab)) setTab(visibleTabs[0].id);
  }, [visibleTabs, tab]);

  if (!ready) return null;
  if (!user || user.role !== "admin") return null;

  async function updateBootstrapPassword(event: FormEvent) {
    event.preventDefault();
    setPasswordError("");
    setPasswordBusy(true);
    try {
      await api("/api/account/password", {
        method: "POST",
        body: JSON.stringify({ current: currentPassword, password: nextPassword }),
      });
      setCurrentPassword("");
      setNextPassword("");
      notify("Admin password updated.");
      await refresh();
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Could not update the password.");
    } finally {
      setPasswordBusy(false);
    }
  }

  if (user.mustChangePassword) {
    return (
      <div className="admin-gate">
        <section className="admin-card">
          <h1>Set your admin password</h1>
          <p className="lede">
            You signed in as Site Admin with the bootstrap password. Choose a new password to open the Admin console.
            This is not the candidate account dashboard.
          </p>
          {passwordError ? <p className="form-error">{passwordError}</p> : null}
          <form onSubmit={(event) => void updateBootstrapPassword(event)}>
            <label className="field">
              <span>Current bootstrap password</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <label className="field">
              <span>New admin password</span>
              <input
                type="password"
                value={nextPassword}
                onChange={(event) => setNextPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            <button className="btn btn-primary btn-sm" type="submit" disabled={passwordBusy}>
              {passwordBusy ? "Saving…" : "Save admin password"}
            </button>
          </form>
          <p className="role">
            <Link to="/">Back to site</Link>
          </p>
        </section>
      </div>
    );
  }

  if (!mfaChecked) return null;

  if (needsMfaGate) {
    return (
      <MfaGate
        title="Admin MFA required"
        lede="Admin access requires an authenticator app. Scan the QR code once, then enter a 6-digit code for this session."
      />
    );
  }

  if (!can(user, "admin.portal.access") || !visibleTabs.length) {
    return (
      <div className="admin-gate">
        <section className="admin-card">
          <h1>No Admin portal access</h1>
          <p className="lede">
            Your account is an admin, but your access level does not include any Admin portal features. Ask a Super Admin to assign a level.
          </p>
          <p className="role">
            Level: {user.accessLevelName || "Unassigned"} · <Link to="/">Back to site</Link>
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <aside className="admin-nav">
        <Link to="/" className="brand">
          {content.brand}
        </Link>
        <p className="role" style={{ color: "#9fb0c5", margin: "0 0 10px", fontSize: 12 }}>
          {user.accessLevelName || "Admin"}
        </p>
        {visibleTabs.map((item) => (
          <button key={item.id} type="button" className={tab === item.id ? "on" : ""} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </aside>
      <main className="admin-main">
        {tab === "home" ? <HomepageEditor /> : null}
        {tab === "launch" ? <LaunchReadinessAdmin /> : null}
        {tab === "security" ? <MfaPolicyAdmin /> : null}
        {tab === "access" ? <AccessLevelsAdmin /> : null}
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
  const { user: me } = useApp();
  const [users, setUsers] = useState<User[]>([]);
  const [levels, setLevels] = useState<AccessLevelOption[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessLevelId, setAccessLevelId] = useState("aal_super");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [plans, setPlans] = useState<{ id: string; name: string }[]>([]);

  async function load() {
    const data = await api<{ users: User[]; levels?: AccessLevelOption[] }>("/api/admin/users");
    setUsers(data.users.filter((person) => person.role === roleFilter));
    if (data.levels?.length) {
      setLevels(data.levels);
      setAccessLevelId((current) => (data.levels?.some((level) => level.id === current) ? current : data.levels?.[0]?.id || current));
    }
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
        body: JSON.stringify({
          name,
          email,
          password,
          role: roleFilter,
          consent,
          accessLevelId: roleFilter === "admin" ? accessLevelId : undefined,
        }),
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
          {roleFilter === "admin" && levels.length ? (
            <label className="field">
              <span>Access level</span>
              <select value={accessLevelId} onChange={(event) => setAccessLevelId(event.target.value)}>
                {levels.map((level) => (
                  <option key={level.id} value={level.id}>
                    {level.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
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
                {person.role === "admin" && person.accessLevelName ? ` · ${person.accessLevelName}` : ""}
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
              {roleFilter === "admin" && levels.length && can(me, "admin.admins.level.write") ? (
                <select
                  value={person.accessLevelId || "aal_super"}
                  onChange={(event) =>
                    void api(`/api/admin/users/${person.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({ accessLevelId: event.target.value }),
                    }).then(load)
                  }
                >
                  {levels.map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.name}
                    </option>
                  ))}
                </select>
              ) : null}
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
              {roleFilter === "user" && can(me, "admin.users.promote_admin") ? (
                <button
                  type="button"
                  className="text-btn"
                  onClick={() =>
                    void api(`/api/admin/users/${person.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({ role: "admin", accessLevelId: levels[0]?.id || "aal_super" }),
                    }).then(load)
                  }
                >
                  Make admin
                </button>
              ) : null}
              {roleFilter === "admin" && can(me, "admin.admins.demote") ? (
                <button
                  type="button"
                  className="text-btn"
                  onClick={() =>
                    void api(`/api/admin/users/${person.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({ role: "user" }),
                    }).then(load)
                  }
                >
                  Make user
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
