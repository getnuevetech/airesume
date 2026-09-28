import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useApp } from "../context/AppContext";
import { useAccount } from "./AccountContext";
import { ResumeSheet } from "./ResumeSheet";
import type { AccountData, ResumeView } from "./types";

function Gate({ feature, children }: { feature?: string; children?: ReactNode }) {
  const { data } = useAccount();
  if (!data?.profile) {
    return (
      <section className="account-card">
        <h1>Upload a resume to open this section.</h1>
        <Link className="btn btn-primary" to="/get-started">Upload resume</Link>
      </section>
    );
  }
  if (feature && !data.features[feature]) {
    return (
      <section className="account-card">
        <h1>This is not included on {data.plan.name}.</h1>
        <p className="lede">An admin chooses which sections each plan can use.</p>
        <Link className="btn btn-primary" to="/account/plan">View plans</Link>
      </section>
    );
  }
  return children;
}

export function OverviewPage() {
  const { user } = useApp();
  const { data, error } = useAccount();
  if (!data) return <p className="lede">{error || "Loading your account…"}</p>;
  if (!data.profile) return <Gate />;
  const first = user?.name.split(" ")[0];
  const recommended = data.jobs.filter((job) => job.score >= 70).slice(0, 3);
  return (
    <div className="account-page">
      <header className="account-head">
        <div>
          <p className="eyebrow">{data.plan.name}</p>
          <h1>Good to see you, {first}.</h1>
          <p className="lede">Your search at a glance. Open a section on the left when you want to work on it.</p>
        </div>
      </header>
      <div className="stat-grid">
        <Tile label="Resume rating" value={data.stats.resumeRating === null ? "—" : String(data.stats.resumeRating)} />
        <Tile label="Recommended" value={String(data.stats.recommended)} />
        <Tile label="Ready to submit" value={String(data.stats.ready || 0)} />
        <Tile label="Submitted" value={String(data.stats.applied)} />
      </div>
      <div className="account-split">
        <section className="account-card">
          <h2>Recommended jobs</h2>
          {recommended.length ? recommended.map((job) => (
            <div className="quiet-row" key={job.id}>
              <div>
                <strong>{job.title}</strong>
                <p>{job.applyCompany || job.company} · {job.location || job.remoteType}</p>
                {job.viaCompany ? <p className="role">Listed by {job.viaCompany}{job.sourceName ? ` on ${job.sourceName}` : ""}</p> : null}
              </div>
              <span className="match-badge">{job.score}%</span>
            </div>
          )) : <p className="role">Matches show here after jobs are available on your plan.</p>}
          <Link className="text-btn" to="/account/jobs">See all jobs</Link>
        </section>
        <section className="account-card">
          <h2>Continue</h2>
          <Link className="quiet-row" to="/account/resume"><strong>Review your resume</strong><span>Rating and recommendations</span></Link>
          <Link className="quiet-row" to="/account/templates"><strong>Choose a template</strong><span>{data.templateLimit} design{data.templateLimit === 1 ? "" : "s"} on this plan</span></Link>
          <Link className="quiet-row" to="/account/profile"><strong>Update your profile</strong><span>Contact, experience, and photo</span></Link>
        </section>
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <p className="stat account-tile">
      <span className="tile-mark" aria-hidden="true">{label.slice(0, 1)}</span>
      <strong>{value}</strong>
      <span>{label}</span>
    </p>
  );
}

export function ProfilePage() {
  const { user, refresh } = useApp();
  const { data, reload, setMessage, setError } = useAccount();
  const [editing, setEditing] = useState(false);
  if (!data) return <p className="lede">Loading profile…</p>;
  if (!data.profile) return <Gate />;
  return (
    <Gate>
      <ProfileView
        userName={user?.name || ""}
        email={user?.email || ""}
        phone={user?.phone || ""}
        profile={data.profile}
        canEnhance={Boolean(data.features.image_enhance)}
        editing={editing}
        setEditing={setEditing}
        onSaved={() => {
          setEditing(false);
          setMessage("Profile saved.");
          void reload();
          void refresh();
        }}
        onError={setError}
      />
    </Gate>
  );
}

