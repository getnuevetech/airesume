import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useApp } from "../context/AppContext";

type Employment = { title: string; employer: string; dates?: string; bullets: string[] };
type Recommendation = { id: string; title: string; detail: string; kind: string; proposed?: string };
type DashJob = {
  id: string;
  title: string;
  company: string;
  location: string;
  remoteType: string;
  salaryMin: number | null;
  salaryMax: number | null;
  category: string;
  verification: string;
  description: string;
  score: number;
  matched: string[];
  missing: string[];
  applied: boolean;
};
type DashboardData = {
  profile: {
    headline: string;
    summary: string;
    skills: string[];
    employment: Employment[];
    education: string[];
    preferences: { salary?: string; workArrangement?: string; locations?: string; workAuthorization?: string };
    resumeName: string;
    photoUrl: string;
    slug: string;
    shareContact: boolean;
  } | null;
  plan: { id: string; name: string; monthlyCents: number; yearlyCents: number };
  features: Record<string, boolean | number>;
  policy: { allowUpgrade: boolean; allowDowngrade: boolean; allowProration: boolean; allowRefund: boolean };
  plans: { id: string; name: string; blurb: string; monthlyCents: number; yearlyCents: number; popular: boolean }[];
  gateways: { id: string; name: string; kind: string }[];
  autoApply: boolean;
  autoMin: number;
  stats: { resumeRating: number | null; applied: number; responded: number; available: number; recommended: number; versions: number };
  jobs: DashJob[];
  applications: { id: string; title: string; company: string; status: string; mode: string; match: number }[];
  review: { id: string; rating: number; feedback: string[]; recommendations: Recommendation[]; provider: string; model: string } | null;
  versions: { id: string; label: string; kind: string; active: boolean; rendered: string }[];
};

const STATUSES = ["Applied", "Responded", "Interview", "Offer", "Rejected", "Withdrawn"];

