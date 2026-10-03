import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../api";

type Provider = { id: string; name: string; kind: string; model: string; enabled: boolean; apiKey: string; hasKey: boolean };
type Assignment = { function_key: string; provider_id: string; enabled: number };
type PromptVersion = {
  id: string;
  version: number;
  body?: string;
  note: string;
  status?: string;
  createdAt?: number;
  publishedAt?: number | null;
  createdBy?: string;
  bodyPreview?: string;
};
type PromptFunction = {
  key: string;
  label: string;
  detail: string;
  defaultBody: string;
  published: PromptVersion | null;
  draft: PromptVersion | null;
  history: PromptVersion[];
};
type AiPayload = {
  functions: { key: string; label: string; detail: string }[];
  providers: Provider[];
  assignments: Assignment[];
  promptRegistryEnabled: boolean;
  silentAutoApplyEnabled: boolean;
  aiTrainingAttestation?: { attested: boolean; at: number | null; note: string };
  prompts: PromptFunction[];
};

export function AiAdmin() {
  const [data, setData] = useState<AiPayload | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState("openai");
  const [model, setModel] = useState("gpt-4o-mini");
  const [apiKey, setApiKey] = useState("");
  const [registryOn, setRegistryOn] = useState(false);
  const [silentOn, setSilentOn] = useState(false);
  const [trainingAttested, setTrainingAttested] = useState(false);
  const [trainingAt, setTrainingAt] = useState<number | null>(null);

  async function load() {
    const payload = await api<AiPayload>("/api/admin/ai");
    setData(payload);
    setRegistryOn(Boolean(payload.promptRegistryEnabled));
    setSilentOn(Boolean(payload.silentAutoApplyEnabled));
    setTrainingAttested(Boolean(payload.aiTrainingAttestation?.attested));
    setTrainingAt(payload.aiTrainingAttestation?.at ?? null);
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

  async function saveSwitches(next: {
    promptRegistryEnabled?: boolean;
    silentAutoApplyEnabled?: boolean;
    aiTrainingAttested?: boolean;
  }) {
    setError("");
    try {
      const result = await api<{
        promptRegistryEnabled: boolean;
        silentAutoApplyEnabled: boolean;
        aiTrainingAttestation?: { attested: boolean; at: number | null; note: string };
      }>("/api/admin/ai/switches", {
        method: "PUT",
        body: JSON.stringify(next),
      });
      setRegistryOn(result.promptRegistryEnabled);
      setSilentOn(result.silentAutoApplyEnabled);
      if (result.aiTrainingAttestation) {
        setTrainingAttested(Boolean(result.aiTrainingAttestation.attested));
        setTrainingAt(result.aiTrainingAttestation.at);
      }
      setMessage(
        [
          result.promptRegistryEnabled ? "Prompt registry on." : "Prompt registry off — code defaults used.",
          result.silentAutoApplyEnabled ? "Silent Auto-Apply on." : "Silent Auto-Apply off — queue Ready only.",
          result.aiTrainingAttestation?.attested
            ? "AI training attestation saved for Admin → Launch."
            : next.aiTrainingAttested === false
              ? "AI training attestation cleared."
              : "",
        ]
          .filter(Boolean)
          .join(" "),
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save switches.");
    }
  }

  if (!data) return <p>{error || "Loading AI pipelines…"}</p>;

  return (
    <div>
      <h1>AI pipelines</h1>
      <p className="lede">Each function is coded in the product. Edit a pipeline’s name, provider, model, and key, or remove it. A disabled pipeline is hidden from every function and cannot run. Functions on a removed or disabled pipeline move to one that is still on.</p>
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="role">{message}</p> : null}

      <section className="admin-card">
        <h2>Platform switches</h2>
        <p className="role">Kill switches default off. Turning Silent Auto-Apply on lets Autopilot transmit when rules and readiness clear — users must still authorize Auto-Apply on their account.</p>
        <label className="check-row">
          <input
            type="checkbox"
            checked={registryOn}
            onChange={(event) => {
              const enabled = event.target.checked;
              setRegistryOn(enabled);
              void saveSwitches({ promptRegistryEnabled: enabled });
            }}
          />
          Versioned prompt registry (use published admin prompts instead of code defaults)
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={silentOn}
            onChange={(event) => {
              const enabled = event.target.checked;
              setSilentOn(enabled);
              void saveSwitches({ silentAutoApplyEnabled: enabled });
            }}
          />
          Silent Auto-Apply (transmit when Autopilot rules and readiness clear)
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={trainingAttested}
            onChange={(event) => {
              const attested = event.target.checked;
              setTrainingAttested(attested);
              void saveSwitches({ aiTrainingAttested: attested });
            }}
          />
          Training on customer data is disabled where each live AI vendor allows it
        </label>
        <p className="role">
          {trainingAttested && trainingAt
            ? `Attested ${new Date(trainingAt).toLocaleString()}. Admin → Launch treats this as recommended Pass.`
            : "Check vendor consoles (OpenAI / Anthropic / Google) before attesting. See docs/AI_GOVERNANCE_CHECKLIST.md."}
        </p>
      </section>

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
        const prompt = data.prompts?.find((row) => row.key === item.key);
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
            {prompt ? (
              <PromptEditor
                prompt={prompt}
                registryOn={registryOn}
                onChanged={load}
                onError={setError}
                onMessage={setMessage}
              />
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function PromptEditor({
  prompt,
  registryOn,
  onChanged,
  onError,
  onMessage,
}: {
  prompt: PromptFunction;
  registryOn: boolean;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
  onMessage: (message: string) => void;
}) {
  const [body, setBody] = useState(prompt.draft?.body || prompt.published?.body || prompt.defaultBody || "");
  const [note, setNote] = useState(prompt.draft?.note || "");

  useEffect(() => {
    setBody(prompt.draft?.body || prompt.published?.body || prompt.defaultBody || "");
    setNote(prompt.draft?.note || "");
  }, [prompt]);

  return (
    <div className="admin-card" style={{ marginTop: "0.75rem", boxShadow: "none" }}>
      <h3>Prompt versions</h3>
      <p className="role">
        {registryOn ? "Registry is on — published text is used at runtime." : "Registry is off — code defaults are used until you turn it on."}
        {prompt.published ? ` Published v${prompt.published.version}.` : " No published version yet."}
        {prompt.draft ? ` Draft v${prompt.draft.version} waiting to publish.` : ""}
      </p>
      <label className="field">
        <span>System prompt</span>
        <textarea rows={8} value={body} onChange={(event) => setBody(event.target.value)} />
      </label>
      <label className="field">
        <span>Note</span>
        <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Why this change" />
      </label>
      <div className="admin-actions">
        <button
          className="btn btn-ghost btn-sm"
          type="button"
          onClick={() => {
            onError("");
            void api(`/api/admin/ai/prompts/${prompt.key}`, {
              method: "PUT",
              body: JSON.stringify({ body, note }),
            })
              .then(() => {
                onMessage(`Draft saved for ${prompt.label}.`);
                return onChanged();
              })
              .catch((err: Error) => onError(err.message));
          }}
        >
          Save draft
        </button>
        <button
          className="btn btn-primary btn-sm"
          type="button"
          onClick={() => {
            onError("");
            void api(`/api/admin/ai/prompts/${prompt.key}`, {
              method: "PUT",
              body: JSON.stringify({ body, note }),
            })
              .then(() => api(`/api/admin/ai/prompts/${prompt.key}/publish`, { method: "POST", body: "{}" }))
              .then(() => {
                onMessage(`Published ${prompt.label}.`);
                return onChanged();
              })
              .catch((err: Error) => onError(err.message));
          }}
        >
          Publish
        </button>
      </div>
      {prompt.history.length ? (
        <div style={{ marginTop: "0.75rem" }}>
          <p className="role">History</p>
          {prompt.history.map((row) => (
            <article key={row.id} style={{ display: "flex", gap: "0.75rem", alignItems: "center", justifyContent: "space-between", marginTop: "0.35rem" }}>
              <p className="role" style={{ margin: 0 }}>
                v{row.version} · {row.status}
                {row.note ? ` · ${row.note}` : ""}
              </p>
              {row.status !== "published" ? (
                <button
                  className="text-btn"
                  type="button"
                  onClick={() => {
                    onError("");
                    void api(`/api/admin/ai/prompts/${prompt.key}/rollback`, {
                      method: "POST",
                      body: JSON.stringify({ versionId: row.id }),
                    })
                      .then(() => {
                        onMessage(`Rolled ${prompt.label} back to v${row.version}.`);
                        return onChanged();
                      })
                      .catch((err: Error) => onError(err.message));
                  }}
                >
                  Rollback
                </button>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
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
  features: { profile_edit: true, job_limit: 5, template_limit: 2, match_explain_limit: 5, resume_review_limit: 3 } as Record<string, boolean | number>,
};

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
type Source = {
  id: string;
  name: string;
  kind: string;
  config: FeedConfig;
  enabled: boolean;
  lastPulledAt: number | null;
  lastPullStatus?: string;
  lastPullMessage?: string;
};
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
        <label className="field"><span>Resume reviews / week, 0 for unlimited</span><input type="number" min={0} value={Number(draft.features.resume_review_limit ?? 3)} onChange={(event) => setDraft({ ...draft, features: { ...draft.features, resume_review_limit: Number(event.target.value) } })} /></label>
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
          <label className="field"><span>Resume reviews / week, 0 for unlimited</span><input type="number" min={0} value={Number(plan.features.resume_review_limit ?? 3)} onChange={(event) => updatePlan(plan.id, { features: { ...plan.features, resume_review_limit: Number(event.target.value) } })} /></label>
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
      <p className="lede">Stripe and PayPal charge when their keys are present. Manual ledger activates the plan and records proration or refunds for you to pay out. Live card gateways stay off until signed webhooks exist.</p>
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

function originLabel(origin: string) {
  if (origin === "paste") return "Added by a candidate";
  if (origin === "feed") return "Feed";
  if (origin === "extension") return "Browser extension";
  if (origin === "admin") return "Admin entry";
  return origin;
}

export function JobsAdmin() {
  const [sources, setSources] = useState<Source[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [holds, setHolds] = useState<{ id: string; title: string; company: string; location: string; description: string; sourceUrl: string; origin: string; reason: string }[]>([]);
  const [hints, setHints] = useState<string[]>([]);
  const [exampleFeeds, setExampleFeeds] = useState<{ name: string; url: string; detail?: string }[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [feed, setFeed] = useState(blankFeed);
  const [filter, setFilter] = useState("all");
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [description, setDescription] = useState("");
  const [pullingId, setPullingId] = useState<string | "all" | "">("");
  const [pullResults, setPullResults] = useState<Record<string, { status: string; message: string }>>({});
  const [examplesBusy, setExamplesBusy] = useState(false);

  async function load() {
    const data = await api<{
      sources: Source[];
      jobs: Job[];
      hints?: string[];
      exampleFeeds?: { name: string; url: string; detail?: string }[];
      holds?: { id: string; title: string; company: string; location: string; description: string; sourceUrl: string; origin: string; reason: string }[];
    }>("/api/admin/jobs");
    setSources(data.sources);
    setJobs(data.jobs);
    setHolds(data.holds || []);
    setHints(data.hints || []);
    setExampleFeeds(data.exampleFeeds || []);
    setPullResults((current) => {
      const next = { ...current };
      for (const source of data.sources) {
        if (!source.lastPullStatus && !source.lastPullMessage) continue;
        if (next[source.id]?.status === "pulling") continue;
        next[source.id] = {
          status: source.lastPullStatus || (source.lastPullMessage ? "ok" : ""),
          message: source.lastPullMessage || "",
        };
      }
      return next;
    });
  }

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
  }, []);

  const visible = filter === "all" ? jobs : jobs.filter((job) => job.sourceId === filter);

  async function pull(sourceId?: string) {
    setError("");
    setMessage("");
    setPullingId(sourceId || "all");
    if (sourceId) {
      setPullResults((current) => ({ ...current, [sourceId]: { status: "pulling", message: "Pulling…" } }));
    } else {
      setPullResults((current) => {
        const next = { ...current };
        for (const source of sources) {
          if (source.enabled && (source.kind === "json" || source.kind === "rss")) {
            next[source.id] = { status: "pulling", message: "Pulling…" };
          }
        }
        return next;
      });
    }
    try {
      const data = await api<{
        results: { id: string; name: string; count?: number; error?: string; status?: string; message?: string }[];
        message?: string;
      }>("/api/admin/jobs/pull", {
        method: "POST",
        body: JSON.stringify(sourceId ? { sourceId } : {}),
      });
      const mapped: Record<string, { status: string; message: string }> = {};
      for (const item of data.results) {
        mapped[item.id] = {
          status: item.error ? "error" : item.status || "ok",
          message: item.error || item.message || (item.count != null ? `Pulled ${item.count} jobs.` : "Done."),
        };
      }
      setPullResults((current) => ({ ...current, ...mapped }));
      if (!data.results.length) {
        setMessage(data.message || "No enabled URL feeds to pull.");
      } else {
        const failed = data.results.filter((item) => item.error).length;
        const ok = data.results.length - failed;
        setMessage(
          failed
            ? `Pull finished: ${ok} succeeded, ${failed} failed. See each feed card for details.`
            : `Pull finished: ${ok} feed${ok === 1 ? "" : "s"} succeeded. See each feed card for details.`,
        );
      }
      await load();
    } catch (err) {
      const text = err instanceof Error ? err.message : "Pull failed.";
      setError(text);
      if (sourceId) {
        setPullResults((current) => ({ ...current, [sourceId]: { status: "error", message: text } }));
      }
    } finally {
      setPullingId("");
    }
  }

  return (
    <div>
      <h1>Job feeds</h1>
      <p className="lede">
        Use verified public feeds (Remotive, Arbeitnow, RemoteOK, Jobicy) or employer boards (Greenhouse / Lever / Ashby). Indeed, LinkedIn,
        and similar search pages are not supported. Set a default employer when a board omits the company name.
      </p>
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="role">{message}</p> : null}
      <section className="admin-card">
        <h2>Held for review{holds.length ? ` (${holds.length})` : ""}</h2>
        <p className="role">Feed rows and pasted pages that are not real job listings stay here. Add one to the job list, or discard it.</p>
        {holds.length ? holds.map((hold) => (
          <article className="hold-card" key={hold.id}>
            <strong>{hold.title || "Untitled page"}</strong>
            <p className="role">{[hold.company, hold.location, originLabel(hold.origin), hold.sourceUrl].filter(Boolean).join(" · ")}</p>
            <p>{hold.reason}</p>
            {hold.description ? <pre className="hold-preview">{hold.description.slice(0, 700)}</pre> : null}
            <div className="job-actions">
              <button className="btn btn-primary btn-sm" type="button" onClick={() => void api(`/api/admin/jobs/holds/${hold.id}/add`, { method: "POST" }).then(() => { setMessage("Listing added to jobs."); return load(); }).catch((err: Error) => setError(err.message))}>Add</button>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => void api(`/api/admin/jobs/holds/${hold.id}/discard`, { method: "POST" }).then(() => { setMessage("Listing discarded."); return load(); }).catch((err: Error) => setError(err.message))}>Discard</button>
            </div>
          </article>
        )) : <p className="role">Nothing is waiting.</p>}
      </section>
      {hints.length ? (
        <ul className="fact-list">
          {hints.map((hint) => (
            <li key={hint}>{hint}</li>
          ))}
        </ul>
      ) : null}
      <div className="admin-actions" style={{ marginBottom: 12 }}>
        <button className="btn btn-primary" type="button" disabled={Boolean(pullingId)} onClick={() => void pull()}>
          {pullingId === "all" ? "Pulling…" : "Pull enabled feeds"}
        </button>
        <button
          className="btn btn-ghost"
          type="button"
          disabled={examplesBusy}
          onClick={() => {
            setError("");
            setExamplesBusy(true);
            void api<{ message?: string; sources: Source[] }>("/api/admin/job-sources/examples", { method: "POST" })
              .then(async (data) => {
                setMessage(data.message || "Example feeds ready.");
                if (data.sources) setSources(data.sources);
                else await load();
              })
              .catch((err: Error) => setError(err.message))
              .finally(() => setExamplesBusy(false));
          }}
        >
          {examplesBusy ? "Adding…" : "Add verified example feeds"}
        </button>
      </div>
      {exampleFeeds.length ? (
        <div className="admin-card">
          <h2>Verified example feeds</h2>
          <p className="role">These public APIs were checked live. Click “Add verified example feeds” then pull.</p>
          <ul className="fact-list">
            {exampleFeeds.map((item) => (
              <li key={item.url}>
                <strong>{item.name}</strong> · {item.url}
                {item.detail ? ` — ${item.detail}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
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
          <label className="field"><span>Source URL</span><input value={feed.url} onChange={(event) => setFeed({ ...feed, url: event.target.value })} placeholder="https://remotive.com/api/remote-jobs or boards.greenhouse.io/…" required /></label>
          <label className="field">
            <span>Format</span>
            <select value={feed.format} onChange={(event) => setFeed({ ...feed, format: event.target.value })}>
              <option value="auto">Detect JSON, RSS, or public HTML</option>
              <option value="json">JSON</option>
              <option value="rss">RSS or Atom</option>
              <option value="html">Public HTML careers page</option>
            </select>
          </label>
          <label className="field"><span>Default employer if the feed omits one</span><input value={feed.employer} onChange={(event) => setFeed({ ...feed, employer: event.target.value })} /></label>
        </div>
        <FeedAccess feed={feed} secret={feed.secret} onFeed={setFeed} onSecret={(secret) => setFeed({ ...feed, secret })} />
        <button className="btn btn-ghost" type="submit">Add feed</button>
      </form>
      {sources.map((source) => (
        <FeedCard
          key={source.id}
          source={source}
          pullResult={pullResults[source.id]}
          pulling={pullingId === source.id || (pullingId === "all" && pullResults[source.id]?.status === "pulling")}
          onPull={() => pull(source.id)}
          onChanged={load}
          onError={setError}
        />
      ))}
      <form
        className="admin-card"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          void api<{ held?: boolean; message?: string }>("/api/admin/jobs", { method: "POST", body: JSON.stringify({ title, company, description }) })
            .then((result: { held?: boolean; message?: string }) => {
              setTitle("");
              setCompany("");
              setDescription("");
              setMessage(result.held ? (result.message || "Held for review.") : "Job added.");
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
        <label className="field"><span>{feed.authType === "basic" ? "Password" : "Token"}</span><input type="password" value={secret} onChange={(event) => onSecret(event.target.value)} placeholder="Optional public API key only" /></label>
      ) : (
        <p className="role">Public sources should use Access: None. Do not store personal login passwords for job sites.</p>
      )}
    </div>
  );
}

function FeedCard({
  source,
  pullResult,
  pulling,
  onPull,
  onChanged,
  onError,
}: {
  source: Source;
  pullResult?: { status: string; message: string };
  pulling?: boolean;
  onPull: () => Promise<void>;
  onChanged: () => Promise<void>;
  onError: (message: string) => void;
}) {
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
  const status = pullResult?.status || source.lastPullStatus || "";
  const statusMessage = pullResult?.message || source.lastPullMessage || "";

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
      <p className="role">
        {source.kind}
        {source.config.format && source.config.format !== "auto" ? ` · ${source.config.format}` : ""}
        {" · "}{pulled}
        {source.config.hasSecret ? " · access saved" : ""}
      </p>
      {statusMessage ? (
        <p className={status === "error" ? "form-error" : "role"} role={status === "error" ? "alert" : "status"}>
          {status === "pulling" ? "Pulling…" : status === "error" ? `Pull failed: ${statusMessage}` : statusMessage}
        </p>
      ) : null}
      <div className="admin-grid">
        <label className="field"><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} required /></label>
        {remote ? <label className="field"><span>Source URL</span><input value={url} onChange={(event) => setUrl(event.target.value)} required /></label> : null}
        {remote ? (
          <label className="field">
            <span>Format</span>
            <select value={format} onChange={(event) => setFormat(event.target.value)}>
              <option value="auto">Detect JSON, RSS, or public HTML</option>
              <option value="json">JSON</option>
              <option value="rss">RSS or Atom</option>
              <option value="html">Public HTML careers page</option>
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
        {source.kind !== "manual" ? (
          <button className="btn btn-ghost btn-sm" type="button" disabled={pulling} onClick={() => void onPull()}>
            {pulling ? "Pulling…" : "Pull this feed"}
          </button>
        ) : null}
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
