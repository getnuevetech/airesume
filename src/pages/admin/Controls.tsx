import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../api";

type Provider = { id: string; name: string; kind: string; model: string; enabled: boolean; apiKey: string; hasKey: boolean };
type Assignment = { function_key: string; provider_id: string; enabled: number };
type AiPayload = { functions: { key: string; label: string; detail: string }[]; providers: Provider[]; assignments: Assignment[] };
type Plan = {
  id: string;
  name: string;
  blurb: string;
  monthlyCents: number;
  yearlyCents: number;
  features: Record<string, boolean | number>;
  popular: boolean;
  active: boolean;
};
type Gateway = { id: string; name: string; kind: string; enabled: boolean; mode: string; publicKey: string; secretKey: string };
type FeedConfig = { url: string; format: string; authType: string; username: string; headerName: string; employer: string; hasSecret: boolean };
type Source = { id: string; name: string; kind: string; config: FeedConfig; enabled: boolean; lastPulledAt: number | null };
type Job = {
  id: string;
  title: string;
  company: string;
  category: string;
  role: string;
  verification: string;
  location: string;
  sourceId: string;
  sourceName: string;
  primaryCompany: string;
  primaryUrl: string;
  primaryEmail: string;
  active: boolean;
};

export function AiAdmin() {
  const [data, setData] = useState<AiPayload | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState("openai");
  const [model, setModel] = useState("gpt-4o-mini");
  const [apiKey, setApiKey] = useState("");

  async function load() {
    setData(await api<AiPayload>("/api/admin/ai"));
  }

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
  }, []);

  async function add(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api("/api/admin/ai/providers", { method: "POST", body: JSON.stringify({ name, kind, model, apiKey, enabled: true }) });
      setName("");
      setApiKey("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the provider.");
    }
  }

  if (!data) return <p>{error || "Loading AI pipelines…"}</p>;

  return (
    <div>
      <h1>AI pipelines</h1>
      <p className="lede">Each function is coded in the product. Edit a pipeline’s name, provider, model, and key, or remove it. A disabled pipeline is hidden from every function and cannot run. Functions on a removed or disabled pipeline move to one that is still on.</p>
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="role">{message}</p> : null}
      <form className="admin-card admin-grid" onSubmit={add}>
        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="field">
          <span>Provider</span>
          <select value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="google">Google</option>
            <option value="deterministic">Built-in rules</option>
          </select>
        </label>
        <label className="field">
          <span>Model</span>
          <input value={model} onChange={(event) => setModel(event.target.value)} required />
        </label>
        <label className="field">
          <span>API key</span>
          <input value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Stored for this provider" />
        </label>
        <button className="btn btn-primary" type="submit">Add AI</button>
      </form>
      {data.providers.map((provider) => (
        <ProviderCard key={provider.id} provider={provider} onChanged={load} onError={setError} onMessage={setMessage} />
      ))}
      {data.functions.map((item) => {
        const choices = data.providers.filter((provider) => provider.enabled);
        const assignment = data.assignments.find((row) => row.function_key === item.key);
        const selected = choices.find((provider) => provider.id === assignment?.provider_id);
        return (
          <section className="admin-card" key={item.key}>
            <h2>{item.label}</h2>
            <p className="role">{item.detail}</p>
            <label className="field">
              <span>Assigned AI</span>
              <select
                value={selected?.id || ""}
                onChange={(event) =>
                  void api("/api/admin/ai/assignments", {
                    method: "PUT",
                    body: JSON.stringify({ functionKey: item.key, providerId: event.target.value, enabled: true }),
                  }).then(load)
                }
              >
                {selected ? null : <option value="">Choose an enabled pipeline</option>}
                {choices.map((provider) => (
                  <option key={provider.id} value={provider.id}>{provider.name}</option>
                ))}
              </select>
            </label>
          </section>
        );
      })}
    </div>
  );
}

