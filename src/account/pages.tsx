import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { openCookieSettings } from "../components/CookieSettings";
import { useApp } from "../context/AppContext";
import {
  SALARY_RANGE_OPTIONS,
  WORK_ARRANGEMENT_OPTIONS,
  WORK_AUTHORIZATION_OPTIONS,
} from "../preferenceOptions";
import { useAccount } from "./AccountContext";
import { CategoryBars, CountBars, ScorePill, ScoreRing, StageRail, pipelineRows } from "./charts";
import { ResumeSheet } from "./ResumeSheet";
import type { AccountData, ResumeView } from "./types";

function resumeKindLabel(version: { active: boolean; kind: string }) {
  if (version.active) return "Public resume";
  if (version.kind === "upscale") return "Upscale";
  if (version.kind === "application") return "Tailored for a job";
  if (version.kind === "upload") return "Uploaded resume";
  return version.kind;
}

function TailoredResume({
  tailored,
  applicationId,
}: {
  tailored: NonNullable<AccountData["applications"][number]["tailored"]>;
  applicationId?: string;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="tailored-result">
      <h3>{tailored.label} is saved</h3>
      <p className="lede">{tailored.summary}</p>
      {tailored.changes.map((change) => (
        <p className="role" key={`${change.kind}-${change.after}`}>
          {change.before} → {change.after}
        </p>
      ))}
      <div className="version-actions">
        <button className="text-btn" type="button" onClick={() => setOpen((current) => !current)}>
          {open ? "Hide resume" : "View resume"}
        </button>
        <Link className="text-btn" to="/account/profile">Open on your profile</Link>
        {applicationId ? <Link className="text-btn" to={`/account/applications#application-${applicationId}`}>Open in the tracker</Link> : null}
      </div>
      {open ? <pre className="version-resume">{tailored.rendered}</pre> : null}
    </div>
  );
}

function WeekCard({ week }: { week: NonNullable<AccountData["week"]> }) {
  return (
    <section className="account-card">
      <h2>This week</h2>
      <p className="lede">{week.next.detail}</p>
      <CountBars
        title="This week"
        rows={[
          { label: "Submitted", value: week.submittedThisWeek },
          { label: "Prepared", value: week.preparedThisWeek },
          { label: "Tracked", value: week.trackedThisWeek },
        ]}
      />
      {week.items?.map((item) => (
        <Link className="quiet-row" key={item.id} to={item.href}>
          <div>
            <strong>{item.title}</strong>
            <span>{[item.company, item.label, item.status].filter(Boolean).join(" · ")}</span>
          </div>
        </Link>
      ))}
      {week.more ? <Link className="text-btn" to="/account/applications?week=1">{week.more} more this week.</Link> : null}
      {week.quotas.map((line) => <p className="role" key={line}>{line}</p>)}
      <Link className="btn btn-primary" to={week.next.href}>{week.next.title}</Link>
    </section>
  );
}

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
      <section className="account-card chart-card">
        <h2>Search snapshot</h2>
        <div className="chart-layout">
          <ScoreRing label="Resume rating" value={data.stats.resumeRating} />
          <CountBars
            title="Search snapshot"
            rows={[
              { label: "Recommended", value: data.stats.recommended },
              { label: "Ready to submit", value: data.stats.ready || 0 },
              { label: "Follow-ups due", value: data.stats.followUpsDue || 0 },
              { label: "Submitted", value: data.stats.applied },
            ]}
          />
        </div>
      </section>
      {data.week ? <WeekCard week={data.week} /> : null}
      <div className="account-split">
        <section className="account-card">
          <h2>Recommended jobs</h2>
          {recommended.length ? recommended.map((job) => (
            <div className="quiet-row" key={job.id}>
              <div>
                <strong>{job.title}</strong>
                <p>{job.applyCompany || job.company} · {job.location || job.remoteType}</p>
                {job.fit?.summary ? <p className="role">{job.fit.summary}</p> : null}
                {job.viaCompany ? <p className="role">Listed by {job.viaCompany}{job.sourceName ? ` on ${job.sourceName}` : ""}</p> : null}
              </div>
              <ScorePill score={job.score} />
            </div>
          )) : <p className="role">Matches show here after jobs are available on your plan.</p>}
          <Link className="text-btn" to="/account/jobs">See all jobs</Link>
        </section>
        <section className="account-card">
          <h2>Continue</h2>
          <Link className="quiet-row" to="/account/settings"><strong>Browser extension</strong><span>Capture employer listings into your tracker</span></Link>
          <Link className="quiet-row" to="/account/resume"><strong>Review your resume</strong><span>Rating and recommendations</span></Link>
          <Link className="quiet-row" to="/account/insights"><strong>Career insights</strong><span>Skill demand, gaps, and focus areas</span></Link>
          <Link className="quiet-row" to="/account/interview"><strong>Interview prep</strong><span>STAR drafts and voice practice from resume facts</span></Link>
          <Link className="quiet-row" to="/account/invites"><strong>Employer invites</strong><span>Respond to roles employers send you</span></Link>
          <Link className="quiet-row" to="/account/templates"><strong>Choose a template</strong><span>{data.templateLimit} design{data.templateLimit === 1 ? "" : "s"} on this plan</span></Link>
          <Link className="quiet-row" to="/account/profile"><strong>Update your profile</strong><span>Contact, experience, and photo</span></Link>
        </section>
      </div>
    </div>
  );
}

type CareerInsights = {
  summary: {
    catalogJobs: number;
    visibleJobs: number;
    strongMatches: number;
    tracked: number;
    submitted: number;
    responses: number;
    interviews?: number;
    offers?: number;
    rejected?: number;
    responseRate: number | null;
    interviewRate?: number | null;
    skillCount: number;
  };
  strengths: { skill: string; demand: number; kind: string }[];
  gaps: { skill: string; demand: number; kind: string }[];
  risingPreferred: { skill: string; demand: number; kind: string }[];
  categoryOutlook: { category: string; jobs: number; avgScore: number; strong: number }[];
  focus: { id: string; title: string; detail: string }[];
  topMatches: { id: string; title: string; company: string; score: number; label: string; missing: string[] }[];
  outcomes?: {
    interviews: number;
    offers: number;
    rejected: number;
    advanced: number;
    stalled: number;
    avgMatchAdvanced: number | null;
    avgMatchStalled: number | null;
    winningCategories: { label: string; count: number }[];
    winningSkills: { skill: string; hits: number; kind: string }[];
    lessons: { id: string; title: string; detail: string }[];
  };
};