function ProfileView({
  userName, email, phone, profile, canEnhance, editing, setEditing, onSaved, onError,
}: {
  userName: string;
  email: string;
  phone: string;
  profile: NonNullable<AccountData["profile"]>;
  canEnhance: boolean;
  editing: boolean;
  setEditing: (value: boolean) => void;
  onSaved: () => void;
  onError: (value: string) => void;
}) {
  const [name, setName] = useState(userName);
  const [nextPhone, setNextPhone] = useState(phone);
  const [headline, setHeadline] = useState(profile.headline);
  const [summary, setSummary] = useState(profile.summary);
  const [skills, setSkills] = useState(profile.skills.join(", "));
  const [education, setEducation] = useState(profile.education.join("\n"));
  const [city, setCity] = useState(profile.city);
  const [address, setAddress] = useState(profile.address);
  const [salary, setSalary] = useState(profile.preferences.salary || "");
  const [locations, setLocations] = useState(profile.preferences.locations || "");
  const [workArrangement, setWorkArrangement] = useState(profile.preferences.workArrangement || "");
  const [workAuthorization, setWorkAuthorization] = useState(profile.preferences.workAuthorization || "");
  const [shareContact, setShareContact] = useState(profile.shareContact);
  const [employment, setEmployment] = useState(profile.employment);
  const [photo, setPhoto] = useState(profile.photoUrl);
  const [error, setLocalError] = useState("");

  async function save(event: FormEvent) {
    event.preventDefault();
    setLocalError("");
    try {
      await api("/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          name, phone: nextPhone, headline, summary, city, address, salary, locations, workArrangement, workAuthorization, shareContact,
          slug: profile.slug,
          skills: skills.split(",").map((item) => item.trim()).filter(Boolean),
          education: education.split("\n").map((item) => item.trim()).filter(Boolean),
          employment,
        }),
      });
      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save.";
      setLocalError(message);
      onError(message);
    }
  }

  return (
    <form className="account-page" onSubmit={save}>
      <header className="account-head">
        <div>
          <p className="eyebrow">Profile</p>
          <h1>{name}</h1>
          <p className="lede">{headline || "Add a headline so employers see your focus."}</p>
        </div>
        <button className="btn btn-ghost" type="button" onClick={() => setEditing(!editing)}>{editing ? "Close editor" : "Edit profile"}</button>
      </header>
      {error ? <p className="form-error">{error}</p> : null}
      <section className="account-card identity-card">
        {photo ? <img src={photo} alt="" /> : <span className="resume-fallback">{name.slice(0, 1)}</span>}
        <div>
          <h2>{headline || "Headline"}</h2>
          <p>{[email, nextPhone, city].filter(Boolean).join(" · ")}</p>
          {editing ? (
            <div className="profile-photo-row">
              <label className="btn btn-ghost btn-sm">
                Photo
                <input type="file" accept="image/*" hidden onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const body = new FormData();
                  body.append("photo", file);
                  void api<{ photoUrl: string }>("/api/profile/photo", { method: "POST", body }).then((result) => setPhoto(result.photoUrl));
                }} />
              </label>
              <button className="btn btn-ghost btn-sm" type="button" disabled={!canEnhance || !photo} onClick={() => void api<{ photoUrl: string }>("/api/profile/photo/enhance", { method: "POST" }).then((result) => setPhoto(result.photoUrl)).catch((err: Error) => setLocalError(err.message))}>Enhance</button>
            </div>
          ) : null}
        </div>
      </section>
      {editing ? (
        <section className="account-card account-form">
          <label className="field"><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="field"><span>Headline</span><input value={headline} onChange={(event) => setHeadline(event.target.value)} /></label>
          <label className="field"><span>Phone</span><input value={nextPhone} onChange={(event) => setNextPhone(event.target.value)} /></label>
          <label className="field"><span>City</span><input value={city} onChange={(event) => setCity(event.target.value)} /></label>
          <label className="field"><span>Address</span><input value={address} onChange={(event) => setAddress(event.target.value)} /></label>
          <label className="field"><span>Summary</span><textarea rows={4} value={summary} onChange={(event) => setSummary(event.target.value)} /></label>
          <label className="field"><span>Skills</span><input value={skills} onChange={(event) => setSkills(event.target.value)} /></label>
          <label className="field"><span>Education</span><textarea rows={3} value={education} onChange={(event) => setEducation(event.target.value)} /></label>
        </section>
      ) : (
        <>
          <section className="account-card">
            <h2>Summary</h2>
            <p>{summary || "No summary yet."}</p>
          </section>
          <section className="account-card">
            <h2>Skills</h2>
            <div className="chips">{profile.skills.map((skill) => <span className="chip" key={skill}>{skill}</span>)}</div>
          </section>
        </>
      )}
      <section className="account-card">
        <h2>Experience</h2>
        {employment.map((job, index) => (
          <article className="experience-block" key={`${job.title}-${index}`}>
            {editing ? (
              <>
                <label className="field"><span>Title</span><input value={job.title} onChange={(event) => setEmployment((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, title: event.target.value } : row))} /></label>
                <label className="field"><span>Employer</span><input value={job.employer} onChange={(event) => setEmployment((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, employer: event.target.value } : row))} /></label>
                <label className="field"><span>Bullets</span><textarea rows={3} value={(job.bullets || []).join("\n")} onChange={(event) => setEmployment((rows) => rows.map((row, rowIndex) => rowIndex === index ? { ...row, bullets: event.target.value.split("\n").filter(Boolean) } : row))} /></label>
              </>
            ) : (
              <>
                <h3>{job.title}</h3>
                <p className="role">{job.employer}</p>
                <ul>{(job.bullets || []).map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
              </>
            )}
          </article>
        ))}
      </section>
      <section className="account-card">
        <h2>Search preferences</h2>
        {editing ? (
          <>
            <label className="field"><span>Target salary</span><input value={salary} onChange={(event) => setSalary(event.target.value)} /></label>
            <label className="field"><span>Locations</span><input value={locations} onChange={(event) => setLocations(event.target.value)} /></label>
            <label className="field"><span>Work arrangement</span><input value={workArrangement} onChange={(event) => setWorkArrangement(event.target.value)} /></label>
            <label className="field"><span>Work authorization</span><input value={workAuthorization} onChange={(event) => setWorkAuthorization(event.target.value)} /></label>
            <label className="check-row"><input type="checkbox" checked={shareContact} onChange={(event) => setShareContact(event.target.checked)} /> Show email and phone on the public resume</label>
          </>
        ) : (
          <dl className="detail-list">
            <div><dt>Salary</dt><dd>{salary || "Not set"}</dd></div>
            <div><dt>Locations</dt><dd>{locations || "Not set"}</dd></div>
            <div><dt>Arrangement</dt><dd>{workArrangement || "Not set"}</dd></div>
            <div><dt>Authorization</dt><dd>{workAuthorization || "Not set"}</dd></div>
          </dl>
        )}
      </section>
      {editing ? <button className="btn btn-primary" type="submit">Save profile</button> : null}
    </form>
  );
}