function ProviderCard({
  provider,
  onChanged,
  onError,
  onMessage,
}: {
  provider: Provider;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
  onMessage: (message: string) => void;
}) {
  const [name, setName] = useState(provider.name);
  const [kind, setKind] = useState(provider.kind);
  const [model, setModel] = useState(provider.model);
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(provider.enabled);

  useEffect(() => {
    setName(provider.name);
    setKind(provider.kind);
    setModel(provider.model);
    setApiKey("");
    setEnabled(provider.enabled);
  }, [provider]);

  return (
    <form
      className="admin-card"
      onSubmit={(event) => {
        event.preventDefault();
        onError("");
        void api<{ reassigned?: number; fallbackName?: string }>(`/api/admin/ai/providers/${provider.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name, kind, model, apiKey, enabled }),
        })
          .then((result) => {
            const moved = result.reassigned ? ` ${result.reassigned} function${result.reassigned === 1 ? "" : "s"} now use ${result.fallbackName}.` : "";
            onMessage(`${name} saved.${moved}`);
            return onChanged();
          })
          .catch((err: Error) => onError(err.message));
      }}
    >
      <h2>{provider.name}</h2>
      <p className="role">{enabled ? "On" : "Off"} · {provider.hasKey ? "Key saved" : "No key"}</p>
      <div className="admin-grid">
        <label className="field"><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} required /></label>
        <label className="field">
          <span>Provider</span>
          <select value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="google">Google</option>
            <option value="deterministic">Built-in rules</option>
          </select>
        </label>
        <label className="field"><span>Model</span><input value={model} onChange={(event) => setModel(event.target.value)} required /></label>
        {kind === "deterministic" ? null : (
          <label className="field">
            <span>API key</span>
            <input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={provider.hasKey ? "Saved. Leave blank to keep it." : "Stored for this pipeline"} />
          </label>
        )}
      </div>
      <label className="check-row"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Enabled</label>
      <div className="admin-actions">
        <button className="btn btn-primary btn-sm" type="submit">Save pipeline</button>
        <button
          className="text-btn"
          type="button"
          onClick={() => {
            if (!window.confirm(`Remove ${provider.name}? Functions using it will move to another pipeline.`)) return;
            onError("");
            void api<{ reassigned: number; fallbackName: string }>(`/api/admin/ai/providers/${provider.id}`, { method: "DELETE" })
              .then((result) => {
                onMessage(result.reassigned ? `${provider.name} removed. ${result.reassigned} function${result.reassigned === 1 ? "" : "s"} now use ${result.fallbackName}.` : `${provider.name} removed.`);
                return onChanged();
              })
              .catch((err: Error) => onError(err.message));
          }}
        >
          Remove pipeline
        </button>
      </div>
    </form>
  );
}

const emptyPlan = {
  name: "",
  blurb: "",
  monthlyCents: 0,
  yearlyCents: 0,
  popular: false,
  active: true,
  features: { profile_edit: true, job_limit: 5, template_limit: 2, match_explain_limit: 5 } as Record<string, boolean | number>,
};

export function PlansAdmin() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [features, setFeatures] = useState<{ key: string; label: string }[]>([]);
  const [policy, setPolicy] = useState({ allowUpgrade: true, allowDowngrade: true, allowProration: true, allowRefund: false });
  const [draft, setDraft] = useState(emptyPlan);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const data = await api<{ plans: Plan[]; features: { key: string; label: string }[]; policy: typeof policy }>("/api/admin/plans");
    setPlans(data.plans);
    setFeatures(data.features);
    setPolicy(data.policy);
  }

  useEffect(() => {
    void load();
  }, []);

  function updatePlan(id: string, patch: Partial<Plan>) {
    setPlans((current) => current.map((plan) => (plan.id === id ? { ...plan, ...patch } : plan)));
  }

  return (
    <div>
      <h1>Plans and features</h1>
      <p className="lede">Build a plan from the features below. Prices are in cents. A plan can be removed after every account has been moved off it.</p>
      {error ? <p className="form-error">{error}</p> : null}
      <section className="admin-card">
        <h2>Upgrade rules</h2>
        <label className="check-row"><input type="checkbox" checked={policy.allowUpgrade} onChange={(event) => setPolicy({ ...policy, allowUpgrade: event.target.checked })} /> Users can upgrade</label>
        <label className="check-row"><input type="checkbox" checked={policy.allowDowngrade} onChange={(event) => setPolicy({ ...policy, allowDowngrade: event.target.checked })} /> Users can downgrade</label>
        <label className="check-row"><input type="checkbox" checked={policy.allowProration} onChange={(event) => setPolicy({ ...policy, allowProration: event.target.checked })} /> Credit unused time on a change</label>
        <label className="check-row"><input type="checkbox" checked={policy.allowRefund} onChange={(event) => setPolicy({ ...policy, allowRefund: event.target.checked })} /> Record a refund on downgrade</label>
        <button className="btn btn-primary btn-sm" type="button" onClick={() => void api("/api/admin/billing-policy", { method: "PUT", body: JSON.stringify(policy) }).then(() => setMessage("Rules saved."))}>Save rules</button>
        {message ? <p className="role">{message}</p> : null}
      </section>
      <form
        className="admin-card"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          void api("/api/admin/plans", { method: "POST", body: JSON.stringify(draft) })
            .then(() => {
              setDraft(emptyPlan);
              setMessage("Plan added.");
              return load();
            })
            .catch((err: Error) => setError(err.message));
        }}
      >
        <h2>New plan</h2>
        <div className="admin-grid">
          <label className="field"><span>Name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} required /></label>
          <label className="field"><span>Blurb</span><input value={draft.blurb} onChange={(event) => setDraft({ ...draft, blurb: event.target.value })} /></label>
          <label className="field"><span>Monthly cents</span><input type="number" value={draft.monthlyCents} onChange={(event) => setDraft({ ...draft, monthlyCents: Number(event.target.value) })} /></label>
          <label className="field"><span>Yearly cents</span><input type="number" value={draft.yearlyCents} onChange={(event) => setDraft({ ...draft, yearlyCents: Number(event.target.value) })} /></label>
        </div>
        <label className="field"><span>Job list size, 0 for all</span><input type="number" value={Number(draft.features.job_limit || 0)} onChange={(event) => setDraft({ ...draft, features: { ...draft.features, job_limit: Number(event.target.value) } })} /></label>
        <label className="field"><span>Resume templates, 1 to 6</span><input type="number" min={1} max={6} value={Number(draft.features.template_limit || 2)} onChange={(event) => setDraft({ ...draft, features: { ...draft.features, template_limit: Number(event.target.value) } })} /></label>
        <label className="field"><span>Match explanations / week, 0 for unlimited</span><input type="number" min={0} value={Number(draft.features.match_explain_limit ?? 5)} onChange={(event) => setDraft({ ...draft, features: { ...draft.features, match_explain_limit: Number(event.target.value) } })} /></label>
        {features.map((feature) => (
          <label className="check-row" key={feature.key}>
            <input type="checkbox" checked={Boolean(draft.features[feature.key])} onChange={(event) => setDraft({ ...draft, features: { ...draft.features, [feature.key]: event.target.checked } })} />
            {feature.label}
          </label>
        ))}
        <button className="btn btn-primary btn-sm" type="submit">Add plan</button>
      </form>
      {plans.map((plan) => (
        <section className="admin-card" key={plan.id}>
          <div className="admin-grid">
            <label className="field"><span>Name</span><input value={plan.name} onChange={(event) => updatePlan(plan.id, { name: event.target.value })} /></label>
            <label className="field"><span>Blurb</span><input value={plan.blurb} onChange={(event) => updatePlan(plan.id, { blurb: event.target.value })} /></label>
            <label className="field"><span>Monthly cents</span><input type="number" value={plan.monthlyCents} onChange={(event) => updatePlan(plan.id, { monthlyCents: Number(event.target.value) })} /></label>
            <label className="field"><span>Yearly cents</span><input type="number" value={plan.yearlyCents} onChange={(event) => updatePlan(plan.id, { yearlyCents: Number(event.target.value) })} /></label>
          </div>
          <label className="field"><span>Job list size, 0 for all</span><input type="number" value={Number(plan.features.job_limit || 0)} onChange={(event) => updatePlan(plan.id, { features: { ...plan.features, job_limit: Number(event.target.value) } })} /></label>
          <label className="field"><span>Resume templates, 1 to 6</span><input type="number" min={1} max={6} value={Number(plan.features.template_limit || 2)} onChange={(event) => updatePlan(plan.id, { features: { ...plan.features, template_limit: Number(event.target.value) } })} /></label>
          <label className="field"><span>Match explanations / week, 0 for unlimited</span><input type="number" min={0} value={Number(plan.features.match_explain_limit ?? 5)} onChange={(event) => updatePlan(plan.id, { features: { ...plan.features, match_explain_limit: Number(event.target.value) } })} /></label>
          {features.map((feature) => (
            <label className="check-row" key={feature.key}>
              <input
                type="checkbox"
                checked={Boolean(plan.features[feature.key])}
                onChange={(event) => updatePlan(plan.id, { features: { ...plan.features, [feature.key]: event.target.checked } })}
              />
              {feature.label}
            </label>
          ))}
          <label className="check-row"><input type="checkbox" checked={plan.popular} onChange={(event) => updatePlan(plan.id, { popular: event.target.checked })} /> Highlight as popular</label>
          <label className="check-row"><input type="checkbox" checked={plan.active} onChange={(event) => updatePlan(plan.id, { active: event.target.checked })} /> Show this plan to users</label>
          <div className="admin-actions">
            <button className="btn btn-primary btn-sm" type="button" onClick={() => void api(`/api/admin/plans/${plan.id}`, { method: "PUT", body: JSON.stringify(plan) }).then(() => setMessage(`${plan.name} saved.`)).catch((err: Error) => setError(err.message))}>Save {plan.name}</button>
            <button
              className="text-btn"
              type="button"
              onClick={() => {
                if (!window.confirm(`Delete ${plan.name}? Accounts on this plan must be moved first.`)) return;
                setError("");
                void api(`/api/admin/plans/${plan.id}`, { method: "DELETE" }).then(() => { setMessage(`${plan.name} deleted.`); return load(); }).catch((err: Error) => setError(err.message));
              }}
            >
              Delete plan
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}

export function PaymentsAdmin() {
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [events, setEvents] = useState<{ id: string; type: string; from_plan: string; to_plan: string; amount_cents: number; note: string }[]>([]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("stripe");
  const [publicKey, setPublicKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const [gatewayData, eventData] = await Promise.all([
      api<{ gateways: Gateway[] }>("/api/admin/gateways"),
      api<{ events: { id: string; type: string; from_plan: string; to_plan: string; amount_cents: number; note: string }[] }>("/api/admin/billing-events"),
    ]);
    setGateways(gatewayData.gateways);
    setEvents(eventData.events);
  }

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
  }, []);

  async function add(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api("/api/admin/gateways", { method: "POST", body: JSON.stringify({ name, kind, publicKey, secretKey, enabled: true, mode: "test" }) });
      setName("");
      setSecretKey("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the gateway.");
    }
  }

  return (
    <div>
      <h1>Payment gateways</h1>
      <p className="lede">Stripe and PayPal charge when their keys are present. Manual ledger activates the plan and records proration or refunds for you to pay out.</p>
      {error ? <p className="form-error">{error}</p> : null}
      <form className="admin-card admin-grid" onSubmit={add}>
        <label className="field"><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} required /></label>
        <label className="field">
          <span>Type</span>
          <select value={kind} onChange={(event) => setKind(event.target.value)}>
            <option value="stripe">Stripe</option>
            <option value="paypal">PayPal</option>
            <option value="manual">Manual ledger</option>
          </select>
        </label>
        <label className="field"><span>Public key</span><input value={publicKey} onChange={(event) => setPublicKey(event.target.value)} /></label>
        <label className="field"><span>Secret key</span><input value={secretKey} onChange={(event) => setSecretKey(event.target.value)} /></label>
        <button className="btn btn-primary" type="submit">Add gateway</button>
      </form>
      <div className="admin-table">
        {gateways.map((gateway) => (
          <article key={gateway.id}>
            <div>
              <strong>{gateway.name}</strong>
              <p className="role">{gateway.kind} · {gateway.mode} · {gateway.secretKey || "No secret"}</p>
            </div>
            <button className="text-btn" type="button" onClick={() => void api(`/api/admin/gateways/${gateway.id}`, { method: "PATCH", body: JSON.stringify({ enabled: !gateway.enabled, name: gateway.name, publicKey: gateway.publicKey, mode: gateway.mode }) }).then(load)}>
              {gateway.enabled ? "Disable" : "Enable"}
            </button>
          </article>
        ))}
      </div>
      <h2>Ledger</h2>
      {events.map((event) => (
        <p className="role" key={event.id}>{event.type} · {event.from_plan} → {event.to_plan} · ${(event.amount_cents / 100).toFixed(2)} · {event.note}</p>
      ))}
    </div>
  );
}

const blankFeed = { name: "", url: "", format: "auto", authType: "none", username: "", secret: "", headerName: "", employer: "" };

export function JobsAdmin() {
  const [sources, setSources] = useState<Source[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [feed, setFeed] = useState(blankFeed);
  const [filter, setFilter] = useState("all");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [description, setDescription] = useState("");

  async function load() {
    const data = await api<{ sources: Source[]; jobs: Job[] }>("/api/admin/jobs");
    setSources(data.sources);
    setJobs(data.jobs);
  }

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
  }, []);

  const visible = filter === "all" ? jobs : jobs.filter((job) => job.sourceId === filter);

  async function pull(sourceId?: string) {
    setError("");
    try {
      const data = await api<{ results: { name: string; count?: number; error?: string }[] }>("/api/admin/jobs/pull", {
        method: "POST",
        body: JSON.stringify(sourceId ? { sourceId } : {}),
      });
      setMessage(data.results.map((item) => `${item.name}: ${item.error || `${item.count} jobs`}`).join(" · ") || "No feeds to pull.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pull failed.");
    }
  }

  return (
    <div>
      <h1>Job feeds</h1>
      <p className="lede">Add each JSON or RSS feed once. If a site requires access, store the token or username and password on that feed. Pull reads the feed, labels the employer named in the listing, and keeps each job under its feed.</p>
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="role">{message}</p> : null}
      <button className="btn btn-primary" type="button" onClick={() => void pull()}>Pull enabled feeds</button>
      <form
        className="admin-card"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          void api("/api/admin/job-sources", { method: "POST", body: JSON.stringify(feed) })
            .then(() => {
              setFeed(blankFeed);
              setMessage("Feed added.");
              return load();
            })
            .catch((err: Error) => setError(err.message));
        }}
      >
        <h2>Add a feed</h2>
        <div className="admin-grid">
          <label className="field"><span>Name</span><input value={feed.name} onChange={(event) => setFeed({ ...feed, name: event.target.value })} required /></label>
          <label className="field"><span>Feed URL</span><input value={feed.url} onChange={(event) => setFeed({ ...feed, url: event.target.value })} placeholder="https://example.com/jobs.json" required /></label>
          <label className="field">
            <span>Format</span>
            <select value={feed.format} onChange={(event) => setFeed({ ...feed, format: event.target.value })}>
              <option value="auto">Detect JSON or RSS</option>
              <option value="json">JSON</option>
              <option value="rss">RSS or Atom</option>
            </select>
          </label>
          <label className="field"><span>Default employer if the feed omits one</span><input value={feed.employer} onChange={(event) => setFeed({ ...feed, employer: event.target.value })} /></label>
        </div>
        <FeedAccess feed={feed} secret={feed.secret} onFeed={setFeed} onSecret={(secret) => setFeed({ ...feed, secret })} />
        <button className="btn btn-ghost" type="submit">Add feed</button>
      </form>
      {sources.map((source) => (
        <FeedCard key={source.id} source={source} onPull={() => pull(source.id)} onChanged={load} onError={setError} />
      ))}
      <form
        className="admin-card"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          void api("/api/admin/jobs", { method: "POST", body: JSON.stringify({ title, company, description }) })
            .then(() => {
              setTitle("");
              setCompany("");
              setDescription("");
              setMessage("Job added.");
              return load();
            })
            .catch((err: Error) => setError(err.message));
        }}
      >
        <h2>Add one job</h2>
        <label className="field"><span>Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
        <label className="field"><span>Company</span><input value={company} onChange={(event) => setCompany(event.target.value)} required /></label>
        <label className="field"><span>Description</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        <button className="btn btn-primary" type="submit">Categorize and save</button>
      </form>
      <div className="admin-head">
        <h2>Jobs by feed</h2>
        <select value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="all">All feeds</option>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>{source.name}</option>
          ))}
        </select>
      </div>
      <div className="admin-table">
        {visible.map((job) => (
          <article key={job.id}>
            <div>
              <strong>{job.title}</strong>
              <p className="role">
                {job.sourceName} · {job.company}
                {job.primaryCompany && job.primaryCompany.toLowerCase() !== job.company.toLowerCase() ? ` · Apply to ${job.primaryCompany}` : ""}
                {job.primaryEmail ? ` · ${job.primaryEmail}` : ""}
                {" · "}{job.category} · {job.verification}{job.active ? "" : " · hidden"}
              </p>
            </div>
            <button
              className="text-btn"
              type="button"
              onClick={() => {
                if (!window.confirm(`Delete ${job.title} at ${job.company}?`)) return;
                void api(`/api/admin/jobs/${job.id}`, { method: "DELETE" }).then(load).catch((err: Error) => setError(err.message));
              }}
            >
              Delete
            </button>
          </article>
        ))}
        {visible.length ? null : <p className="role">No jobs for this feed yet.</p>}
      </div>
    </div>
  );
}

function FeedAccess<T extends { authType: string; username: string; headerName: string }>({
  feed,
  secret,
  onFeed,
  onSecret,
}: {
  feed: T;
  secret: string;
  onFeed: (next: T) => void;
  onSecret: (secret: string) => void;
}) {
  return (
    <div className="admin-grid">
      <label className="field">
        <span>Access</span>
        <select value={feed.authType} onChange={(event) => onFeed({ ...feed, authType: event.target.value })}>
          <option value="none">No login</option>
          <option value="bearer">API token</option>
          <option value="basic">Username and password</option>
          <option value="header">Custom header</option>
        </select>
      </label>
      {feed.authType === "basic" ? (
        <label className="field"><span>Username</span><input value={feed.username} onChange={(event) => onFeed({ ...feed, username: event.target.value })} /></label>
      ) : null}
      {feed.authType === "header" ? (
        <label className="field"><span>Header name</span><input value={feed.headerName} onChange={(event) => onFeed({ ...feed, headerName: event.target.value })} placeholder="X-Api-Key" /></label>
      ) : null}
      {feed.authType !== "none" ? (
        <label className="field"><span>{feed.authType === "basic" ? "Password" : "Token"}</span><input type="password" value={secret} onChange={(event) => onSecret(event.target.value)} placeholder="Leave blank to keep the saved value" /></label>
      ) : null}
    </div>
  );
}

function FeedCard({ source, onPull, onChanged, onError }: { source: Source; onPull: () => Promise<void>; onChanged: () => Promise<void>; onError: (message: string) => void }) {
  const remote = source.kind === "json" || source.kind === "rss";
  const [name, setName] = useState(source.name);
  const [url, setUrl] = useState(source.config.url);
  const [format, setFormat] = useState(source.config.format || "auto");
  const [authType, setAuthType] = useState(source.config.authType || "none");
  const [username, setUsername] = useState(source.config.username);
  const [headerName, setHeaderName] = useState(source.config.headerName);
  const [employer, setEmployer] = useState(source.config.employer);
  const [enabled, setEnabled] = useState(source.enabled);
  const [secret, setSecret] = useState("");

  useEffect(() => {
    setName(source.name);
    setUrl(source.config.url);
    setFormat(source.config.format || "auto");
    setAuthType(source.config.authType || "none");
    setUsername(source.config.username);
    setHeaderName(source.config.headerName);
    setEmployer(source.config.employer);
    setEnabled(source.enabled);
    setSecret("");
  }, [source]);

  const pulled = source.lastPulledAt ? new Date(source.lastPulledAt).toLocaleString() : "not pulled yet";

  return (
    <form
      className="admin-card"
      onSubmit={(event) => {
        event.preventDefault();
        void api(`/api/admin/job-sources/${source.id}`, {
          method: "PUT",
          body: JSON.stringify({ name, url, format, authType, username, headerName, employer, enabled, secret }),
        }).then(onChanged).catch((err: Error) => onError(err.message));
      }}
    >
      <h2>{source.name}</h2>
      <p className="role">{source.kind} · {pulled}{source.config.hasSecret ? " · access saved" : ""}</p>
      <div className="admin-grid">
        <label className="field"><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} required /></label>
        {remote ? <label className="field"><span>Feed URL</span><input value={url} onChange={(event) => setUrl(event.target.value)} required /></label> : null}
        {remote ? (
          <label className="field">
            <span>Format</span>
            <select value={format} onChange={(event) => setFormat(event.target.value)}>
              <option value="auto">Detect JSON or RSS</option>
              <option value="json">JSON</option>
              <option value="rss">RSS or Atom</option>
            </select>
          </label>
        ) : null}
        {remote ? <label className="field"><span>Default employer</span><input value={employer} onChange={(event) => setEmployer(event.target.value)} /></label> : null}
      </div>
      {remote ? (
        <FeedAccess
          feed={{ authType, username, headerName }}
          secret={secret}
          onFeed={(next) => {
            setAuthType(next.authType);
            setUsername(next.username);
            setHeaderName(next.headerName);
          }}
          onSecret={setSecret}
        />
      ) : null}
      <label className="check-row"><input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /> Include in Pull enabled feeds</label>
      <div className="admin-actions">
        <button className="btn btn-primary btn-sm" type="submit">Save feed</button>
        {source.kind !== "manual" ? <button className="btn btn-ghost btn-sm" type="button" onClick={() => void onPull()}>Pull this feed</button> : null}
        <button
          className="text-btn"
          type="button"
          onClick={() => {
            if (!window.confirm(`Remove ${source.name} and its jobs?`)) return;
            void api(`/api/admin/job-sources/${source.id}`, { method: "DELETE" }).then(onChanged).catch((err: Error) => onError(err.message));
          }}
        >
          Remove feed
        </button>
      </div>
    </form>
  );
}