export function InsightsPage() {
  const { setError, setMessage } = useAccount();
  const [insights, setInsights] = useState<CareerInsights | null>(null);
  const [pendingGap, setPendingGap] = useState("");
  const [limited, setLimited] = useState(false);
  const [planName, setPlanName] = useState("");
  const [question, setQuestion] = useState("Why am I not getting interviews?");
  const [coach, setCoach] = useState<{
    answer: string;
    actions: { id: string; title: string; detail: string; href?: string }[];
  } | null>(null);
  const [coachBusy, setCoachBusy] = useState(false);

  useEffect(() => {
    void api<{ insights: CareerInsights; limited: boolean; plan: { name: string } }>("/api/career/insights")
      .then((data) => {
        setInsights(data.insights);
        setLimited(Boolean(data.limited));
        setPlanName(data.plan?.name || "");
      })
      .catch((err: Error) => setError(err.message));
  }, [setError]);

  async function confirmGap(skill: string) {
    setPendingGap(skill);
    try {
      const result = await api<{ message?: string; insights?: CareerInsights }>("/api/career/confirm-skill", {
        method: "POST",
        body: JSON.stringify({ skill }),
      });
      setMessage(result.message || `${skill} is saved to your Fact Ledger.`);
      const data = await api<{ insights: CareerInsights; limited: boolean; plan: { name: string } }>("/api/career/insights");
      setInsights(data.insights);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm that skill.");
    } finally {
      setPendingGap("");
    }
  }

  async function askCoach(event?: FormEvent) {
    event?.preventDefault();
    setCoachBusy(true);
    try {
      const data = await api<{ answer: string; actions: { id: string; title: string; detail: string; href?: string }[] }>(
        "/api/career/coach",
        { method: "POST", body: JSON.stringify({ question }) },
      );
      setCoach({ answer: data.answer, actions: data.actions || [] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Coach unavailable.");
    } finally {
      setCoachBusy(false);
    }
  }

  return (
    <Gate feature="job_browse">
      <div className="account-page">
        <header className="account-head">
          <div>
            <p className="eyebrow">Career intelligence</p>
            <h1>Insights</h1>
            <p className="lede">
              Demand, gaps, and outcome lessons are counted from open roles and your tracker. Nothing is invented.
              {limited ? ` Your ${planName || "current"} plan shows a shorter skill list.` : ""}
            </p>
          </div>
        </header>
        <form className="account-card" onSubmit={(event) => void askCoach(event)}>
          <h2>AI Job Coach</h2>
          <p className="role">Ask about interviews, gaps, follow-ups, or next actions. Answers stay grounded in your tracker and Fact Ledger.</p>
          <label className="field">
            <span>Question</span>
            <input value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={500} />
          </label>
          <button className="btn btn-primary btn-sm" type="submit" disabled={coachBusy}>
            {coachBusy ? "Thinking…" : "Ask coach"}
          </button>
          {coach ? (
            <div className="coach-reply">
              <p className="lede">{coach.answer}</p>
              {coach.actions.length ? (
                <ul className="fact-list">
                  {coach.actions.map((action) => (
                    <li key={action.id}>
                      {action.href ? <Link to={action.href}>{action.title}</Link> : <strong>{action.title}</strong>}
                      {" — "}
                      {action.detail}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </form>
        {!insights ? <p className="lede">Building insights…</p> : (
          <>
            <section className="account-card chart-card">
              <h2>Search pulse</h2>
              <div className="chart-layout rings">
                <ScoreRing label="Response rate" value={insights.summary.responseRate} />
                <ScoreRing label="Interview rate" value={insights.summary.interviewRate ?? null} />
                <CountBars
                  title="Open roles"
                  rows={[
                    { label: "Catalog roles", value: insights.summary.catalogJobs },
                    { label: "Strong matches", value: insights.summary.strongMatches },
                  ]}
                />
              </div>
            </section>
            {insights.outcomes ? (
              <section className="account-card">
                <h2>Outcomes from your tracker</h2>
                <CountBars
                  title="Tracker outcomes"
                  rows={[
                    { label: "Advanced", value: insights.outcomes.advanced },
                    { label: "Interviews", value: insights.outcomes.interviews },
                    { label: "Offers", value: insights.outcomes.offers },
                    { label: "Rejected", value: insights.outcomes.rejected },
                  ]}
                />
                {insights.outcomes.avgMatchAdvanced != null || insights.outcomes.avgMatchStalled != null ? (
                  <p className="role">
                    {insights.outcomes.avgMatchAdvanced != null ? `Average match on advanced roles ${insights.outcomes.avgMatchAdvanced}%. ` : ""}
                    {insights.outcomes.avgMatchStalled != null ? `Average match on stalled roles ${insights.outcomes.avgMatchStalled}%.` : ""}
                  </p>
                ) : null}
                {insights.outcomes.winningSkills.length ? (
                  <div className="chips">
                    {insights.outcomes.winningSkills.map((item) => (
                      <span className="chip" key={item.skill}>{item.skill} · advanced {item.hits}</span>
                    ))}
                  </div>
                ) : null}
                {insights.outcomes.lessons.length ? insights.outcomes.lessons.map((lesson) => (
                  <article className="insight-focus" key={lesson.id}>
                    <strong>{lesson.title}</strong>
                    <p className="role">{lesson.detail}</p>
                  </article>
                )) : <p className="role">Move applications to Employer viewed / Interview / Offer / Hired to unlock outcome lessons.</p>}
              </section>
            ) : null}
            <div className="account-split">
              <section className="account-card">
                <h2>Focus next</h2>
                {insights.focus.length ? insights.focus.map((item) => (
                  <article className="insight-focus" key={item.id}>
                    <strong>{item.title}</strong>
                    <p className="role">{item.detail}</p>
                  </article>
                )) : <p className="role">Add skills or browse jobs to unlock focus tips.</p>}
              </section>
              <section className="account-card chart-card">
                <h2>Category outlook</h2>
                {insights.categoryOutlook.length ? <CategoryBars rows={insights.categoryOutlook} /> : <p className="role">No active jobs yet.</p>}
              </section>
            </div>
            <div className="account-split">
              <section className="account-card">
                <h2>Skills in demand you already have</h2>
                {insights.strengths.length ? (
                  <CountBars
                    title="Skills in demand you already have"
                    rows={insights.strengths.map((item) => ({ label: item.skill, value: item.demand }))}
                  />
                ) : <p className="role">Confirm skills on your profile to see strengths.</p>}
              </section>
              <section className="account-card">
                <h2>High-demand gaps</h2>
                <p className="role">Only confirm a skill from real experience. It is saved to the Fact Ledger.</p>
                {insights.gaps.length ? insights.gaps.map((item) => (
                  <div className="gap-row" key={item.skill}>
                    <span className="chip chip-gap">{item.skill}</span>
                    <span className="demand-meter" aria-hidden="true">
                      <span style={{ width: `${(item.demand / (insights.gaps[0]?.demand || 1)) * 100}%` }} />
                    </span>
                    <strong>{item.demand}</strong>
                    <button className="btn btn-ghost btn-sm" type="button" disabled={Boolean(pendingGap)} onClick={() => void confirmGap(item.skill)}>
                      {pendingGap === item.skill ? "Saving…" : `I have ${item.skill}`}
                    </button>
                  </div>
                )) : <p className="role">No clear gaps against current listings.</p>}
                {insights.risingPreferred.length ? (
                  <>
                    <h3>Also preferred</h3>
                    <div className="chips">
                      {insights.risingPreferred.map((item) => (
                        <span className="chip" key={item.skill}>{item.skill}</span>
                      ))}
                    </div>
                  </>
                ) : null}
              </section>
            </div>
            <section className="account-card">
              <h2>Strong matches to prepare</h2>
              {insights.topMatches.length ? insights.topMatches.map((job) => (
                <div className="quiet-row" key={job.id}>
                  <div>
                    <strong>{job.title}</strong>
                    <p>{job.company}</p>
                    {job.missing.length ? <p className="role">Gap: {job.missing.join(", ")}</p> : null}
                  </div>
                  <ScorePill score={job.score} />
                </div>
              )) : <p className="role">No strong matches in your current list.</p>}
              <Link className="text-btn" to="/account/jobs">Open jobs</Link>
            </section>
          </>
        )}
      </div>
    </Gate>
  );
}

type InterviewPrep = {
  applicationId: string | null;
  status: string;
  title: string;
  company: string;
  score: number | null;
  label: string;
  listingUrl: string;
  briefing: {
    role: string;
    category: string;
    location: string;
    verification: string;
    signals: string[];
    missing: string[];
    matched: string[];
  };
  prompts: {
    id: string;
    prompt: string;
    kind: string;
    answer: string;
    ready: boolean;
    note: string;
    sourceBullet?: { title: string; employer: string; bullet: string } | null;
  }[];
  talkingPoints: { skill: string; detail: string; ready: boolean }[];
  askEmployer: string[];
  reminders: string[];
  coverage?: {
    percent: number;
    promptsReady: number;
    promptsTotal: number;
    talkingPointsReady: number;
    starWithSource: number;
    practiceReady: boolean;
  };
};

type VoiceFeedback = {
  score: number;
  label: string;
  usedSkills: string[];
  usedEmployers: string[];
  usedTitles: string[];
  usedNumbers: string[];
  unverifiedNumbers: string[];
  notes: string[];
  suggestion: string;
};

type VoiceSession = {
  id: string;
  applicationId: string;
  title: string;
  company: string;
  status: string;
  prompts: {
    id: string;
    prompt: string;
    kind: string;
    coachAnswer: string;
    ready: boolean;
    note: string;
    sourceBullet?: { title: string; employer: string; bullet: string } | null;
  }[];
  facts: { skills: string[]; employers: string[]; titles: string[]; knownNumbers: string[] };
  reminders: string[];
  turns: {
    promptId: string;
    prompt: string;
    kind: string;
    answer: string;
    mode: string;
    feedback: VoiceFeedback | null;
    answeredAt: number | null;
  }[];
  summary: { answered: number; total: number; averageScore: number; inventedMetricFlags: number; status: string };
};

export function InterviewPage() {
  const { data, setError } = useAccount();
  const eligible = (data?.applications || []).filter((item) =>
    ["Ready", "Review required", "Applied", "Employer viewed", "Recruiter contact", "Responded", "Interview", "Offer", "Hired"].includes(
      item.status,
    ),
  );
  const priority = [...eligible].sort((a, b) => {
    const rank = (status: string) =>
      ({
        Hired: 0,
        Offer: 1,
        Interview: 2,
        "Recruiter contact": 3,
        Responded: 4,
        "Employer viewed": 5,
        Applied: 6,
        Ready: 7,
        "Review required": 8,
      }[status] ?? 9);
    return rank(a.status) - rank(b.status);
  });
  const [selected, setSelected] = useState("");
  const [mode, setMode] = useState<"prep" | "voice">("prep");
  useEffect(() => {
    if (!priority.length) {
      setSelected("");
      return;
    }
    setSelected((current) => (current && priority.some((item) => item.id === current) ? current : priority[0].id));
  }, [data?.applications]);

  return (
    <Gate feature="job_browse">
      <div className="account-page">
        <header className="account-head">
          <div>
            <p className="eyebrow">Interview prep</p>
            <h1>Prepare</h1>
            <p className="lede">STAR drafts, talking points, and voice practice from resume bullets. Metrics you cannot verify stay blank.</p>
          </div>
        </header>
        {!priority.length ? (
          <section className="account-card">
            <h2>No interview-ready applications yet</h2>
            <p className="lede">Prep unlocks for Ready through Hired rows in your tracker, including Employer viewed and Recruiter contact.</p>
            <Link className="btn btn-primary btn-sm" to="/account/applications">Open tracker</Link>
          </section>
        ) : (
          <>
            <section className="account-card">
              <h2>Choose an application</h2>
              <div className="interview-pick">
                {priority.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={selected === item.id ? "on" : ""}
                    onClick={() => setSelected(item.id)}
                  >
                    <strong>{item.title}</strong>
                    <span className="role">{item.company} · {item.status} · {item.match}%</span>
                  </button>
                ))}
              </div>
              <div className="job-actions" style={{ justifyContent: "flex-start", marginTop: 12 }}>
                <button className={`btn btn-sm ${mode === "prep" ? "btn-primary" : "btn-ghost"}`} type="button" onClick={() => setMode("prep")}>Written prep</button>
                <button className={`btn btn-sm ${mode === "voice" ? "btn-primary" : "btn-ghost"}`} type="button" onClick={() => setMode("voice")}>Voice practice</button>
              </div>
            </section>
            {selected && mode === "prep" ? (
              <InterviewPrepPanel
                applicationId={selected}
                defaultOpen
                onError={(message) => setError(message)}
              />
            ) : null}
            {selected && mode === "voice" ? (
              <VoicePracticePanel
                applicationId={selected}
                onError={(message) => setError(message)}
              />
            ) : null}
          </>
        )}
      </div>
    </Gate>
  );
}

function InterviewPrepPanel({
  applicationId,
  defaultOpen = false,
  onError,
}: {
  applicationId: string;
  defaultOpen?: boolean;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [prep, setPrep] = useState<InterviewPrep | null>(null);
  const [copied, setCopied] = useState("");

  async function load() {
    const data = await api<{ prep: InterviewPrep }>(`/api/applications/${applicationId}/interview-prep`);
    setPrep(data.prep);
  }

  useEffect(() => {
    if (defaultOpen) void load().catch((err: Error) => onError(err.message));
  }, [applicationId, defaultOpen, onError]);

  async function copyText(label: string, value: string) {
    if (!value.trim()) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied((current) => (current === label ? "" : current)), 1600);
    } catch {
      onError("Clipboard access was blocked.");
    }
  }

  return (
    <div className="interview-prep">
      {!defaultOpen ? (
        <button
          className="text-btn"
          type="button"
          onClick={() => {
            const next = !open;
            setOpen(next);
            if (next) void load().catch((err: Error) => onError(err.message));
          }}
        >
          {open ? "Hide interview prep" : "Interview prep"}
        </button>
      ) : null}
      {(open || defaultOpen) ? (
        <section className="account-card interview-prep-panel">
          {!prep ? <p className="role">Loading prep…</p> : (
            <>
              <header className="account-head" style={{ marginBottom: 8 }}>
                <div>
                  <h2>{prep.title}</h2>
                  <p className="role">{prep.company}{prep.score != null ? ` · ${prep.score}% match` : ""}</p>
                </div>
                {prep.listingUrl ? <a className="btn btn-ghost btn-sm" href={prep.listingUrl} target="_blank" rel="noreferrer">Open listing</a> : null}
              </header>
              <p className="lede">Matched: {(prep.briefing.matched || []).join(", ") || "limited overlap"}.{(prep.briefing.missing || []).length ? ` Gaps to discuss honestly: ${prep.briefing.missing.join(", ")}.` : ""}</p>
              {prep.coverage ? (
                <p className={prep.coverage.practiceReady ? "role" : "form-error"} role="status">
                  Prep coverage {prep.coverage.percent}% · {prep.coverage.promptsReady}/{prep.coverage.promptsTotal} prompts ready · {prep.coverage.starWithSource} STAR with source bullets
                  {prep.coverage.practiceReady ? " · ready for voice practice" : " · harden STAR bullets before practicing aloud"}
                </p>
              ) : null}
              {prep.briefing.signals.length ? (
                <>
                  <h3>From the listing</h3>
                  <ul className="interview-signals">
                    {prep.briefing.signals.map((line) => <li key={line}>{line}</li>)}
                  </ul>
                </>
              ) : null}
              <h3>Practice prompts</h3>
              {prep.prompts.map((item) => (
                <div className="apply-kit-row" key={item.id}>
                  <div>
                    <strong>{item.prompt}</strong>
                    <p className="role">{item.answer || item.note}</p>
                    {item.note && item.answer ? <p className="role">{item.note}</p> : null}
                  </div>
                  <button className="text-btn" type="button" disabled={!item.answer} onClick={() => void copyText(item.id, item.answer)}>
                    {copied === item.id ? "Copied" : "Copy"}
                  </button>
                </div>
              ))}
              <h3>Talking points</h3>
              {prep.talkingPoints.length ? prep.talkingPoints.map((item) => (
                <div className="apply-kit-row" key={item.skill}>
                  <div>
                    <strong>{item.skill}</strong>
                    <p className="role">{item.detail}</p>
                  </div>
                  <button className="text-btn" type="button" disabled={!item.ready} onClick={() => void copyText(item.skill, item.detail)}>
                    {copied === item.skill ? "Copied" : "Copy"}
                  </button>
                </div>
              )) : <p className="role">No matched skills to rehearse yet.</p>}
              <h3>Ask them</h3>
              <ul className="interview-signals">
                {prep.askEmployer.map((question) => <li key={question}>{question}</li>)}
              </ul>
              <h3>Reminders</h3>
              <ul className="interview-signals">
                {prep.reminders.map((line) => <li key={line}>{line}</li>)}
              </ul>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}

function VoicePracticePanel({
  applicationId,
  onError,
}: {
  applicationId: string;
  onError: (message: string) => void;
}) {
  const [session, setSession] = useState<VoiceSession | null>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [busy, setBusy] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    setSession(null);
    setIndex(0);
    setAnswer("");
    setListening(false);
    setSpeaking(false);
  }, [applicationId]);

  useEffect(() => () => {
    recognitionRef.current?.stop();
    window.speechSynthesis?.cancel();
  }, []);

  async function startSession() {
    setBusy(true);
    try {
      const data = await api<{ session: VoiceSession }>(`/api/applications/${applicationId}/voice-practice`, {
        method: "POST",
        body: "{}",
      });
      setSession(data.session);
      setIndex(0);
      setAnswer("");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not start voice practice.");
    } finally {
      setBusy(false);
    }
  }

  const turn = session?.turns[index] || null;
  const prompt = session?.prompts[index] || null;

  function speakPrompt() {
    if (!prompt?.prompt || !window.speechSynthesis) {
      onError("Speech synthesis is not available in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(prompt.prompt);
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }

  function startListening() {
    const SpeechRecognition = (window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    }).SpeechRecognition || (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike }).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      onError("Speech recognition is not available. Type your answer instead.");
      return;
    }
    stopListening();
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i += 1) {
        text += event.results[i][0].transcript;
      }
      setAnswer(text.trim());
    };
    recognition.onerror = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  async function submitAnswer(mode: "typed" | "speech") {
    if (!session || !prompt) return;
    setBusy(true);
    stopListening();
    try {
      const data = await api<{ session: VoiceSession }>(`/api/voice-practice/${session.id}/answer`, {
        method: "POST",
        body: JSON.stringify({ promptId: prompt.id, answer, mode }),
      });
      setSession(data.session);
      setAnswer(data.session.turns[index]?.answer || answer);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not score the answer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="account-card interview-prep-panel">
      <header className="account-head" style={{ marginBottom: 8 }}>
        <div>
          <h2>Voice practice</h2>
          <p className="lede">Hear each prompt, answer by mic or keyboard, and get coaching that only trusts resume facts.</p>
        </div>
        {!session ? (
          <button className="btn btn-primary btn-sm" type="button" disabled={busy} onClick={() => void startSession()}>
            {busy ? "Starting…" : "Start session"}
          </button>
        ) : null}
      </header>
      {!session ? (
        <p className="role">Start a session to rehearse the same prompts as written prep, out loud.</p>
      ) : (
        <>
          <p className="role">
            {session.title} · {session.company} · {session.summary.answered}/{session.summary.total} answered
            {session.summary.averageScore ? ` · avg ${session.summary.averageScore}` : ""}
            {session.summary.inventedMetricFlags ? ` · ${session.summary.inventedMetricFlags} invented-metric flag(s)` : ""}
          </p>
          {prompt && turn ? (
            <div className="voice-practice">
              <div className="voice-prompt">
                <p className="eyebrow">Question {index + 1} of {session.prompts.length}</p>
                <h3>{prompt.prompt}</h3>
                <div className="job-actions" style={{ justifyContent: "flex-start" }}>
                  <button className="btn btn-ghost btn-sm" type="button" onClick={speakPrompt} disabled={speaking}>
                    {speaking ? "Speaking…" : "Hear question"}
                  </button>
                  {listening ? (
                    <button className="btn btn-ghost btn-sm" type="button" onClick={stopListening}>Stop mic</button>
                  ) : (
                    <button className="btn btn-ghost btn-sm" type="button" onClick={startListening}>Use mic</button>
                  )}
                </div>
              </div>
              <label className="field">
                <span>Your answer {listening ? "(listening…)" : turn.mode ? `(${turn.mode})` : ""}</span>
                <textarea
                  rows={5}
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  placeholder="Speak or type a STAR answer from verified resume facts."
                />
              </label>
              <div className="job-actions" style={{ justifyContent: "flex-start" }}>
                <button className="btn btn-primary btn-sm" type="button" disabled={busy || !answer.trim()} onClick={() => void submitAnswer(listening || turn.mode === "speech" ? "speech" : "typed")}>
                  {busy ? "Scoring…" : "Score answer"}
                </button>
                <button className="btn btn-ghost btn-sm" type="button" disabled={index <= 0} onClick={() => { setIndex((value) => Math.max(0, value - 1)); setAnswer(session.turns[Math.max(0, index - 1)]?.answer || ""); }}>
                  Previous
                </button>
                <button className="btn btn-ghost btn-sm" type="button" disabled={index >= session.prompts.length - 1} onClick={() => { setIndex((value) => Math.min(session.prompts.length - 1, value + 1)); setAnswer(session.turns[Math.min(session.prompts.length - 1, index + 1)]?.answer || ""); }}>
                  Next
                </button>
                <button className="btn btn-ghost btn-sm" type="button" disabled={busy} onClick={() => void startSession()}>New session</button>
              </div>
              {turn.feedback ? (
                <div className="voice-feedback">
                  <p className="role"><strong>{turn.feedback.label}</strong> · score {turn.feedback.score}</p>
                  <ul className="interview-signals">
                    {turn.feedback.notes.map((note) => <li key={note}>{note}</li>)}
                  </ul>
                  <p className="lede">{turn.feedback.suggestion}</p>
                </div>
              ) : null}
              {prompt.coachAnswer ? <p className="role">Coach draft (facts only): {prompt.coachAnswer}</p> : null}
            </div>
          ) : null}
          <ul className="interview-signals">
            {session.reminders.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </>
      )}
    </section>
  );
}

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<{ 0: { transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

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
        versions={data.versions}
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
  userName, email, phone, profile, versions, canEnhance, editing, setEditing, onSaved, onError,
}: {
  userName: string;
  email: string;
  phone: string;
  profile: NonNullable<AccountData["profile"]>;
  versions: AccountData["versions"];
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
  const [openResume, setOpenResume] = useState("");

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
          {profile.resumeName ? (
            <p className="role">
              Uploaded resume: {profile.resumeFileUrl ? (
                <a href={profile.resumeFileUrl} target="_blank" rel="noreferrer">{profile.resumeName}</a>
              ) : (
                profile.resumeName
              )}
            </p>
          ) : null}
          {versions.length ? <p className="role">{versions.length} resume{versions.length === 1 ? "" : "s"} on this profile. Open one below.</p> : null}
        </div>
        <button className="btn btn-ghost" type="button" onClick={() => setEditing(!editing)}>{editing ? "Close editor" : "Edit profile"}</button>
      </header>
      {error ? <p className="form-error">{error}</p> : null}
      {versions.length ? (
        <section className="account-card">
          <h2>Resumes</h2>
          <p className="role">Upscales and job-specific resumes are saved separately. The public one is what employers see until you choose another.</p>
          {versions.map((version) => (
            <article key={version.id}>
              <div className="quiet-row">
                <div>
                  <strong>{version.label}</strong>
                  <span>{resumeKindLabel(version)}</span>
                </div>
                <button className="text-btn" type="button" onClick={() => setOpenResume((current) => current === version.id ? "" : version.id)}>
                  {openResume === version.id ? "Hide resume" : "View resume"}
                </button>
              </div>
              {openResume === version.id ? <pre className="version-resume">{version.rendered || "This version has no text yet."}</pre> : null}
            </article>
          ))}
          <Link className="text-btn" to="/account/resume">Review and upscale</Link>
        </section>
      ) : null}
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
          {(profile.skillFacts || []).length ? (
            <section className="account-card">
              <h2>Facts that affect matching</h2>
              <p className="role">Edit skills above to correct these. Low-confidence unverified skills are ignored in match scores.</p>
              <ul className="fact-list">
                {(profile.skillFacts || []).map((fact) => (
                  <li key={fact.name}>
                    <strong>{fact.name}</strong>
                    {fact.verified ? " · Verified" : fact.confidence != null ? ` · ${Math.round(fact.confidence * 100)}% confidence` : ""}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
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
            <label className="field">
              <span>Target salary</span>
              <select value={salary} onChange={(event) => setSalary(event.target.value)}>
                {SALARY_RANGE_OPTIONS.map((option) => (
                  <option key={`salary-${option.value || "empty"}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
                {salary && !SALARY_RANGE_OPTIONS.some((option) => option.value === salary) ? (
                  <option value={salary}>{salary}</option>
                ) : null}
              </select>
            </label>
            <label className="field"><span>Locations</span><input value={locations} onChange={(event) => setLocations(event.target.value)} /></label>
            <label className="field">
              <span>Work arrangement</span>
              <select value={workArrangement} onChange={(event) => setWorkArrangement(event.target.value)}>
                {WORK_ARRANGEMENT_OPTIONS.map((option) => (
                  <option key={`arr-${option.value || "empty"}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
                {workArrangement && !WORK_ARRANGEMENT_OPTIONS.some((option) => option.value === workArrangement) ? (
                  <option value={workArrangement}>{workArrangement}</option>
                ) : null}
              </select>
            </label>
            <label className="field">
              <span>Work authorization</span>
              <select value={workAuthorization} onChange={(event) => setWorkAuthorization(event.target.value)}>
                {WORK_AUTHORIZATION_OPTIONS.map((option) => (
                  <option key={`auth-${option.value || "empty"}`} value={option.value}>
                    {option.label}
                  </option>
                ))}
                {workAuthorization && !WORK_AUTHORIZATION_OPTIONS.some((option) => option.value === workAuthorization) ? (
                  <option value={workAuthorization}>{workAuthorization}</option>
                ) : null}
              </select>
            </label>
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
  const [clarifyAnswers, setClarifyAnswers] = useState<Record<string, string>>({});
  const [clarifyBusy, setClarifyBusy] = useState("");
  const [openVersion, setOpenVersion] = useState("");
  const [upscaleResult, setUpscaleResult] = useState<{ label: string; rendered: string; changes: { before: string; after: string }[] } | null>(null);
  const reviewId = data?.review?.id || "";

  useEffect(() => {
    const ids = (data?.review?.recommendations || [])
      .filter((item) => item.kind === "rewrite" && item.proposed)
      .map((item) => item.id);
    setSelected(ids);
    setClarifyAnswers({});
  }, [reviewId]);

  if (!data) return null;
  return (
    <Gate feature="resume_review">
      <div className="account-page">
        <header className="account-head">
          <div>
            <p className="eyebrow">Resume</p>
            <h1>Review and versions</h1>
            <p className="lede">
              Feedback stays here. Answer clarifications to grow the Fact Ledger, then accept rewrites into a new Upscale version.
              Your public resume does not change until you choose one.
            </p>
            {data.reviewQuota && !data.reviewQuota.unlimited ? (
              <p className="role">Resume reviews this week: {data.reviewQuota.used} used, {data.reviewQuota.remaining} left on {data.plan.name}.</p>
            ) : null}
          </div>
          <button className="btn btn-primary" type="button" onClick={() => void api("/api/resume/review", { method: "POST" }).then(reload).catch((err: Error) => setError(err.message))}>Analyze resume</button>
        </header>
        {upscaleResult ? (
          <section className="account-card">
            <h2>{upscaleResult.label} is saved</h2>
            <p className="lede">This is a separate resume. Your public resume is unchanged until you choose this version.</p>
            {upscaleResult.changes.map((change) => (
              <p className="role" key={`${change.before}-${change.after}`}>
                {change.before} → {change.after}
              </p>
            ))}
            <pre className="version-resume">{upscaleResult.rendered}</pre>
          </section>
        ) : null}
        <div className="account-split">
          <section className="account-card">
            <h2>{data.review ? `Rating ${data.review.rating}` : "No review yet"}</h2>
            {data.review ? (
              <>
                {data.review.feedback.map((line) => <p key={line}>{line}</p>)}
                {data.review.recommendations.map((item) => {
                  const isClarify = item.kind === "clarify" || (item.kind === "note" && !item.proposed);
                  if (isClarify) {
                    return (
                      <article className="clarify-card" key={item.id}>
                        <strong>{item.title}</strong>
                        <p className="role">{item.detail}</p>
                        {item.answered ? (
                          <p className="role">Saved to Fact Ledger: {item.answer}</p>
                        ) : (
                          <div className="clarify-row">
                            <input
                              value={clarifyAnswers[item.id] || ""}
                              onChange={(event) => setClarifyAnswers((current) => ({ ...current, [item.id]: event.target.value }))}
                              placeholder={item.clarifyType === "skill" ? "e.g. SQL" : "e.g. raised completion 18%"}
                            />
                            <button
                              className="btn btn-ghost btn-sm"
                              type="button"
                              disabled={clarifyBusy === item.id || !(clarifyAnswers[item.id] || "").trim()}
                              onClick={() => {
                                setClarifyBusy(item.id);
                                void api<{ message?: string }>("/api/resume/clarify", {
                                  method: "POST",
                                  body: JSON.stringify({
                                    reviewId: data.review?.id,
                                    recommendationId: item.id,
                                    answer: clarifyAnswers[item.id],
                                  }),
                                })
                                  .then((result) => {
                                    setMessage(result.message || "Saved to Fact Ledger.");
                                    setClarifyAnswers((current) => {
                                      const next = { ...current };
                                      delete next[item.id];
                                      return next;
                                    });
                                    return reload();
                                  })
                                  .catch((err: Error) => setError(err.message))
                                  .finally(() => setClarifyBusy(""));
                              }}
                            >
                              {clarifyBusy === item.id ? "Saving…" : "Save to Fact Ledger"}
                            </button>
                          </div>
                        )}
                      </article>
                    );
                  }
                  return (
                    <article className="clarify-card" key={item.id}>
                      <label className="check-row">
                        <input
                          type="checkbox"
                          disabled={item.kind !== "rewrite"}
                          checked={selected.includes(item.id)}
                          onChange={(event) =>
                            setSelected((current) =>
                              event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id),
                            )
                          }
                        />
                        <span>
                          <strong>{item.title}</strong>
                          <br />
                          {item.detail}
                        </span>
                      </label>
                      {item.before ? <p className="role">Now: {item.before}</p> : null}
                      {item.proposed ? <p className="role">Proposed: {item.proposed}</p> : null}
                    </article>
                  );
                })}
                <p className="lede">Apply the checked changes to a new resume?</p>
                <button
                  className="btn btn-primary btn-sm"
                  type="button"
                  disabled={!data.features.resume_upscale || !selected.length}
                  onClick={() =>
                    void api<{ label: string; rendered: string; changes?: { before: string; after: string }[] }>("/api/resume/apply", {
                      method: "POST",
                      body: JSON.stringify({ reviewId: data.review?.id, recommendationIds: selected }),
                    })
                      .then((result) => {
                        setUpscaleResult({
                          label: result.label,
                          rendered: result.rendered,
                          changes: result.changes || [],
                        });
                        setOpenVersion("");
                        setMessage(`${result.label} is ready to view.`);
                        return reload();
                      })
                      .catch((err: Error) => setError(err.message))
                  }
                >
                  {data.features.resume_upscale ? "Apply selected changes" : "Upscale is not on this plan"}
                </button>
              </>
            ) : (
              <p>
                {data.versions.length
                  ? `Your uploaded resume is saved${data.profile?.resumeName ? ` as “${data.profile.resumeName}”` : ""}. Run an analysis to see what to improve.`
                  : "Run an analysis to see what to improve."}
              </p>
            )}
          </section>
          <section className="account-card">
            <h2>Versions</h2>
            {data.versions.length ? (
              data.versions.map((version) => (
              <article key={version.id} className="version-mini">
                <strong>{version.label}</strong>
                <p className="role">{resumeKindLabel(version)}</p>
                <div className="version-actions">
                  <button className="text-btn" type="button" onClick={() => setOpenVersion((current) => current === version.id ? "" : version.id)}>
                    {openVersion === version.id ? "Hide resume" : "View resume"}
                  </button>
                  {!version.active ? (
                    <button
                      className="text-btn"
                      type="button"
                      onClick={() =>
                        void api(`/api/resume/versions/${version.id}/activate`, { method: "POST" }).then(() => {
                          setMessage("Public resume updated.");
                          return reload();
                        })
                      }
                    >
                      Use this version
                    </button>
                  ) : null}
                </div>
                {openVersion === version.id ? <pre className="version-resume">{version.rendered || "This version has no text yet."}</pre> : null}
              </article>
            ))
            ) : (
              <p className="role">
                No resume version yet.{" "}
                <Link className="text-btn" to="/get-started">Upload a resume</Link> to save your first version.
              </p>
            )}
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

export function InvitesPage() {
  const { setError, setMessage, reload } = useAccount();
  const [invites, setInvites] = useState<{
    id: string;
    status: string;
    message: string;
    overlap: { score: number; matched: string[]; missing: string[] };
    posting: {
      id: string;
      title: string;
      company: string;
      location: string;
      description: string;
      skills: string[];
      jobId: string;
      applyUrl: string;
    } | null;
  }[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    const data = await api<{ invites: typeof invites }>("/api/invites");
    setInvites(data.invites);
    setLoaded(true);
  }

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
  }, [setError]);

  async function respond(inviteId: string, status: "viewed" | "accepted" | "declined") {
    try {
      const data = await api<{ invite: (typeof invites)[number]; applicationId?: string }>(`/api/invites/${inviteId}/respond`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      setInvites((current) => current.map((item) => (item.id === inviteId ? { ...item, ...data.invite } : item)));
      if (status === "accepted") {
        setMessage(data.applicationId ? "Invite accepted and added to your tracker." : "Invite accepted.");
        await reload();
      } else if (status === "declined") {
        setMessage("Invite declined.");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update invite.");
    }
  }

  return (
    <Gate feature="job_browse">
      <div className="account-page">
        <header className="account-head">
          <div>
            <p className="eyebrow">Inbound</p>
            <h1>Employer invites</h1>
            <p className="lede">Employers who found your public profile can invite you to open roles. Accepting adds the role to your tracker.</p>
          </div>
        </header>
        {!loaded ? <p className="lede">Loading invites…</p> : null}
        {loaded && !invites.length ? (
          <section className="account-card">
            <h2>No invites yet</h2>
            <p className="lede">Keep a public resume link on if you want employers to reach you.</p>
            <Link className="btn btn-primary btn-sm" to="/account/settings">Open settings</Link>
          </section>
        ) : null}
        {invites.map((invite) => (
          <article className="account-card" key={invite.id}>
            <h2>{invite.posting?.title || "Role"}</h2>
            <p className="role">
              {invite.posting?.company || "Employer"}
              {invite.posting?.location ? ` · ${invite.posting.location}` : ""}
              {` · ${invite.status}`}
              {invite.overlap?.score != null ? ` · ${invite.overlap.score}% skill overlap` : ""}
            </p>
            {invite.message ? <p>{invite.message}</p> : null}
            {(invite.overlap?.matched || []).length ? (
              <p className="role">Matched: {invite.overlap.matched.join(", ")}</p>
            ) : null}
            {(invite.overlap?.missing || []).length ? (
              <p className="role">Gaps called out honestly: {invite.overlap.missing.join(", ")}</p>
            ) : null}
            <div className="job-actions" style={{ justifyContent: "flex-start" }}>
              {invite.status === "pending" ? (
                <button className="btn btn-ghost btn-sm" type="button" onClick={() => void respond(invite.id, "viewed")}>Mark viewed</button>
              ) : null}
              {["pending", "viewed"].includes(invite.status) ? (
                <>
                  <button className="btn btn-primary btn-sm" type="button" onClick={() => void respond(invite.id, "accepted")}>Accept</button>
                  <button className="btn btn-ghost btn-sm" type="button" onClick={() => void respond(invite.id, "declined")}>Decline</button>
                </>
              ) : null}
              {invite.posting?.jobId ? <Link className="btn btn-ghost btn-sm" to="/account/jobs">Browse jobs</Link> : null}
            </div>
          </article>
        ))}
      </div>
    </Gate>
  );
}

function JobPosting({ job }: { job: AccountData["jobs"][number] }) {
  const posting = job.posting;
  if (!posting) return <p className="job-summary">{job.description}</p>;
  return (
    <div className="job-posting">
      {posting.facts.length ? (
        <div className="job-facts">
          {posting.facts.map((fact) => (
            <span className="job-fact" key={`${fact.label}-${fact.value}`}>{fact.label}: {fact.value}</span>
          ))}
        </div>
      ) : null}
      {posting.summary ? <p className="job-summary">{posting.summary}</p> : null}
      {posting.sections.map((section) => (
        <section className="job-section" key={section.heading}>
          <h3>{section.heading}</h3>
          {section.items?.length ? (
            <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>
          ) : section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </section>
      ))}
    </div>
  );
}

function MatchFit({
  job,
  canConfirm,
  onConfirm,
}: {
  job: AccountData["jobs"][number];
  canConfirm: boolean;
  onConfirm: (skill: string) => Promise<void>;
}) {
  const [pending, setPending] = useState("");
  if (job.explanationLocked) {
    return <p className="role">Explanation locked — weekly Free/Starter quota reached. Upgrade for more.</p>;
  }
  const fit = job.fit;
  if (!fit) return null;
  async function confirm(skill: string) {
    setPending(skill);
    try {
      await onConfirm(skill);
    } finally {
      setPending("");
    }
  }
  return (
    <div className="match-fit">
      {fit.fits.length ? <p className="match-line"><span>Fits your resume</span>{fit.fits.join(" · ")}</p> : null}
      {fit.gaps.length ? <p className="match-line"><span>Missing</span>{fit.gaps.join(" · ")}</p> : null}
      {canConfirm && fit.gaps.length ? (
        <>
          <p className="role">Only confirm a skill from real experience. It is saved to the Fact Ledger.</p>
          <div className="skill-confirm">
            {fit.gaps.map((skill) => (
              <button className="btn btn-ghost btn-sm" type="button" key={skill} disabled={Boolean(pending)} onClick={() => void confirm(skill)}>
                {pending === skill ? "Saving…" : `I have ${skill}`}
              </button>
            ))}
          </div>
        </>
      ) : null}
      {fit.notes.map((note) => <p className="role" key={note}>{note}</p>)}
      {!fit.fits.length && !fit.gaps.length ? <p className="role">{fit.summary}</p> : null}
    </div>
  );
}

export function JobsPage() {
  const { data, reload, setError, setMessage } = useAccount();
  const [pasteText, setPasteText] = useState("");
  const [pasteUrl, setPasteUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [importedId, setImportedId] = useState("");
  useEffect(() => {
    if (!importedId || !data) return;
    document.getElementById(`job-${importedId}`)?.scrollIntoView({ block: "start" });
  }, [importedId, data]);
  if (!data) return null;

  async function confirmSkill(jobId: string, skill: string) {
    try {
      const result = await api<{ message?: string }>(`/api/jobs/${jobId}/confirm-skill`, {
        method: "POST",
        body: JSON.stringify({ skill }),
      });
      setMessage(result.message || `${skill} is saved to your Fact Ledger.`);
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm that skill.");
    }
  }

  async function importJob(action: "" | "prepare" | "track") {
    setBusy(true);
    try {
      const result = await api<{ held?: boolean; message?: string; job?: { id: string; title: string } }>("/api/jobs/paste", {
        method: "POST",
        body: JSON.stringify({ text: pasteText, url: pasteUrl, action }),
      });
      setPasteText("");
      setPasteUrl("");
      if (result.held) {
        setMessage(result.message || "That page is not a job listing, so it was not added.");
        return;
      }
      setImportedId(result.job?.id || "");
      setMessage(action === "prepare" ? `${result.job?.title || "Job"} is at the top of your list and prepared.` : action === "track" ? `${result.job?.title || "Job"} is at the top of your list.` : `${result.job?.title || "Job"} is at the top of your list.`);
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
            <CountBars
              title="This job list"
              rows={[
                { label: "In this list", value: data.stats.available },
                { label: "Strong matches", value: data.stats.recommended },
              ]}
            />
            {data.matchQuota && !data.matchQuota.unlimited ? (
              <p className="role">Match explanations this week: {data.matchQuota.used} used, {data.matchQuota.remaining} left on {data.plan.name}.</p>
            ) : null}
          </div>
        </header>
        <section className="account-card">
          <h2>Add a job</h2>
          <p className="lede">Paste any job link. If the page is private, paste the description instead. The role you add stays at the top of this list.</p>
          <label className="field"><span>Job link</span><input value={pasteUrl} onChange={(event) => setPasteUrl(event.target.value)} placeholder="https://company.com/jobs/..." /></label>
          <label className="field"><span>Or paste description</span><textarea rows={5} value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder={"Title\nCompany\nRequirements..."} /></label>
          <div className="job-actions">
            <button className="btn btn-primary btn-sm" type="button" disabled={busy || (!pasteText.trim() && !pasteUrl.trim())} onClick={() => void importJob("")}>Import</button>
            {data.features.manual_apply ? (
              <>
                <button className="btn btn-ghost btn-sm" type="button" disabled={busy || (!pasteText.trim() && !pasteUrl.trim())} onClick={() => void importJob("prepare")}>Import & Assisted Apply</button>
                <button className="btn btn-ghost btn-sm" type="button" disabled={busy || (!pasteText.trim() && !pasteUrl.trim())} onClick={() => void importJob("track")}>Import & track</button>
              </>
            ) : null}
          </div>
        </section>
        {data.jobs.map((job) => {
          const application = data.applications.find((item) => item.jobId === job.id);
          return (
          <article className="account-card job-listing" id={`job-${job.id}`} key={job.id}>
            <div className="job-card" style={{ padding: 0, boxShadow: "none", background: "transparent" }}>
            <div>
              <p className="role">{[job.imported ? "Added by you" : "", job.category, job.verification].filter(Boolean).join(" · ")}</p>
              <h2>{job.title}</h2>
              <p>{job.applyCompany || job.company}{job.location || job.remoteType ? ` · ${job.location || job.remoteType}` : ""}</p>
              {job.viaCompany ? <p className="role">Listed by {job.viaCompany}{job.sourceName ? ` on ${job.sourceName}` : ""}. This application goes to {job.applyCompany}.</p> : null}
              {job.primaryUrl ? <p><a href={job.primaryUrl} target="_blank" rel="noreferrer">Open original listing</a></p> : null}
              <JobPosting job={job} />
              <MatchFit job={job} canConfirm={Boolean(data.features.profile_edit)} onConfirm={(skill) => confirmSkill(job.id, skill)} />
            </div>
            <div className="job-side">
              <ScorePill score={job.score} />
              {job.label ? <p className="role">{job.label}</p> : null}
              {job.applied ? <p className="role">In your tracker</p> : (
                <div className="job-actions">
                  <button className="btn btn-primary btn-sm" type="button" disabled={!data.features.manual_apply} onClick={() => void api("/api/applications", { method: "POST", body: JSON.stringify({ jobId: job.id, action: "prepare" }) }).then(reload).catch((err: Error) => setError(err.message))}>
                    {data.features.manual_apply ? "Assisted Apply" : "Upgrade to apply"}
                  </button>
                  {data.features.manual_apply ? (
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => void api("/api/applications", { method: "POST", body: JSON.stringify({ jobId: job.id, action: "track" }) }).then(reload).catch((err: Error) => setError(err.message))}>
                      Track
                    </button>
                  ) : null}
                </div>
              )}
            </div>
            </div>
            {application?.tailored ? <TailoredResume tailored={application.tailored} applicationId={application.id} /> : null}
          </article>
          );
        })}
      </div>
    </Gate>
  );
}

export function ApplicationsPage() {
  const { data, reload, setMessage, setError } = useAccount();
  const [savingStatusId, setSavingStatusId] = useState("");
  const location = useLocation();
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const id = location.hash.replace(/^#/, "");
    if (!id || !data) return;
    document.getElementById(id)?.scrollIntoView({ block: "start" });
  }, [location.hash, data]);
  if (!data) return null;
  const statuses = data.statuses?.length
    ? data.statuses
    : [
        "Found",
        "Reviewed",
        "Skipped",
        "Resume preparing",
        "Ready",
        "Review required",
        "Applied",
        "Employer viewed",
        "Recruiter contact",
        "Responded",
        "Interview",
        "Offer",
        "Hired",
        "Rejected",
        "Withdrawn",
      ];
  const weekOnly = searchParams.get("week") === "1";
  const weekRoles = new Map((data.week?.roles || []).map((role) => [role.id, role]));
  const applications = weekOnly
    ? (data.week?.roles || []).flatMap((role) => {
        const match = data.applications.find((item) => item.id === role.id);
        return match ? [match] : [];
      })
    : data.applications;
  const weekKindCounts = { Submitted: 0, Prepared: 0, Tracked: 0 };
  for (const role of data.week?.roles || []) {
    if (role.label === "Submitted" || role.label === "Prepared" || role.label === "Tracked") {
      weekKindCounts[role.label] += 1;
    }
  }
  const stageStatuses = (weekOnly ? applications : data.applications).map((item) => item.status);
  return (
    <Gate>
      <div className="account-page">
        <header className="account-head">
          <div>
            <p className="eyebrow">Applications</p>
            <h1>Tracker</h1>
            <p className="lede">
              Assisted Apply is the default — review the kit, paste into the employer form, then mark Applied.
            </p>
          </div>
        </header>
        <section className="account-card chart-card">
          <h2>Tracker at a glance</h2>
          <div className="chart-layout">
            {!weekOnly && typeof data.stats.kitCompletionRate === "number" ? (
              <ScoreRing label="Kit completion" value={data.stats.kitCompletionRate} />
            ) : null}
            <CountBars
              title="Tracker at a glance"
              rows={weekOnly
                ? [
                    { label: "This week", value: applications.length },
                    { label: "Submitted", value: weekKindCounts.Submitted },
                    { label: "Prepared", value: weekKindCounts.Prepared },
                    { label: "Tracked", value: weekKindCounts.Tracked },
                  ]
                : [
                    { label: "In tracker", value: data.stats.tracked ?? data.stats.applied },
                    { label: "Ready", value: data.stats.ready || 0 },
                    { label: "Need review", value: data.stats.reviewRequired || 0 },
                    { label: "Follow-ups due", value: data.stats.followUpsDue || 0 },
                  ]}
            />
          </div>
          {!weekOnly && typeof data.stats.kitCompletionRate === "number" ? (
            <p className="role">{data.stats.kitCompleted || 0} of {data.stats.kitOpened || 0} kits finished.</p>
          ) : null}
        </section>
        <section className="account-card chart-card">
          <h2>Where your roles are</h2>
          <CountBars title="Application stages" rows={pipelineRows(stageStatuses)} />
        </section>
        {data.features.manual_apply ? (
          <FollowUpsPanel
            onDone={(message) => { setMessage(message || "Follow-up updated."); void reload(); }}
            onError={(message) => setError(message)}
          />
        ) : null}
        {data.features.auto_apply ? (
          <AutoApply
            enabled={data.autoApply}
            minMatch={data.autoMin}
            dailyCap={data.autoDailyCap || 5}
            capUsed={data.autoCapUsed || 0}
            excludeCompanies={data.profile?.preferences?.excludeCompanies || ""}
            excludeKeywords={data.profile?.preferences?.excludeKeywords || ""}
            authorization={data.autoApplyAuthorization}
            onDone={() => { setMessage("Auto apply updated."); void reload(); }}
          />
        ) : (
          <section className="account-card">
            <h2>Review-first Assisted Apply</h2>
            <p>Assisted Apply prepares a tailored resume and copy kit. You review everything, submit on the employer site, then mark Applied here. Email submit stays available only when readiness clears.</p>
          </section>
        )}
        <div className="dash-tabs" role="tablist" aria-label="Tracker range">
          <Link className={searchParams.get("week") === "1" ? "" : "on"} to="/account/applications">All</Link>
          <Link className={searchParams.get("week") === "1" ? "on" : ""} to="/account/applications?week=1">This week</Link>
        </div>
        {applications.length ? applications.map((item, index) => {
          const assistedOpen =
            index === applications.findIndex((row) =>
              ["Ready", "Review required", "Resume preparing"].includes(row.status),
            );
          const weekRole = weekRoles.get(item.id);
          return (
          <article className="account-card" id={`application-${item.id}`} key={item.id}>
            <div className="job-card" style={{ padding: 0, boxShadow: "none", background: "transparent" }}>
              <div>
                <h2>{item.title}</h2>
                <p className="role">{[item.company, item.mode].filter(Boolean).join(" · ")}</p>
                {weekRole ? <p className="role">This week · {weekRole.label}</p> : null}
                <StageRail status={item.status} />
                {item.checks?.length ? (
                  <ol className="check-history">
                    {item.checks.map((check) => (
                      <li key={check.id}>
                        <strong>{check.label}</strong>
                        <time dateTime={new Date(check.createdAt).toISOString()}>{new Date(check.createdAt).toLocaleDateString()}</time>
                        {check.note ? <span>{check.note}</span> : null}
                        {check.toStatus && check.toStatus !== check.fromStatus ? <span>Stage is now {check.toStatus}</span> : null}
                      </li>
                    ))}
                  </ol>
                ) : null}
                {data.features.manual_apply && CHECK_IN_STATUSES.includes(item.status) ? (
                  <ApplicationCheckIn
                    applicationId={item.id}
                    onDone={(message) => { setMessage(message || "Check-in saved."); void reload(); }}
                    onError={(message) => setError(message)}
                  />
                ) : null}
                {item.versionLabel ? <p className="role">Pinned resume: {item.versionLabel}</p> : null}
                {item.viaCompany ? <p className="role">Found through {item.viaCompany}{item.sourceName ? ` on ${item.sourceName}` : ""}</p> : null}
                {item.delivery ? <p className="role">{item.delivery}</p> : null}
                {item.targetUrl ? <a href={item.targetUrl} target="_blank" rel="noreferrer">Open employer listing</a> : null}
              </div>
              <div className="job-side">
                <ScorePill score={item.match} />
                {["Ready", "Review required", "Resume preparing", "Found"].includes(item.status) && data.features.manual_apply && data.versions.length ? (
                  <select
                    aria-label="Pinned resume version"
                    value={item.versionId || ""}
                    onChange={(event) =>
                      void api(`/api/applications/${item.id}/version`, {
                        method: "PUT",
                        body: JSON.stringify({ versionId: event.target.value }),
                      })
                        .then(() => { setMessage("Resume version pinned."); return reload(); })
                        .catch((err: Error) => setError(err.message))
                    }
                  >
                    <option value="" disabled>Pin resume version</option>
                    {data.versions.map((version) => (
                      <option key={version.id} value={version.id}>{version.label}</option>
                    ))}
                  </select>
                ) : null}
                {["Ready", "Review required", "Resume preparing"].includes(item.status) && data.features.manual_apply ? (
                  <button
                    className="btn btn-ghost btn-sm"
                    type="button"
                    onClick={() => void api<{ message?: string }>(`/api/applications/${item.id}/submit`, { method: "POST" }).then((result) => { setMessage(result.message || "Application submitted."); return reload(); }).catch((err: Error) => setError(err.message))}
                  >
                    Email submit
                  </button>
                ) : null}
                <select
                  value={item.status}
                  disabled={savingStatusId === item.id}
                  onChange={(event) => {
                    const select = event.currentTarget;
                    const status = select.value;
                    select.blur();
                    setSavingStatusId(item.id);
                    void api<{ message?: string }>(`/api/applications/${item.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({ status }),
                    })
                      .then((result) => {
                        if (result.message) setMessage(result.message);
                        return reload();
                      })
                      .catch((err: Error) => setError(err.message))
                      .finally(() => setSavingStatusId(""));
                  }}
                >
                  {statuses.map((status) => <option key={status}>{status}</option>)}
                </select>
              </div>
            </div>
            {item.tailored ? <TailoredResume tailored={item.tailored} /> : null}
            {["Ready", "Review required", "Resume preparing"].includes(item.status) && data.features.manual_apply ? (
              <BrowserApplyAssistant
                applicationId={item.id}
                defaultOpen={assistedOpen}
                versions={data.versions}
                versionId={item.versionId}
                onDone={(message) => { setMessage(message || "Marked Applied after Assisted Apply."); void reload(); }}
                onError={(message) => setError(message)}
              />
            ) : null}
            {["Ready", "Review required", "Applied", "Employer viewed", "Recruiter contact", "Responded", "Interview", "Offer", "Hired"].includes(item.status) ? (
              <InterviewPrepPanel
                applicationId={item.id}
                onError={(message) => setError(message)}
              />
            ) : null}
            {(item.questions?.length || ["Ready", "Review required", "Resume preparing", "Found"].includes(item.status)) ? (
              <QuestionDrafts
                applicationId={item.id}
                initial={item.questions || []}
                onSaved={() => { setMessage("Answers saved."); void reload(); }}
                onError={(message) => setError(message)}
              />
            ) : null}
          </article>
          );
        }) : <p className="role">{weekOnly ? "Nothing moved this week." : "Your tracker is empty."}</p>}
      </div>
    </Gate>
  );
}

type ApplyKit = {
  applicationId: string;
  status: string;
  mode?: string;
  eligible: boolean;
  title: string;
  company: string;
  viaCompany: string;
  listingUrl: string;
  contact: { key: string; label: string; value: string; ready: boolean; note: string }[];
  resumeText: string;
  versionId?: string;
  versionLabel?: string;
  versionPinned?: boolean;
  answers: { id: string; prompt: string; answer: string; kind: string; blankReason: string; hint: string; ready: boolean }[];
  blankCount: number;
  steps: { id: string; title: string; detail: string; ready: boolean }[];
  canComplete: boolean;
  readiness?: {
    state: string;
    matchScore: number;
    resumeAlignment: number;
    questionsComplete: number;
    documentsComplete: number;
    blockers: string[];
  };
  metrics?: {
    opened: number;
    copied: number;
    completed: number;
    completionRate: number;
  };
};

function BrowserApplyAssistant({
  applicationId,
  defaultOpen = false,
  onDone,
  onError,
}: {
  applicationId: string;
  defaultOpen?: boolean;
  versions?: { id: string; label: string }[];
  versionId?: string;
  onDone: (message?: string) => void;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [kit, setKit] = useState<ApplyKit | null>(null);
  const [copied, setCopied] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (defaultOpen) {
      setOpen(true);
      void load().catch((err: Error) => onError(err.message));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applicationId, defaultOpen]);

  async function load() {
    const data = await api<{ kit: ApplyKit }>(`/api/applications/${applicationId}/apply-kit`);
    setKit(data.kit);
  }

  async function copyText(label: string, value: string) {
    if (!value.trim()) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied((current) => (current === label ? "" : current)), 1600);
      void api(`/api/applications/${applicationId}/apply-kit/event`, {
        method: "POST",
        body: JSON.stringify({ event: "copied", detail: label }),
      }).catch(() => undefined);
    } catch {
      onError("Clipboard access was blocked. Select and copy the text manually.");
    }
  }

  return (
    <div className="apply-kit">
      <button
        className="btn btn-primary btn-sm"
        type="button"
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) void load().catch((err: Error) => onError(err.message));
        }}
      >
        {open ? "Hide Assisted Apply kit" : "Assisted Apply kit"}
      </button>
      {open ? (
        <div className="apply-kit-panel">
          {!kit ? <p className="role">Loading apply kit…</p> : (
            <>
              <p className="lede">
                Keep this open beside the employer form. Copy contact, resume, and answers — JobPilot never invents values.
                {kit.blankCount ? ` ${kit.blankCount} answer${kit.blankCount === 1 ? "" : "s"} still need you.` : ""}
              </p>
              {kit.versionLabel ? <p className="role">Pinned resume: {kit.versionLabel}</p> : null}
              {kit.readiness ? (
                <p className={kit.readiness.state === "APPLICATION_READY" ? "role" : "form-error"} role="status">
                  {kit.readiness.state === "APPLICATION_READY"
                    ? `Application ready · match ${kit.readiness.matchScore}% · resume alignment ${kit.readiness.resumeAlignment}%`
                    : `User action required · ${(kit.readiness.blockers || []).slice(0, 2).join(" ")}`}
                </p>
              ) : null}
              {kit.metrics ? (
                <p className="role">Kit opens {kit.metrics.opened} · copies {kit.metrics.copied} · completed {kit.metrics.completed}</p>
              ) : null}
              <ol className="apply-kit-steps">
                {kit.steps.map((step) => (
                  <li key={step.id} className={step.ready ? "ready" : "pending"}>
                    <strong>{step.title}</strong>
                    <span>{step.detail}</span>
                  </li>
                ))}
              </ol>
              <div className="job-actions">
                {kit.listingUrl ? (
                  <a className="btn btn-primary btn-sm" href={kit.listingUrl} target="_blank" rel="noreferrer">
                    Open listing
                  </a>
                ) : null}
                <button
                  className="btn btn-ghost btn-sm"
                  type="button"
                  disabled={busy || !kit.canComplete}
                  onClick={() => {
                    setBusy(true);
                    void api<{ message?: string }>(`/api/applications/${applicationId}/apply-kit/complete`, { method: "POST" })
                      .then((result) => onDone(result.message))
                      .catch((err: Error) => onError(err.message))
                      .finally(() => setBusy(false));
                  }}
                >
                  I submitted on their site
                </button>
              </div>
              <h3>Contact</h3>
              {kit.contact.map((field) => (
                <div className="apply-kit-row" key={field.key}>
                  <div>
                    <strong>{field.label}</strong>
                    <p className="role">{field.value || field.note || "Empty"}</p>
                  </div>
                  <button className="text-btn" type="button" disabled={!field.value} onClick={() => void copyText(field.label, field.value)}>
                    {copied === field.label ? "Copied" : "Copy"}
                  </button>
                </div>
              ))}
              <h3>Tailored resume</h3>
              <div className="apply-kit-row">
                <p className="role">{kit.resumeText ? `${kit.resumeText.slice(0, 160)}${kit.resumeText.length > 160 ? "…" : ""}` : "No tailored resume yet."}</p>
                <button className="text-btn" type="button" disabled={!kit.resumeText} onClick={() => void copyText("Resume", kit.resumeText)}>
                  {copied === "Resume" ? "Copied" : "Copy all"}
                </button>
              </div>
              {kit.resumeText ? <pre className="apply-kit-resume">{kit.resumeText}</pre> : null}
              <h3>Answers</h3>
              {kit.answers.length ? kit.answers.map((item) => (
                <div className="apply-kit-row" key={item.id}>
                  <div>
                    <strong>{item.prompt}</strong>
                    <p className="role">{item.answer || item.blankReason || item.hint || "Fill this yourself."}</p>
                  </div>
                  <button className="text-btn" type="button" disabled={!item.answer} onClick={() => void copyText(item.id, item.answer)}>
                    {copied === item.id ? "Copied" : "Copy"}
                  </button>
                </div>
              )) : <p className="role">No question drafts for this listing.</p>}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

type FollowUpReminder = {
  id: string;
  applicationId: string;
  kind: string;
  title: string;
  detail: string;
  company: string;
  roleTitle: string;
  status: string;
  dueAt: number;
  overdue: boolean;
};

const CHECK_ANSWERS = [
  { answer: "waiting", label: "Still waiting" },
  { answer: "replied", label: "They replied" },
  { answer: "interview", label: "Interview" },
  { answer: "rejected", label: "Rejected" },
];

const CHECK_IN_STATUSES = [
  "Applied",
  "Employer viewed",
  "Recruiter contact",
  "Responded",
  "Interview",
  "Offer",
  "Hired",
];

function ApplicationCheckIn({
  applicationId,
  onDone,
  onError,
}: {
  applicationId: string;
  onDone: (message?: string) => void;
  onError: (message: string) => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function checkIn(answer: string) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await api<{ message?: string }>(`/api/applications/${applicationId}/check-in`, {
        method: "POST",
        body: JSON.stringify({ answer, note }),
      });
      setNote("");
      onDone(result.message);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not save that check-in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="check-in">
      <label className="field">
        <span>What happened</span>
        <input
          value={note}
          maxLength={240}
          placeholder="Optional sentence you actually heard"
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <div className="check-actions">
        {CHECK_ANSWERS.map((choice) => (
          <button
            className={choice.answer === "rejected" ? "btn btn-ghost btn-sm check-reject" : "btn btn-ghost btn-sm"}
            type="button"
            key={choice.answer}
            disabled={busy}
            onClick={() => void checkIn(choice.answer)}
          >
            {choice.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function FollowUpsPanel({
  onDone,
  onError,
}: {
  onDone: (message?: string) => void;
  onError: (message: string) => void;
}) {
  const [reminders, setReminders] = useState<FollowUpReminder[]>([]);
  const [metrics, setMetrics] = useState<{ open: number; due: number; done: number } | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const data = await api<{ reminders: FollowUpReminder[]; metrics: { open: number; due: number; done: number } }>("/api/follow-ups");
    setReminders(data.reminders || []);
    setMetrics(data.metrics || null);
  }

  useEffect(() => {
    void load().catch((err: Error) => onError(err.message));
  }, [onError]);

  async function act(id: string, action: string) {
    await api(`/api/follow-ups/${id}/${action}`, {
      method: "POST",
      body: JSON.stringify(action === "snooze" ? { snoozeDays: 2 } : {}),
    });
    await load();
    onDone();
  }

  async function checkIn(id: string, answer: string) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await api<{ message?: string }>(`/api/follow-ups/${id}/check-in`, {
        method: "POST",
        body: JSON.stringify({ answer }),
      });
      await load();
      onDone(result.message);
    } finally {
      setBusy(false);
    }
  }

  if (!reminders.length && !metrics?.due) {
    return (
      <section className="account-card" id="follow-ups">
        <h2>Follow-up reminders</h2>
        <p className="role">After you apply, each role asks what happened. Still waiting, They replied, Interview, or Rejected is saved on that application.</p>
      </section>
    );
  }

  return (
    <section className="account-card" id="follow-ups">
      <h2>Follow-up reminders</h2>
      <p className="role">
        {metrics ? `${metrics.due} due · ${metrics.open} open · ${metrics.done} done` : "Loading…"}
      </p>
      {reminders.map((item) => (
        <div className="check-reminder" key={item.id}>
          <div>
            <strong>{item.title}</strong>
            <p className="role">
              {[item.roleTitle, item.company].filter(Boolean).join(" · ")}
              {item.overdue ? " · due now" : ` · due ${new Date(item.dueAt).toLocaleDateString()}`}
            </p>
            <p className="role">{item.detail}</p>
          </div>
          <div className="check-actions">
            {CHECK_ANSWERS.map((choice) => (
              <button
                className={choice.answer === "rejected" ? "btn btn-ghost btn-sm check-reject" : "btn btn-ghost btn-sm"}
                type="button"
                key={choice.answer}
                disabled={busy}
                onClick={() => void checkIn(item.id, choice.answer).catch((err: Error) => onError(err.message))}
              >
                {choice.label}
              </button>
            ))}
            <button className="text-btn" type="button" onClick={() => void act(item.id, "dismiss").catch((err: Error) => onError(err.message))}>Dismiss</button>
          </div>
        </div>
      ))}
    </section>
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
  authorization,
  onDone,
}: {
  enabled: boolean;
  minMatch: number;
  dailyCap: number;
  capUsed: number;
  excludeCompanies: string;
  excludeKeywords: string;
  authorization?: {
    version: string;
    text: string;
    authorized: boolean;
    authorizedAt: number | null;
  };
  onDone: () => void;
}) {
  const [on, setOn] = useState(enabled);
  const [min, setMin] = useState(minMatch);
  const [cap, setCap] = useState(dailyCap);
  const [companies, setCompanies] = useState(excludeCompanies);
  const [keywords, setKeywords] = useState(excludeKeywords);
  const [accepted, setAccepted] = useState(Boolean(authorization?.authorized));
  const needsAuth = on && !authorization?.authorized;
  return (
    <form
      className="account-card"
      onSubmit={(event) => {
        event.preventDefault();
        if (needsAuth && !accepted) return;
        void api("/api/account/auto-apply", {
          method: "PUT",
          body: JSON.stringify({
            enabled: on,
            minMatch: min,
            dailyCap: cap,
            excludeCompanies: companies,
            excludeKeywords: keywords,
            acceptAuthorization: accepted,
          }),
        })
          .then(() => (on ? api("/api/applications/auto", { method: "POST" }) : undefined))
          .then(onDone);
      }}
    >
      <h2>Controlled Auto-Apply</h2>
      <p className="lede">
        Autopilot queues Ready or Review required rows for your review — it never silently submits.
        Used {capUsed} of {cap} today.
        {authorization?.authorized
          ? ` Authorization accepted ${authorization.authorizedAt ? new Date(authorization.authorizedAt).toLocaleDateString() : ""} (v${authorization.version}).`
          : " Separate authorization is required before enabling."}
      </p>
      <label className="check-row">
        <input type="checkbox" checked={on} onChange={(event) => setOn(event.target.checked)} />
        Enable Auto-Apply queueing for matching jobs
      </label>
      {on ? (
        <div className="auto-apply-auth">
          <p className="role">{authorization?.text || "Accept Auto-Apply authorization to continue."}</p>
          <label className="check-row">
            <input
              type="checkbox"
              checked={accepted}
              disabled={Boolean(authorization?.authorized)}
              onChange={(event) => setAccepted(event.target.checked)}
            />
            {authorization?.authorized
              ? "Authorization on file for the current Auto-Apply terms"
              : "I have read and accept the Auto-Apply authorization above"}
          </label>
        </div>
      ) : null}
      <label className="field"><span>Minimum match</span><input type="number" min={50} max={99} value={min} onChange={(event) => setMin(Number(event.target.value))} /></label>
      <label className="field"><span>Daily cap</span><input type="number" min={1} max={25} value={cap} onChange={(event) => setCap(Number(event.target.value))} /></label>
      <label className="field"><span>Exclude companies</span><input value={companies} onChange={(event) => setCompanies(event.target.value)} placeholder="Acme, Staffing Hub" /></label>
      <label className="field"><span>Exclude keywords</span><input value={keywords} onChange={(event) => setKeywords(event.target.value)} placeholder="unpaid, clearance" /></label>
      <button className="btn btn-primary btn-sm" type="submit" disabled={needsAuth && !accepted}>
        {on ? "Save and queue" : "Save manual-only / revoke Auto-Apply"}
      </button>
    </form>
  );
}

function ExtensionSettings({
  onMessage,
  onError,
}: {
  onMessage: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [tokens, setTokens] = useState<{ id: string; prefix: string; label: string; active: boolean; createdAt: number; lastUsedAt: number | null }[]>([]);
  const [freshToken, setFreshToken] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const data = await api<{ tokens: typeof tokens }>("/api/extension/tokens");
    setTokens(data.tokens || []);
  }

  useEffect(() => {
    void load().catch((err: Error) => onError(err.message));
  }, [onError]);

  return (
    <section className="account-card">
      <h2>Browser extension capture</h2>
      <p className="role">
        Load the unpacked `extension/` folder in Chrome, paste an API token below into the popup, then capture listings from employer sites into your tracker.
      </p>
      {freshToken ? (
        <p className="form-error" role="status">
          Copy this token now — it will not be shown again: <code>{freshToken}</code>
        </p>
      ) : null}
      <div className="job-actions">
        <button
          className="btn btn-primary btn-sm"
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void api<{ token: { token: string } }>("/api/extension/tokens", {
              method: "POST",
              body: JSON.stringify({ label: "Browser extension" }),
            })
              .then((result) => {
                setFreshToken(result.token.token);
                onMessage("Extension token created. Copy it into the extension popup.");
                return load();
              })
              .catch((err: Error) => onError(err.message))
              .finally(() => setBusy(false));
          }}
        >
          Create extension token
        </button>
      </div>
      {tokens.length ? (
        <ul className="fact-list">
          {tokens.map((item) => (
            <li key={item.id}>
              {item.prefix}… · {item.label} · {item.active ? "active" : "revoked"}
              {item.active ? (
                <>
                  {" "}
                  <button
                    className="text-btn"
                    type="button"
                    onClick={() =>
                      void api(`/api/extension/tokens/${item.id}`, { method: "DELETE" })
                        .then(() => {
                          onMessage("Token revoked.");
                          return load();
                        })
                        .catch((err: Error) => onError(err.message))
                    }
                  >
                    Revoke
                  </button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="role">No tokens yet.</p>
      )}
    </section>
  );
}

export function PlanPage() {
  const { refresh } = useApp();
  const { data, reload, setError, setMessage } = useAccount();
  const [params, setParams] = useSearchParams();
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [gatewayId, setGatewayId] = useState("");
  const [acceptDisclosure, setAcceptDisclosure] = useState(false);

  useEffect(() => {
    if (data?.gateways[0] && !gatewayId) setGatewayId(data.gateways[0].id);
  }, [data, gatewayId]);

  useEffect(() => {
    if (data?.billingDisclosure?.accepted) setAcceptDisclosure(true);
  }, [data?.billingDisclosure?.accepted]);

  useEffect(() => {
    const checkoutId = params.get("checkout_id");
    if (params.get("checkout") === "success" && checkoutId) {
      void api("/api/billing/confirm", { method: "POST", body: JSON.stringify({ checkoutId }) })
        .then(reload)
        .then(() => setMessage("Plan updated."))
        .then(() => refresh())
        .catch((err: Error) => setError(err.message));
      setParams({}, { replace: true });
    }
  }, [params, refresh, reload, setMessage, setError, setParams]);

  if (!data) {
    return (
      <div className="account-page">
        <header className="account-head">
          <div>
            <p className="eyebrow">Plan</p>
            <h1>Loading plan…</h1>
            <p className="lede">Refreshing your account.</p>
          </div>
        </header>
      </div>
    );
  }
  const disclosure = data.billingDisclosure;
  const needsDisclosure = !disclosure?.accepted;

  async function choosePlan(planId: string) {
    try {
      const result = await api<{ url?: string }>("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ planId, gatewayId, cycle, acceptDisclosure }),
      });
      if (result.url) window.location.href = result.url;
      else {
        setMessage("Plan updated.");
        await reload();
        void refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed.");
    }
  }

  return (
    <div className="account-page">
      <header className="account-head">
        <div>
          <p className="eyebrow">Plan</p>
          <h1>{data.plan?.name || "Plan"}</h1>
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
      <section className="account-card billing-disclosure">
        <h2>Subscription &amp; billing terms</h2>
        <p className="role">Version {disclosure?.version || "current"}. Cancel anytime in Account → Plan.</p>
        <p className="lede">{disclosure?.text}</p>
        <label className="check-row">
          <input
            type="checkbox"
            checked={acceptDisclosure}
            disabled={Boolean(disclosure?.accepted)}
            onChange={(event) => setAcceptDisclosure(event.target.checked)}
          />
          <span>
            {disclosure?.accepted
              ? `Accepted ${disclosure.acceptedAt ? new Date(disclosure.acceptedAt).toLocaleString() : ""} (v${disclosure.version})`
              : "I understand the price, billing frequency, automatic renewal, and how to cancel"}
          </span>
        </label>
      </section>
      <div className="price-grid">
        {data.plans.map((plan) => (
          <article className="price-card" key={plan.id}>
            <h2>{plan.name}</h2>
            <p className="price"><strong>${((cycle === "yearly" ? plan.yearlyCents : plan.monthlyCents) / 100).toFixed(0)}</strong><span>{cycle === "yearly" ? "/yr" : "/mo"}</span></p>
            <p className="role">{plan.blurb}</p>
            <p className="role">
              {cycle === "yearly" ? "Billed yearly in USD" : "Billed monthly in USD"}
              {plan.monthlyCents > 0 ? " · renews until canceled" : ""}
            </p>
            <button
              className="btn btn-primary btn-block"
              type="button"
              disabled={plan.id === data.plan.id || (needsDisclosure && plan.monthlyCents > 0 && !acceptDisclosure)}
              onClick={() => void choosePlan(plan.id)}
            >
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
  const navigate = useNavigate();
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  if (!data && !user?.mustChangePassword) return null;
  const link = data?.profile?.slug ? `${window.location.origin}/resume/${data.profile.slug}` : "";
  const needsCurrentPassword = Boolean(user?.provider === "email" && user?.hasPassword);
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
                if (result.user.role === "admin") {
                  navigate("/admin", { replace: true });
                  return;
                }
                void reload?.();
              }
            })
            .catch((err: Error) => setError(err.message));
        }}>
          <h2>{user?.mustChangePassword ? "Choose a new password" : "Password"}</h2>
          {needsCurrentPassword || user?.mustChangePassword ? (
            <label className="field"><span>Current password</span><input type="password" value={current} onChange={(event) => setCurrent(event.target.value)} required /></label>
          ) : (
            <p className="role">This account was activated by email. Set a password to sign in with email next time.</p>
          )}
          <label className="field"><span>New password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></label>
          <button className="btn btn-primary btn-sm" type="submit">Update password</button>
        </form>
      ) : null}
      {data?.features?.manual_apply ? <ExtensionSettings onMessage={setMessage} onError={setError} /> : null}
      {data?.autoApplyAuthorization ? (
        <section className="account-card">
          <h2>Auto-Apply authorization</h2>
          <p className="role">
            Version {data.autoApplyAuthorization.version}
            {data.autoApplyAuthorization.authorized
              ? ` · accepted ${data.autoApplyAuthorization.authorizedAt ? new Date(data.autoApplyAuthorization.authorizedAt).toLocaleString() : ""}`
              : " · not accepted yet"}
          </p>
          <p className="lede">{data.autoApplyAuthorization.text}</p>
          <p className="role">
            Manage enablement and rules on <Link to="/account/applications">Applications</Link>. Disabling there revokes future Auto-Apply queueing.
          </p>
        </section>
      ) : null}
      <section className="account-card" id="privacy">
        <h2>Privacy</h2>
        <p className="role">Correct your profile, export a copy of your data, manage cookies, or permanently delete your account.</p>
        <div className="admin-actions">
          <Link className="btn btn-ghost btn-sm" to="/account/profile">
            Correct my data
          </Link>
          <button
            className="btn btn-ghost btn-sm"
            type="button"
            onClick={() => {
              void api("/api/account/export")
                .then((bundle) => {
                  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const anchor = document.createElement("a");
                  anchor.href = url;
                  anchor.download = `jobpilot-export-${user?.id || "account"}.json`;
                  anchor.click();
                  URL.revokeObjectURL(url);
                  setMessage("Export downloaded.");
                })
                .catch((err: Error) => setError(err.message));
            }}
          >
            Export my data
          </button>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => openCookieSettings()}>
            Cookie Settings
          </button>
        </div>
        <form
          className="danger-zone"
          onSubmit={(event) => {
            event.preventDefault();
            if (!window.confirm("Delete this account permanently? This cannot be undone.")) return;
            void api("/api/account/delete", {
              method: "POST",
              body: JSON.stringify({ confirm: deleteConfirm, password: deletePassword }),
            })
              .then(async () => {
                notify("Account deleted.");
                await refresh();
                navigate("/");
              })
              .catch((err: Error) => setError(err.message));
          }}
        >
          <h3>Delete account</h3>
          <label className="field">
            <span>Type your email to confirm</span>
            <input value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} required />
          </label>
          {user?.provider === "email" ? (
            <label className="field">
              <span>Password</span>
              <input type="password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} />
            </label>
          ) : null}
          <button className="btn btn-ghost btn-sm" type="submit">Delete my account</button>
        </form>
      </section>
      <section className="account-card">
        <h2>Session</h2>
        <p className="role">Signed in as {user?.email}. Plan changes and template access refresh when you save them.</p>
        {data ? <button className="text-btn" type="button" onClick={() => void reload()}>Refresh account</button> : null}
      </section>
    </div>
  );
}
