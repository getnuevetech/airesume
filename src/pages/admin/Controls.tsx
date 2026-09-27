import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../api";

type Provider = { id: string; name: string; kind: string; model: string; enabled: boolean; apiKey: string };
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
type Source = { id: string; name: string; kind: string; config: { url?: string }; enabled: boolean; last_pulled_at: number | null };
type Job = { id: string; title: string; company: string; category: string; role: string; verification: string; location: string };

export function AiAdmin() {
  const [data, setData] = useState<AiPayload | null>(null);
  const [error, setError] = useState("");
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
      <p className="lede">Each function is coded in the product. Choose which provider runs it. Built-in rules stay available when a model is offline.</p>
      {error ? <p className="form-error">{error}</p> : null}
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
      <div className="admin-table">
        {data.providers.map((provider) => (
          <article key={provider.id}>
            <div>
              <strong>{provider.name}</strong>
              <p className="role">{provider.kind} · {provider.model} · {provider.enabled ? "On" : "Off"} · {provider.apiKey || "No key"}</p>
            </div>
            <button
              className="text-btn"
              type="button"
              onClick={() => void api(`/api/admin/ai/providers/${provider.id}`, { method: "PATCH", body: JSON.stringify({ enabled: !provider.enabled, name: provider.name, model: provider.model }) }).then(load)}
            >
              {provider.enabled ? "Disable" : "Enable"}
            </button>
          </article>
        ))}
      </div>
      {data.functions.map((item) => {
        const assignment = data.assignments.find((row) => row.function_key === item.key);
        return (
          <section className="admin-card" key={item.key}>
            <h2>{item.label}</h2>
            <p className="role">{item.detail}</p>
            <label className="field">
              <span>Assigned AI</span>
              <select
                value={assignment?.provider_id || ""}
                onChange={(event) =>
                  void api("/api/admin/ai/assignments", {
                    method: "PUT",
                    body: JSON.stringify({ functionKey: item.key, providerId: event.target.value, enabled: true }),
                  }).then(load)
                }
              >
                {data.providers.map((provider) => (
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

export function PlansAdmin() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [features, setFeatures] = useState<{ key: string; label: string }[]>([]);
  const [policy, setPolicy] = useState({ allowUpgrade: true, allowDowngrade: true, allowProration: true, allowRefund: false });
  const [message, setMessage] = useState("");

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
      <p className="lede">What a person can do is decided here. Prices are in cents.</p>
      <section className="admin-card">
        <h2>Upgrade rules</h2>
        <label className="check-row"><input type="checkbox" checked={policy.allowUpgrade} onChange={(event) => setPolicy({ ...policy, allowUpgrade: event.target.checked })} /> Users can upgrade</label>
        <label className="check-row"><input type="checkbox" checked={policy.allowDowngrade} onChange={(event) => setPolicy({ ...policy, allowDowngrade: event.target.checked })} /> Users can downgrade</label>
        <label className="check-row"><input type="checkbox" checked={policy.allowProration} onChange={(event) => setPolicy({ ...policy, allowProration: event.target.checked })} /> Credit unused time on a change</label>
        <label className="check-row"><input type="checkbox" checked={policy.allowRefund} onChange={(event) => setPolicy({ ...policy, allowRefund: event.target.checked })} /> Record a refund on downgrade</label>
        <button className="btn btn-primary btn-sm" type="button" onClick={() => void api("/api/admin/billing-policy", { method: "PUT", body: JSON.stringify(policy) }).then(() => setMessage("Rules saved."))}>Save rules</button>
        {message ? <p className="role">{message}</p> : null}
      </section>
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
          <button className="btn btn-primary btn-sm" type="button" onClick={() => void api(`/api/admin/plans/${plan.id}`, { method: "PUT", body: JSON.stringify(plan) }).then(() => setMessage(`${plan.name} saved.`))}>Save {plan.name}</button>
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

export function JobsAdmin() {
  const [sources, setSources] = useState<Source[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
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

  return (
    <div>
      <h1>Job sources</h1>
      <p className="lede">Jobs enter from the built-in catalog, a JSON feed you control, or a listing you add. Pull runs categorization and verification on each enabled source. The app does not scrape job boards.</p>
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="role">{message}</p> : null}
      <button className="btn btn-primary" type="button" onClick={() => void api<{ results: { name: string; count?: number; error?: string }[] }>("/api/admin/jobs/pull", { method: "POST" }).then((data) => { setMessage(data.results.map((item) => `${item.name}: ${item.error || item.count}`).join(" · ")); return load(); })}>Pull and verify now</button>
      <form className="admin-card" onSubmit={(event) => { event.preventDefault(); void api("/api/admin/job-sources", { method: "POST", body: JSON.stringify({ name, kind: "json", url }) }).then(load); }}>
        <h2>JSON feed</h2>
        <label className="field"><span>Source name</span><input value={name} onChange={(event) => setName(event.target.value)} required /></label>
        <label className="field"><span>Feed URL</span><input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/jobs.json" required /></label>
        <button className="btn btn-ghost" type="submit">Add feed</button>
      </form>
      {sources.map((source) => (
        <p className="role" key={source.id}>{source.name} · {source.kind} · {source.config.url || "no url"} · {source.last_pulled_at ? "pulled" : "not pulled yet"}</p>
      ))}
      <form className="admin-card" onSubmit={(event) => { event.preventDefault(); void api("/api/admin/jobs", { method: "POST", body: JSON.stringify({ title, company, description }) }).then(() => { setTitle(""); setCompany(""); setDescription(""); return load(); }); }}>
        <h2>Add one job</h2>
        <label className="field"><span>Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
        <label className="field"><span>Company</span><input value={company} onChange={(event) => setCompany(event.target.value)} required /></label>
        <label className="field"><span>Description</span><textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
        <button className="btn btn-primary" type="submit">Categorize and save</button>
      </form>
      <div className="admin-table">
        {jobs.map((job) => (
          <article key={job.id}>
            <div>
              <strong>{job.title}</strong>
              <p className="role">{job.company} · {job.category} · {job.role} · {job.verification} · {job.location}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