export function DashboardPage() {
  const { user, refresh } = useApp();
  const [params, setParams] = useSearchParams();
  const [data, setData] = useState<DashboardData | null>(null);
  const [tab, setTab] = useState<"overview" | "profile" | "resume" | "jobs" | "billing">("overview");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [gatewayId, setGatewayId] = useState("");

  async function load() {
    const next = await api<DashboardData>("/api/dashboard");
    setData(next);
    if (!gatewayId && next.gateways[0]) setGatewayId(next.gateways[0].id);
  }

  useEffect(() => {
    if (!user) return;
    if (params.get("view") === "billing") setTab("billing");
    void load().catch((err: Error) => setError(err.message));
  }, [user]);

  useEffect(() => {
    const checkoutId = params.get("checkout_id");
    if (params.get("checkout") === "success" && checkoutId) {
      void api("/api/billing/confirm", { method: "POST", body: JSON.stringify({ checkoutId }) })
        .then(() => refresh())
        .then(load)
        .then(() => setMessage("Plan updated."))
        .catch((err: Error) => setError(err.message));
      setParams({}, { replace: true });
      setTab("billing");
    }
  }, [params, refresh, setParams]);

  if (!user) {
    return (
      <div className="container page-hero">
        <h1>Sign in to open your dashboard.</h1>
        <Link className="btn btn-primary btn-lg" to="/signin">Sign in</Link>
      </div>
    );
  }
  if (!data) {
    return <div className="container page-hero"><h1>{error || "Loading your dashboard."}</h1></div>;
  }
  if (!data.profile) {
    return (
      <div className="container page-hero">
        <p className="eyebrow">Dashboard</p>
        <h1>Upload a resume to build your account.</h1>
        <Link className="btn btn-primary btn-lg" to="/get-started">Upload Resume</Link>
      </div>
    );
  }

  const features = data.features;
  const first = user.name.split(" ")[0];
  const allowed = (key: string) => Boolean(features[key]);

  return (
    <div className="container dash">
      <header className="dash-head">
        <div>
          <p className="eyebrow">{data.plan.name}</p>
          <h1>{first}, here is your search.</h1>
          <p className="lede">Resume rating, matches, and applications stay in one place. Changes to the resume are saved as versions you can choose.</p>
        </div>
        {data.profile.photoUrl ? <img className="dash-photo" src={data.profile.photoUrl} alt="" /> : null}
      </header>
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="role">{message}</p> : null}
      <div className="stat-grid">
        <Stat label="Resume rating" value={data.stats.resumeRating === null ? "—" : String(data.stats.resumeRating)} />
        <Stat label="Recommended jobs" value={String(data.stats.recommended)} />
        <Stat label="Available jobs" value={String(data.stats.available)} />
        <Stat label="Applied" value={String(data.stats.applied)} />
        <Stat label="Responses" value={String(data.stats.responded)} />
        <Stat label="Resume versions" value={String(data.stats.versions)} />
      </div>
      <div className="cta-grid">
        <button type="button" className="btn btn-primary" onClick={() => setTab("resume")} disabled={!allowed("resume_review")}>Review resume</button>
        <button type="button" className="btn btn-ghost" onClick={() => setTab("profile")}>Edit profile</button>
        <button type="button" className="btn btn-ghost" onClick={() => setTab("jobs")} disabled={!allowed("job_browse")}>See tailored jobs</button>
        <button type="button" className="btn btn-ghost" onClick={() => setTab("billing")}>Change plan</button>
        {allowed("public_profile") && data.profile.slug ? (
          <Link className="btn btn-ghost" to={`/resume/${data.profile.slug}`}>Open public resume</Link>
        ) : null}
      </div>
      <div className="dash-tabs">
        {([
          ["overview", "Overview"],
          ["profile", "Profile"],
          ["resume", "Resume"],
          ["jobs", "Jobs"],
          ["billing", "Plan"],
        ] as const).map(([item, label]) => (
          <button key={item} type="button" className={tab === item ? "on" : ""} onClick={() => setTab(item)}>{label}</button>
        ))}
      </div>

      {tab === "overview" ? (
        <section className="dash-grid">
          <article className="panel">
            <h2>{data.profile.headline || user.name}</h2>
            <p>{data.profile.summary}</p>
            <div className="chips">{data.profile.skills.slice(0, 8).map((skill) => <span className="chip" key={skill}>{skill}</span>)}</div>
            <p className="role">{data.profile.resumeName}</p>
          </article>
          <article className="panel">
            <h2>Applications</h2>
            {data.applications.length ? data.applications.map((item) => (
              <p key={item.id}><strong>{item.title}</strong> · {item.company} · {item.status} · {item.match}%</p>
            )) : <p className="role">No applications yet. Recommended roles are on the Jobs tab.</p>}
          </article>
        </section>
      ) : null}

      {tab === "profile" ? (
        <ProfileForm
          user={user}
          profile={data.profile}
          canEnhance={allowed("image_enhance")}
          onSaved={() => { setMessage("Profile saved."); void load(); void refresh(); }}
        />
      ) : null}

      {tab === "resume" ? (
        <section>
          {!allowed("resume_review") ? <p>Your plan does not include resume review.</p> : null}
          <button className="btn btn-primary" type="button" disabled={!allowed("resume_review")} onClick={() => void api("/api/resume/review", { method: "POST" }).then(load).catch((err: Error) => setError(err.message))}>
            Analyze resume
          </button>
          {data.review ? (
            <article className="panel activity-panel">
              <h2>Rating {data.review.rating}</h2>
              <p className="role">{data.review.provider} · {data.review.model}</p>
              {data.review.feedback.map((line) => <p key={line}>{line}</p>)}
              {data.review.recommendations.map((item) => (
                <label className="check-row" key={item.id}>
                  {item.kind === "rewrite" ? (
                    <input type="checkbox" checked={selected.includes(item.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} />
                  ) : <input type="checkbox" disabled />}
                  <span><strong>{item.title}</strong> {item.detail} {item.proposed ? <em>Proposed: {item.proposed}</em> : null}</span>
                </label>
              ))}
              <button
                className="btn btn-primary btn-sm"
                type="button"
                disabled={!allowed("resume_upscale") || !selected.length}
                onClick={() => void api("/api/resume/apply", { method: "POST", body: JSON.stringify({ reviewId: data.review?.id, recommendationIds: selected }) }).then(() => { setSelected([]); setMessage("A new resume version is ready."); return load(); }).catch((err: Error) => setError(err.message))}
              >
                {allowed("resume_upscale") ? "Apply selected and create a version" : "Upscale is not on this plan"}
              </button>
            </article>
          ) : <p className="role">Run an analysis to see feedback.</p>}
          <div className="version-list">
            {data.versions.map((version) => (
              <article className="panel" key={version.id}>
                <h2>{version.label} {version.active ? "· Public" : ""}</h2>
                <pre>{version.rendered}</pre>
                {!version.active ? (
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => void api(`/api/resume/versions/${version.id}/activate`, { method: "POST" }).then(() => { setMessage("That version is now your public resume."); return load(); })}>Use this version</button>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {tab === "jobs" ? (
        <section>
          {allowed("auto_apply") ? (
            <AutoApply enabled={data.autoApply} minMatch={data.autoMin} onChange={() => void load().then(() => setMessage("Auto apply settings saved."))} />
          ) : <p className="role">Auto apply is off for the {data.plan.name} plan.</p>}
          {data.jobs.map((job) => (
            <article className="job-row" key={job.id}>
              <div>
                <strong>{job.title}</strong>
                <p className="role">{job.company} · {job.location || job.remoteType} · {job.category} · {job.verification}</p>
                <p>{job.description}</p>
                <p className="role">Match {job.score}% · {job.matched.join(", ") || "No skill overlap yet"}{job.missing.length ? ` · Missing ${job.missing.join(", ")}` : ""}</p>
              </div>
              <div>
                <span className="chip">{job.score}%</span>
                {job.applied ? <p className="role">Applied</p> : (
                  <button className="btn btn-primary btn-sm" type="button" disabled={!allowed("manual_apply")} onClick={() => void api("/api/applications", { method: "POST", body: JSON.stringify({ jobId: job.id }) }).then(load).catch((err: Error) => setError(err.message))}>
                    {allowed("manual_apply") ? "Apply" : "Upgrade to apply"}
                  </button>
                )}
              </div>
            </article>
          ))}
          <h2>Tracker</h2>
          {data.applications.map((item) => (
            <article className="job-row" key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <p className="role">{item.company} · {item.mode} · {item.match}%</p>
              </div>
              <select value={item.status} onChange={(event) => void api(`/api/applications/${item.id}`, { method: "PATCH", body: JSON.stringify({ status: event.target.value }) }).then(load)}>
                {STATUSES.map((status) => <option key={status}>{status}</option>)}
              </select>
            </article>
          ))}
        </section>
      ) : null}

      {tab === "billing" ? (
        <section>
          <div className="toggle">
            <button type="button" className={cycle === "monthly" ? "on" : ""} onClick={() => setCycle("monthly")}>Monthly</button>
            <button type="button" className={cycle === "yearly" ? "on" : ""} onClick={() => setCycle("yearly")}>Yearly</button>
          </div>
          <p className="role">
            {data.policy.allowUpgrade ? "Upgrades are on." : "Upgrades are off."} {data.policy.allowDowngrade ? "Downgrades are on." : "Downgrades are off."} {data.policy.allowProration ? "Unused time is credited." : "No proration."} {data.policy.allowRefund ? "Downgrades record a refund." : "Refunds are off."}
          </p>
          <label className="field">
            <span>Gateway</span>
            <select value={gatewayId} onChange={(event) => setGatewayId(event.target.value)}>
              {data.gateways.map((gateway) => <option key={gateway.id} value={gateway.id}>{gateway.name}</option>)}
            </select>
          </label>
          <div className="price-grid">
          {data.plans.map((plan) => (
            <article className="price-card" key={plan.id}>
              <h2>{plan.name}</h2>
              <p className="price"><strong>${((cycle === "yearly" ? plan.yearlyCents : plan.monthlyCents) / 100).toFixed(0)}</strong><span>{cycle === "yearly" ? "/yr" : "/mo"}</span></p>
              <p className="role">{plan.blurb}</p>
              <button
                className="btn btn-primary btn-block"
                type="button"
                disabled={plan.id === data.plan.id}
                onClick={() => void api<{ applied?: boolean; url?: string }>("/api/billing/checkout", { method: "POST", body: JSON.stringify({ planId: plan.id, gatewayId, cycle }) }).then((result) => { if (result.url) window.location.href = result.url; else { setMessage("Plan updated."); void refresh(); return load(); } }).catch((err: Error) => setError(err.message))}
              >
                {plan.id === data.plan.id ? "Current plan" : "Choose " + plan.name}
              </button>
            </article>
          ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <p className="stat"><strong>{value}</strong><span>{label}</span></p>;
}

function AutoApply({ enabled, minMatch, onChange }: { enabled: boolean; minMatch: number; onChange: () => void }) {
  const [on, setOn] = useState(enabled);
  const [min, setMin] = useState(minMatch);
  return (
    <form className="panel" onSubmit={(event) => { event.preventDefault(); void api("/api/account/auto-apply", { method: "PUT", body: JSON.stringify({ enabled: on, minMatch: min }) }).then(() => { if (on) return api("/api/applications/auto", { method: "POST" }); return undefined; }).then(onChange); }}>
      <h2>Auto apply</h2>
      <label className="check-row"><input type="checkbox" checked={on} onChange={(event) => setOn(event.target.checked)} /> Apply to active jobs at or above the match bar</label>
      <label className="field"><span>Minimum match</span><input type="number" min={50} max={99} value={min} onChange={(event) => setMin(Number(event.target.value))} /></label>
      <button className="btn btn-primary btn-sm" type="submit">{on ? "Save and run" : "Save manual mode"}</button>
    </form>
  );
}

function ProfileForm({
  user,
  profile,
  canEnhance,
  onSaved,
}: {
  user: { name: string; email: string; phone?: string; provider: string };
  profile: NonNullable<DashboardData["profile"]>;
  canEnhance: boolean;
  onSaved: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone || "");
  const [headline, setHeadline] = useState(profile.headline);
  const [summary, setSummary] = useState(profile.summary);
  const [skills, setSkills] = useState(profile.skills.join(", "));
  const [education, setEducation] = useState(profile.education.join("\n"));
  const [slug, setSlug] = useState(profile.slug);
  const [salary, setSalary] = useState(profile.preferences.salary || "");
  const [locations, setLocations] = useState(profile.preferences.locations || "");
  const [workArrangement, setWorkArrangement] = useState(profile.preferences.workArrangement || "");
  const [workAuthorization, setWorkAuthorization] = useState(profile.preferences.workAuthorization || "");
  const [shareContact, setShareContact] = useState(profile.shareContact);
  const [employment, setEmployment] = useState(profile.employment);
  const [error, setError] = useState("");
  const [photo, setPhoto] = useState(profile.photoUrl);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api("/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          name, phone, headline, summary, slug, salary, locations, workArrangement, workAuthorization, shareContact,
          skills: skills.split(",").map((item) => item.trim()).filter(Boolean),
          education: education.split("\n").map((item) => item.trim()).filter(Boolean),
          employment,
        }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    }
  }

  return (
    <form className="panel" onSubmit={save}>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="profile-photo-row">
        {photo ? <img src={photo} alt="" /> : <span className="resume-fallback">{name.slice(0, 1)}</span>}
        <label className="btn btn-ghost btn-sm">
          Upload photo
          <input type="file" accept="image/*" hidden onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            const body = new FormData();
            body.append("photo", file);
            void api<{ photoUrl: string }>("/api/profile/photo", { method: "POST", body }).then((result) => setPhoto(result.photoUrl));
          }} />
        </label>
        <button className="btn btn-ghost btn-sm" type="button" disabled={!canEnhance || !photo} onClick={() => void api<{ photoUrl: string }>("/api/profile/photo/enhance", { method: "POST" }).then((result) => setPhoto(result.photoUrl)).catch((err: Error) => setError(err.message))}>Enhance photo</button>
      </div>
      <label className="field"><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label className="field"><span>Headline</span><input value={headline} onChange={(event) => setHeadline(event.target.value)} /></label>
      <label className="field"><span>Phone</span><input value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
      <label className="field"><span>Summary</span><textarea rows={4} value={summary} onChange={(event) => setSummary(event.target.value)} /></label>
      <label className="field"><span>Skills, comma separated</span><input value={skills} onChange={(event) => setSkills(event.target.value)} /></label>
      <label className="field"><span>Education, one per line</span><textarea rows={3} value={education} onChange={(event) => setEducation(event.target.value)} /></label>
      {employment.map((job, index) => (
        <div className="admin-card" key={`${job.title}-${index}`}>
          <label className="field"><span>Title</span><input value={job.title} onChange={(event) => setEmployment((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, title: event.target.value } : row))} /></label>
          <label className="field"><span>Employer</span><input value={job.employer} onChange={(event) => setEmployment((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, employer: event.target.value } : row))} /></label>
          <label className="field"><span>Bullets</span><textarea rows={3} value={(job.bullets || []).join("\n")} onChange={(event) => setEmployment((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, bullets: event.target.value.split("\n").filter(Boolean) } : row))} /></label>
        </div>
      ))}
      <label className="field"><span>Target salary</span><input value={salary} onChange={(event) => setSalary(event.target.value)} /></label>
      <label className="field"><span>Locations</span><input value={locations} onChange={(event) => setLocations(event.target.value)} /></label>
      <label className="field"><span>Work arrangement</span><input value={workArrangement} onChange={(event) => setWorkArrangement(event.target.value)} /></label>
      <label className="field"><span>Work authorization</span><input value={workAuthorization} onChange={(event) => setWorkAuthorization(event.target.value)} /></label>
      <label className="field"><span>Public link</span><input value={slug} onChange={(event) => setSlug(event.target.value)} /></label>
      <label className="check-row"><input type="checkbox" checked={shareContact} onChange={(event) => setShareContact(event.target.checked)} /> Show email and phone on the public resume</label>
      <button className="btn btn-primary" type="submit">Save profile</button>
    </form>
  );
}