export function ResumePage() {
  const { data, reload, setError, setMessage } = useAccount();
  const [selected, setSelected] = useState<string[]>([]);
  if (!data) return null;
  return (
    <Gate feature="resume_review">
      <div className="account-page">
        <header className="account-head">
          <div>
            <p className="eyebrow">Resume</p>
            <h1>Review and versions</h1>
            <p className="lede">Feedback stays here. A rewrite you accept becomes a new version. Your public resume does not change until you choose one.</p>
            {data.reviewQuota && !data.reviewQuota.unlimited ? (
              <p className="role">Resume reviews this week: {data.reviewQuota.used} used, {data.reviewQuota.remaining} left on {data.plan.name}.</p>
            ) : null}
          </div>
          <button className="btn btn-primary" type="button" onClick={() => void api("/api/resume/review", { method: "POST" }).then(reload).catch((err: Error) => setError(err.message))}>Analyze resume</button>
        </header>
        <div className="account-split">
          <section className="account-card">
            <h2>{data.review ? `Rating ${data.review.rating}` : "No review yet"}</h2>
            {data.review ? (
              <>
                <p className="role">{data.review.provider}</p>
                {data.review.feedback.map((line) => <p key={line}>{line}</p>)}
                {data.review.recommendations.map((item) => (
                  <label className="check-row" key={item.id}>
                    <input type="checkbox" disabled={item.kind !== "rewrite"} checked={selected.includes(item.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} />
                    <span><strong>{item.title}</strong><br />{item.detail}</span>
                  </label>
                ))}
                <button className="btn btn-primary btn-sm" type="button" disabled={!data.features.resume_upscale || !selected.length} onClick={() => void api("/api/resume/apply", { method: "POST", body: JSON.stringify({ reviewId: data.review?.id, recommendationIds: selected }) }).then(() => { setSelected([]); setMessage("New version saved."); return reload(); }).catch((err: Error) => setError(err.message))}>
                  {data.features.resume_upscale ? "Create version from selected" : "Upscale is not on this plan"}
                </button>
              </>
            ) : <p>Run an analysis to see what to improve.</p>}
          </section>
          <section className="account-card">
            <h2>Versions</h2>
            {data.versions.map((version) => (
              <article key={version.id} className="version-mini">
                <strong>{version.label}</strong>
                <p className="role">{version.active ? "Public resume" : version.kind}</p>
                {!version.active ? <button className="text-btn" type="button" onClick={() => void api(`/api/resume/versions/${version.id}/activate`, { method: "POST" }).then(() => { setMessage("Public resume updated."); return reload(); })}>Use this version</button> : null}
              </article>
            ))}
          </section>
        </div>
      </div>
    </Gate>
  );
}

export function TemplatesPage() {
  const { user } = useApp();
  const { data, reload, setError, setMessage } = useAccount();
  if (!data) return <p className="lede">Loading templates…</p>;
  if (!data.profile || !user) return <Gate feature="public_profile" />;
  const preview: ResumeView = {
    name: user.name,
    headline: data.profile.headline,
    summary: data.profile.summary,
    skills: data.profile.skills,
    employment: data.profile.employment,
    education: data.profile.education,
    photoUrl: data.profile.photoUrl,
    city: data.profile.city,
    email: data.profile.shareContact ? user.email : "",
    phone: data.profile.shareContact ? user.phone || "" : "",
    template: data.template,
  };
  return (
    <Gate feature="public_profile">
      <div className="account-page">
        <header className="account-head">
          <div>
            <p className="eyebrow">Templates</p>
            <h1>Public resume design</h1>
            <p className="lede">Your plan includes {data.templateLimit} of {data.templates.length} designs. The one you select is what people see at your link.</p>
          </div>
          {data.profile.slug ? <Link className="btn btn-ghost" to={`/resume/${data.profile.slug}`}>Open public page</Link> : null}
        </header>
        <div className="template-grid">
          {data.templates.map((item, index) => {
            const locked = index >= data.templateLimit;
            const active = item.id === data.template;
            return (
              <button
                key={item.id}
                type="button"
                className={active ? "template-card on" : "template-card"}
                disabled={locked}
                onClick={() => void api("/api/account/template", { method: "PUT", body: JSON.stringify({ template: item.id }) }).then(() => { setMessage(`${item.name} is now your public design.`); return reload(); }).catch((err: Error) => setError(err.message))}
              >
                <span className={`template-swatch swatch-${item.id}`} />
                <strong>{item.name}</strong>
                <span>{locked ? "Higher plan" : item.detail}</span>
              </button>
            );
          })}
        </div>
        <div className="template-preview">
          <ResumeSheet resume={preview} />
        </div>
      </div>
    </Gate>
  );
}

export function JobsPage() {
  const { data, reload, setError, setMessage } = useAccount();
  const [pasteText, setPasteText] = useState("");
  const [pasteUrl, setPasteUrl] = useState("");
  const [busy, setBusy] = useState(false);
  if (!data) return null;

  async function importJob(action: "" | "prepare" | "track") {
    setBusy(true);
    try {
      await api("/api/jobs/paste", {
        method: "POST",
        body: JSON.stringify({ text: pasteText, url: pasteUrl, action }),
      });
      setPasteText("");
      setPasteUrl("");
      setMessage(action === "prepare" ? "Job imported and prepared." : action === "track" ? "Job imported and tracked." : "Job imported.");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import that job.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Gate feature="job_browse">
      <div className="account-page">
        <header className="account-head">
          <div>
            <p className="eyebrow">Jobs</p>
            <h1>Tailored to your resume</h1>
            <p className="lede">{data.stats.available} roles in this list. {data.stats.recommended} are strong matches.</p>
            {data.matchQuota && !data.matchQuota.unlimited ? (
              <p className="role">Match explanations this week: {data.matchQuota.used} used, {data.matchQuota.remaining} left on {data.plan.name}.</p>
            ) : null}
          </div>
        </header>
        <section className="account-card">
          <h2>Paste a job</h2>
          <p className="lede">Drop in a listing URL or the full description. We extract requirements and score it against your resume.</p>
          <label className="field"><span>Listing URL</span><input value={pasteUrl} onChange={(event) => setPasteUrl(event.target.value)} placeholder="https://..." /></label>
          <label className="field"><span>Or paste description</span><textarea rows={5} value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder={"Title\nCompany\nRequirements..."} /></label>
          <div className="job-actions">
            <button className="btn btn-primary btn-sm" type="button" disabled={busy || (!pasteText.trim() && !pasteUrl.trim())} onClick={() => void importJob("")}>Import</button>
            {data.features.manual_apply ? (
              <>
                <button className="btn btn-ghost btn-sm" type="button" disabled={busy || (!pasteText.trim() && !pasteUrl.trim())} onClick={() => void importJob("prepare")}>Import & prepare</button>
                <button className="btn btn-ghost btn-sm" type="button" disabled={busy || (!pasteText.trim() && !pasteUrl.trim())} onClick={() => void importJob("track")}>Import & track</button>
              </>
            ) : null}
          </div>
        </section>
        {data.jobs.map((job) => (
          <article className="account-card job-card" key={job.id}>
            <div>
              <p className="role">{job.category} · {job.verification}</p>
              <h2>{job.title}</h2>
              <p>{job.applyCompany || job.company} · {job.location || job.remoteType}</p>
              {job.viaCompany ? <p className="role">Listed by {job.viaCompany}{job.sourceName ? ` on ${job.sourceName}` : ""}. This application goes to {job.applyCompany}.</p> : null}
              <p className="lede">{job.description}</p>
              {job.explanation ? <p className="role">{job.label ? `${job.label}: ` : ""}{job.explanation}</p> : null}
              {job.explanationLocked ? <p className="role">Explanation locked — weekly Free/Starter quota reached. Upgrade for more.</p> : null}
              <p className="role">{job.explanationLocked ? "Details hidden until an explanation slot is available" : (job.matched.join(", ") || "Limited skill overlap")}{!job.explanationLocked && job.missing.length ? ` · Gap: ${job.missing.join(", ")}` : ""}</p>
            </div>
            <div className="job-side">
              <span className="match-badge">{job.score}%</span>
              {job.label ? <p className="role">{job.label}</p> : null}
              {job.applied ? <p className="role">In your tracker</p> : (
                <div className="job-actions">
                  <button className="btn btn-primary btn-sm" type="button" disabled={!data.features.manual_apply} onClick={() => void api("/api/applications", { method: "POST", body: JSON.stringify({ jobId: job.id, action: "prepare" }) }).then(reload).catch((err: Error) => setError(err.message))}>
                    {data.features.manual_apply ? "Prepare" : "Upgrade to apply"}
                  </button>
                  {data.features.manual_apply ? (
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => void api("/api/applications", { method: "POST", body: JSON.stringify({ jobId: job.id, action: "track" }) }).then(reload).catch((err: Error) => setError(err.message))}>
                      Track
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          </article>
        ))}
      </div>
    </Gate>
  );
}

export function ApplicationsPage() {
  const { data, reload, setMessage, setError } = useAccount();
  if (!data) return null;
  const statuses = data.statuses?.length ? data.statuses : ["Found", "Reviewed", "Skipped", "Resume preparing", "Ready", "Review required", "Applied", "Responded", "Interview", "Offer", "Rejected", "Withdrawn"];
  return (
    <Gate>
      <div className="account-page">
        <header className="account-head">
          <div>
            <p className="eyebrow">Applications</p>
            <h1>Tracker</h1>
            <p className="lede">{data.stats.tracked ?? data.stats.applied} in your tracker. {data.stats.ready || 0} ready to submit. {data.stats.reviewRequired || 0} need review. {data.stats.responded} have a response, interview, or offer.</p>
          </div>
        </header>
        {data.features.auto_apply ? (
          <AutoApply
            enabled={data.autoApply}
            minMatch={data.autoMin}
            dailyCap={data.autoDailyCap || 5}
            capUsed={data.autoCapUsed || 0}
            excludeCompanies={data.profile?.preferences?.excludeCompanies || ""}
            excludeKeywords={data.profile?.preferences?.excludeKeywords || ""}
            onDone={() => { setMessage("Auto apply updated."); void reload(); }}
          />
        ) : (
          <section className="account-card">
            <h2>Review-first applications</h2>
            <p>Prepare a tailored resume from Jobs, then submit when you are ready. Autopilot queueing is not on the {data.plan.name} plan.</p>
          </section>
        )}
        {data.applications.map((item) => (
          <article className="account-card" key={item.id}>
            <div className="job-card" style={{ padding: 0, boxShadow: "none", background: "transparent" }}>
              <div>
                <h2>{item.title}</h2>
                <p className="role">{item.company} · {item.mode} · {item.match}% match · {item.status}</p>
                {item.viaCompany ? <p className="role">Found through {item.viaCompany}{item.sourceName ? ` on ${item.sourceName}` : ""}</p> : null}
                {item.delivery ? <p className="role">{item.delivery}</p> : null}
                {item.targetUrl ? <a href={item.targetUrl} target="_blank" rel="noreferrer">Open employer listing</a> : null}
              </div>
              <div className="job-side">
                {["Ready", "Review required", "Resume preparing"].includes(item.status) ? (
                  <button
                    className="btn btn-primary btn-sm"
                    type="button"
                    onClick={() => void api(`/api/applications/${item.id}/submit`, { method: "POST" }).then(() => { setMessage("Application submitted."); return reload(); }).catch((err: Error) => setError(err.message))}
                  >
                    Submit
                  </button>
                ) : null}
                <select value={item.status} onChange={(event) => void api(`/api/applications/${item.id}`, { method: "PATCH", body: JSON.stringify({ status: event.target.value }) }).then(reload)}>
                  {statuses.map((status) => <option key={status}>{status}</option>)}
                </select>
              </div>
            </div>
            {(item.questions?.length || ["Ready", "Review required", "Resume preparing", "Found"].includes(item.status)) ? (
              <QuestionDrafts
                applicationId={item.id}
                initial={item.questions || []}
                onSaved={() => { setMessage("Answers saved."); void reload(); }}
                onError={(message) => setError(message)}
              />
            ) : null}
          </article>
        ))}
      </div>
    </Gate>
  );
}

function QuestionDrafts({
  applicationId,
  initial,
  onSaved,
  onError,
}: {
  applicationId: string;
  initial: { id: string; prompt: string; kind: string; answer: string; blankReason?: string; hint?: string }[];
  onSaved: () => void;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [questions, setQuestions] = useState(initial);
  useEffect(() => {
    setQuestions(initial);
  }, [initial]);
  if (!questions.length && !open) {
    return null;
  }
  return (
    <div className="question-drafts">
      <button className="text-btn" type="button" onClick={() => setOpen((value) => !value)}>
        {open ? "Hide application answers" : `Application answers (${questions.length})`}
      </button>
      {open ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void api(`/api/applications/${applicationId}/questions`, {
              method: "PUT",
              body: JSON.stringify({ questions }),
            })
              .then(onSaved)
              .catch((err: Error) => onError(err.message));
          }}
        >
          {questions.map((item, index) => (
            <label className="field" key={item.id}>
              <span>{item.prompt}{item.kind === "user" ? " (you fill)" : ""}</span>
              <textarea
                rows={3}
                value={item.answer}
                placeholder={item.blankReason || item.hint || ""}
                onChange={(event) => setQuestions((rows) => rows.map((row, rowIndex) => (rowIndex === index ? { ...row, answer: event.target.value } : row)))}
              />
              {item.blankReason ? <span className="role">{item.blankReason}</span> : null}
              {!item.blankReason && item.hint ? <span className="role">{item.hint}</span> : null}
            </label>
          ))}
          <button className="btn btn-primary btn-sm" type="submit">Save answers</button>
        </form>
      ) : null}
    </div>
  );
}

function AutoApply({
  enabled,
  minMatch,
  dailyCap,
  capUsed,
  excludeCompanies,
  excludeKeywords,
  onDone,
}: {
  enabled: boolean;
  minMatch: number;
  dailyCap: number;
  capUsed: number;
  excludeCompanies: string;
  excludeKeywords: string;
  onDone: () => void;
}) {
  const [on, setOn] = useState(enabled);
  const [min, setMin] = useState(minMatch);
  const [cap, setCap] = useState(dailyCap);
  const [companies, setCompanies] = useState(excludeCompanies);
  const [keywords, setKeywords] = useState(excludeKeywords);
  return (
    <form
      className="account-card"
      onSubmit={(event) => {
        event.preventDefault();
        void api("/api/account/auto-apply", {
          method: "PUT",
          body: JSON.stringify({
            enabled: on,
            minMatch: min,
            dailyCap: cap,
            excludeCompanies: companies,
            excludeKeywords: keywords,
          }),
        })
          .then(() => (on ? api("/api/applications/auto", { method: "POST" }) : undefined))
          .then(onDone);
      }}
    >
      <h2>Autopilot queue</h2>
      <p className="lede">Autopilot never submits on a guess. It queues Ready or Review required rows for you to submit. Used {capUsed} of {cap} today.</p>
      <label className="check-row"><input type="checkbox" checked={on} onChange={(event) => setOn(event.target.checked)} /> Queue matching jobs for review</label>
      <label className="field"><span>Minimum match</span><input type="number" min={50} max={99} value={min} onChange={(event) => setMin(Number(event.target.value))} /></label>
      <label className="field"><span>Daily cap</span><input type="number" min={1} max={25} value={cap} onChange={(event) => setCap(Number(event.target.value))} /></label>
      <label className="field"><span>Exclude companies</span><input value={companies} onChange={(event) => setCompanies(event.target.value)} placeholder="Acme, Staffing Hub" /></label>
      <label className="field"><span>Exclude keywords</span><input value={keywords} onChange={(event) => setKeywords(event.target.value)} placeholder="unpaid, clearance" /></label>
      <button className="btn btn-primary btn-sm" type="submit">{on ? "Save and queue" : "Save manual-only"}</button>
    </form>
  );
}

export function PlanPage() {
  const { refresh } = useApp();
  const { data, reload, setError, setMessage } = useAccount();
  const [params, setParams] = useSearchParams();
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [gatewayId, setGatewayId] = useState("");

  useEffect(() => {
    if (data?.gateways[0] && !gatewayId) setGatewayId(data.gateways[0].id);
  }, [data, gatewayId]);

  useEffect(() => {
    const checkoutId = params.get("checkout_id");
    if (params.get("checkout") === "success" && checkoutId) {
      void api("/api/billing/confirm", { method: "POST", body: JSON.stringify({ checkoutId }) })
        .then(() => refresh())
        .then(reload)
        .then(() => setMessage("Plan updated."))
        .catch((err: Error) => setError(err.message));
      setParams({}, { replace: true });
    }
  }, [params, refresh, reload, setMessage, setError, setParams]);

  if (!data) return null;
  return (
    <div className="account-page">
      <header className="account-head">
        <div>
          <p className="eyebrow">Plan</p>
          <h1>{data.plan.name}</h1>
          <p className="lede">{data.policy.allowUpgrade ? "Upgrades are open." : "Upgrades are closed."} {data.policy.allowDowngrade ? "Downgrades are open." : "Downgrades are closed."} {data.policy.allowProration ? "Unused time is credited." : ""} {data.policy.allowRefund ? "Downgrades record a refund." : ""}</p>
        </div>
      </header>
      <div className="toggle">
        <button type="button" className={cycle === "monthly" ? "on" : ""} onClick={() => setCycle("monthly")}>Monthly</button>
        <button type="button" className={cycle === "yearly" ? "on" : ""} onClick={() => setCycle("yearly")}>Yearly</button>
      </div>
      <label className="field"><span>Payment method</span>
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
            <button className="btn btn-primary btn-block" type="button" disabled={plan.id === data.plan.id} onClick={() => void api<{ url?: string }>("/api/billing/checkout", { method: "POST", body: JSON.stringify({ planId: plan.id, gatewayId, cycle }) }).then((result) => { if (result.url) window.location.href = result.url; else { setMessage("Plan updated."); void refresh(); return reload(); } }).catch((err: Error) => setError(err.message))}>
              {plan.id === data.plan.id ? "Current plan" : `Choose ${plan.name}`}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

export function SettingsPage() {
  const { user, refresh, notify } = useApp();
  const { data, reload, setMessage, setError } = useAccount();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  if (!data && !user?.mustChangePassword) return null;
  const link = data?.profile?.slug ? `${window.location.origin}/resume/${data.profile.slug}` : "";
  return (
    <div className="account-page">
      <header className="account-head">
        <div>
          <p className="eyebrow">Settings</p>
          <h1>Account</h1>
          {user?.mustChangePassword ? (
            <p className="lede">Change the bootstrap password before using admin or account tools.</p>
          ) : null}
        </div>
      </header>
      {link ? (
        <section className="account-card">
          <h2>Public link</h2>
          <p className="role">{link}</p>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => void navigator.clipboard.writeText(link).then(() => setMessage("Link copied."))}>Copy link</button>
        </section>
      ) : null}
      {user?.provider === "email" ? (
        <form className="account-card" onSubmit={(event) => {
          event.preventDefault();
          void api<{ ok: boolean; user?: typeof user }>("/api/account/password", { method: "POST", body: JSON.stringify({ current, password }) })
            .then(async (result) => {
              setCurrent("");
              setPassword("");
              setMessage("Password updated.");
              notify("Password updated.");
              await refresh();
              if (result.user && !result.user.mustChangePassword) {
                void reload?.();
              }
            })
            .catch((err: Error) => setError(err.message));
        }}>
          <h2>{user?.mustChangePassword ? "Choose a new password" : "Password"}</h2>
          <label className="field"><span>Current password</span><input type="password" value={current} onChange={(event) => setCurrent(event.target.value)} required /></label>
          <label className="field"><span>New password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></label>
          <button className="btn btn-primary btn-sm" type="submit">Update password</button>
        </form>
      ) : null}
      <section className="account-card">
        <h2>Session</h2>
        <p className="role">Signed in as {user?.email}. Plan changes and template access refresh when you save them.</p>
        {data ? <button className="text-btn" type="button" onClick={() => void reload()}>Refresh account</button> : null}
      </section>
    </div>
  );
}
