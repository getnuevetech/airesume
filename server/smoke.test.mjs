import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { autoDecision, TRACKER_STATUSES } from "./apply-rules.mjs";
import { parseJobPaste } from "./job-import.mjs";
import { extractRequirements, matchJob, matchLabel } from "./match.mjs";
import { draftQuestions } from "./questions.mjs";
import { matchExplainLimit, redactMatch, resumeReviewLimit, startOfUtcWeek } from "./quota.mjs";
import { estimateCostMicros, moneyFromMicros } from "./ai-cost.mjs";
import { buildApplyKit } from "./apply-kit.mjs";
import { buildCareerInsights } from "./career-intel.mjs";
import { buildInterviewPrep } from "./interview-prep.mjs";
import { buildVoicePractice, scoreVoiceAnswer, summarizeVoiceSession } from "./voice-interview.mjs";
import { searchCandidates } from "./employer-search.mjs";
import {
  canTransition,
  normalizePipelineStatus,
  sortPipeline,
  summarizePipeline,
} from "./employer-pipeline.mjs";
import {
  buildEmployerVoiceQuestions,
  canAdvanceSession,
  makeJoinCode,
  publicCandidateFacts,
  scoreLiveAnswer,
} from "./employer-voice.mjs";
import {
  canChangeInviteStatus,
  canChangePostingStatus,
  normalizePostingInput,
  scoreCandidateForPosting,
  summarizeInvites,
  summarizePostings,
  validatePosting,
} from "./employer-postings.mjs";
import {
  appendRoomTurn,
  buildRoomParticipants,
  canChangeRoomStatus,
  markPresence,
  summarizeRoom,
} from "./interview-rooms.mjs";
import {
  buildEmployerAnalytics,
  buildEmployerInsights,
  findSlaBreaches,
  normalizeSlaSettings,
} from "./employer-analytics.mjs";
import { claimsSupported, tailoredDocument } from "./resume-guard.mjs";

const here = dirname(fileURLToPath(import.meta.url));

test("extractRequirements splits mandatory and preferred skills", () => {
  const requirements = extractRequirements({
    title: "Product Manager",
    description: "Need 5 years of product management. Bachelor preferred.",
    skills: ["Product management", "SQL", "Roadmapping", "A/B testing", "Figma", "Excel", "Python", "Leadership", "Communication", "Notion"],
    role: "Product Manager",
    category: "Product",
  });
  assert.equal(requirements.mandatory.length, 8);
  assert.ok(requirements.preferred.length >= 1);
  assert.equal(requirements.years, 5);
  assert.match(requirements.education, /Bachelor/i);
});

test("matchJob uses hybrid weights and labels", () => {
  const doc = {
    skills: ["Product management", "SQL", "Roadmapping", "A/B testing"],
    employment: [{ title: "Product Manager", employer: "Acme", bullets: ["Owned activation with SQL"] }],
    education: ["B.S. Computer Science"],
  };
  const job = {
    title: "Senior Product Manager",
    role: "Product Manager",
    category: "Product",
    location: "Remote",
    remote_type: "remote",
    salary_min: 140000,
    salary_max: 180000,
    skills: JSON.stringify(["Product management", "SQL", "Roadmapping", "A/B testing"]),
    requirements: JSON.stringify({
      mandatory: ["Product management", "SQL", "Roadmapping"],
      preferred: ["A/B testing"],
      education: "Bachelor's",
      years: 5,
    }),
  };
  const match = matchJob(doc, { locations: "Remote", salary: "150000" }, job);
  assert.ok(match.score >= 70, `expected strongish score, got ${match.score}`);
  assert.equal(matchLabel(match.score), match.label);
  assert.ok(match.matched.includes("Product management"));
  assert.ok(match.explanation.length > 10);
});

test("claimsSupported rejects invented numbers", () => {
  assert.equal(claimsSupported("Grew revenue 40%", "Grew revenue"), false);
  assert.equal(claimsSupported("Grew revenue 40%", "Grew revenue 40%"), true);
  assert.equal(claimsSupported("Grew revenue 40%", "Grew revenue", [{ statement: "Grew revenue 40%" }]), true);
});

test("tailoredDocument only reorders existing content", () => {
  const doc = {
    skills: ["Excel", "Product management", "SQL"],
    employment: [
      { title: "Analyst", employer: "DataCo", bullets: ["Built Excel models"] },
      { title: "Product Manager", employer: "Acme", bullets: ["Shipped SQL dashboards", "Owned roadmap"] },
    ],
  };
  const match = {
    matched: ["Product management", "SQL"],
    preferredMatched: [],
    label: "good",
  };
  const next = tailoredDocument(doc, { title: "Product Manager", company: "Northstar" }, match, [
    { statement: "Product management" },
    { statement: "SQL" },
    { statement: "Acme" },
  ]);
  assert.equal(next.skills[0], "Product management");
  assert.equal(next.employment[0].title, "Product Manager");
  assert.deepEqual(
    next.employment.flatMap((job) => job.bullets).sort(),
    doc.employment.flatMap((job) => job.bullets).sort(),
  );
});

test("autoDecision never chooses silent submit", () => {
  assert.ok(TRACKER_STATUSES.includes("Ready"));
  assert.ok(TRACKER_STATUSES.includes("Review required"));
  const job = {
    title: "Product Manager",
    company: "Northstar",
    verification: "Active",
    location: "Remote",
    remote_type: "remote",
    salary_min: 140000,
    salary_max: 180000,
  };
  const strong = {
    score: 92,
    label: "strong",
    missing: [],
  };
  const ready = autoDecision(job, strong, { locations: "Remote", salary: "150000" }, { auto_min: 85 });
  assert.equal(ready.action, "ready");

  const review = autoDecision(
    { ...job, verification: "Needs review" },
    strong,
    { locations: "Remote" },
    { auto_min: 85 },
  );
  assert.equal(review.action, "review");

  const skipped = autoDecision(job, strong, { excludeCompanies: "Northstar" }, { auto_min: 85 });
  assert.equal(skipped.action, "skip");

  const missing = autoDecision(job, { score: 90, label: "strong", missing: ["SQL"] }, {}, { auto_min: 85 });
  assert.equal(missing.action, "review");
});

test("parseJobPaste extracts title company and requirements", () => {
  const draft = parseJobPaste({
    text: `Senior Product Manager
Northstar
Location: Remote
Salary: $140,000 - $170,000

Requirements:
- Product management
- SQL
- Roadmapping

Nice to have:
- A/B testing

Are you authorized to work in the US?
What are your salary expectations?
`,
  });
  assert.equal(draft.title, "Senior Product Manager");
  assert.equal(draft.company, "Northstar");
  assert.equal(draft.remoteType, "remote");
  assert.ok(draft.requirements.mandatory.includes("Product management"));
  assert.ok(draft.salaryMin >= 140000);
});

test("draftQuestions leaves salary and authorization blank", () => {
  const questions = draftQuestions(
    {
      title: "Product Manager",
      company: "Northstar",
      description: "What are your salary expectations?\nAre you authorized to work in the US?\nTell us about a launch you led.",
    },
    {
      skills: ["Product management", "SQL"],
      employment: [{ title: "PM", employer: "Acme", bullets: ["Led an onboarding launch"] }],
      summary: "Product manager",
    },
    { salary: "150000", workAuthorization: "US citizen" },
    { matched: ["Product management"], missing: [] },
  );
  const salary = questions.find((item) => /salary/i.test(item.prompt));
  const auth = questions.find((item) => /authoriz/i.test(item.prompt));
  assert.ok(salary);
  assert.equal(salary.answer, "");
  assert.ok(salary.blankReason);
  assert.ok(auth);
  assert.equal(auth.answer, "");
  assert.ok(questions.some((item) => item.kind === "draft" && item.answer));
});

test("matchExplainLimit treats 0 as unlimited and redacts locked matches", () => {
  assert.equal(matchExplainLimit({ match_explain_limit: 5 }), 5);
  assert.equal(matchExplainLimit({ match_explain_limit: 0 }), 0);
  assert.equal(resumeReviewLimit({ resume_review_limit: 3 }), 3);
  assert.equal(resumeReviewLimit({ resume_review_limit: 0 }), 0);
  assert.equal(resumeReviewLimit({}), 3);
  const redacted = redactMatch({ score: 90, label: "strong", explanation: "hi", matched: ["SQL"], missing: [], preferredMatched: [] });
  assert.equal(redacted.explanation, "");
  assert.equal(redacted.explanationLocked, true);
  assert.ok(startOfUtcWeek() > 0);
});

test("estimateCostMicros is zero for deterministic and positive for mini models", () => {
  assert.equal(estimateCostMicros({ kind: "deterministic", model: "rules-v1", system: "a", user: "b" }), 0);
  const paid = estimateCostMicros({
    kind: "openai",
    model: "gpt-4o-mini",
    system: "Review this resume. ".repeat(200),
    user: "Profile JSON goes here. ".repeat(400),
    response: '{"rating":80}'.repeat(20),
  });
  assert.ok(paid > 0);
  assert.ok(moneyFromMicros(paid).startsWith("$"));
});

test("buildApplyKit surfaces contact resume and blank answers without inventing", () => {
  const kit = buildApplyKit({
    user: { name: "Alex Rivera", email: "alex@example.com", phone: "555-0100", city: "Austin", address: "1 Main" },
    profile: {},
    job: { title: "PM", company: "Acme", primary_company: "Acme", primary_url: "https://jobs.example/pm", source_url: "" },
    application: {
      id: "app_1",
      status: "Ready",
      target_company: "Acme",
      target_url: "https://jobs.example/pm",
      questions: [
        { id: "why-fit", prompt: "Why fit?", kind: "draft", answer: "Because of product work." },
        { id: "std-salary", prompt: "Salary", kind: "user", answer: "", blankReason: "Left blank" },
      ],
    },
    version: { rendered: "Alex Rivera\nProduct Manager\nOwned activation." },
    preferences: { shareContact: true },
  });
  assert.equal(kit.eligible, true);
  assert.equal(kit.listingUrl, "https://jobs.example/pm");
  assert.equal(kit.contact.find((item) => item.key === "email")?.value, "alex@example.com");
  assert.ok(kit.resumeText.includes("Owned activation"));
  assert.equal(kit.blankCount, 1);
  assert.equal(kit.canComplete, true);
  assert.ok(kit.steps.some((step) => step.id === "mark"));
});

test("buildCareerInsights ranks demand gaps without inventing skills", () => {
  const insights = buildCareerInsights({
    doc: { skills: ["SQL", "Product management"], employment: [], education: [] },
    preferences: {},
    jobs: [
      {
        id: "1",
        title: "PM",
        company: "A",
        category: "Product",
        role: "Product Manager",
        skills: ["Product management", "SQL", "Roadmapping"],
        requirements: { mandatory: ["Product management", "SQL", "Roadmapping"], preferred: ["A/B testing"] },
        description: "Product manager with SQL",
      },
      {
        id: "2",
        title: "Analyst",
        company: "B",
        category: "Data",
        role: "Data Analyst",
        skills: ["SQL", "Python"],
        requirements: { mandatory: ["SQL", "Python"], preferred: [] },
        description: "Analyst",
      },
    ],
    applications: [{ status: "Ready" }, { status: "Applied" }, { status: "Interview" }],
    options: { skillLimit: 5 },
  });
  assert.ok(insights.strengths.some((item) => item.skill === "SQL"));
  assert.ok(insights.gaps.some((item) => /python|roadmapping/i.test(item.skill)));
  assert.equal(insights.summary.tracked, 3);
  assert.equal(insights.summary.responses, 1);
  assert.ok(insights.focus.length >= 1);
  assert.ok(!insights.gaps.some((item) => /invented/i.test(item.skill)));
});

test("buildInterviewPrep uses resume bullets and does not invent metrics", () => {
  const prep = buildInterviewPrep({
    job: {
      title: "Product Manager",
      company: "Northstar",
      primary_company: "Northstar",
      category: "Product",
      role: "Product Manager",
      description: "Own activation.\nPartner with design.\nUse SQL for experiments.",
      source_url: "https://jobs.example/pm",
    },
    doc: {
      summary: "Product manager focused on activation.",
      skills: ["Product management", "SQL"],
      employment: [{ title: "PM", employer: "Acme", dates: "2021-2024", bullets: ["Owned activation with SQL dashboards"] }],
    },
    match: { score: 88, label: "strong", matched: ["Product management", "SQL"], missing: ["Roadmapping"] },
    application: { id: "app_1", status: "Interview", target_company: "Northstar", target_url: "https://jobs.example/pm" },
  });
  assert.equal(prep.company, "Northstar");
  assert.ok(prep.prompts.some((item) => item.id === "tell-me" && item.ready));
  const challenge = prep.prompts.find((item) => item.id === "challenge");
  assert.ok(challenge?.answer.includes("Owned activation with SQL dashboards"));
  assert.ok(!/invented|99%|doubled revenue/i.test(JSON.stringify(prep)));
  assert.ok(prep.talkingPoints.some((item) => item.skill === "SQL"));
  assert.equal(prep.askEmployer.length, 3);
});

test("voice practice scores fact-safe answers and flags invented metrics", () => {
  const prep = buildInterviewPrep({
    job: {
      title: "Product Manager",
      company: "Northstar",
      primary_company: "Northstar",
      description: "Own activation with SQL.",
    },
    doc: {
      skills: ["SQL", "Product management"],
      employment: [{ title: "PM", employer: "Acme", dates: "2021-2024", bullets: ["Owned activation with SQL dashboards"] }],
    },
    match: { score: 90, matched: ["SQL", "Product management"], missing: ["Roadmapping"] },
    application: { id: "app_1", status: "Interview", target_company: "Northstar" },
  });
  const practice = buildVoicePractice({
    prep,
    doc: {
      skills: ["SQL", "Product management"],
      employment: [{ title: "PM", employer: "Acme", dates: "2021-2024", bullets: ["Owned activation with SQL dashboards"] }],
    },
    match: { matched: ["SQL", "Product management"], missing: ["Roadmapping"] },
  });
  assert.ok(practice.prompts.length >= 4);
  assert.ok(practice.facts.employers.includes("Acme"));
  const solid = scoreVoiceAnswer({
    prompt: practice.prompts.find((item) => item.id === "challenge"),
    answer: "At Acme as a PM I owned activation with SQL dashboards and partnered with design on experiments.",
    facts: practice.facts,
    coachAnswer: practice.prompts.find((item) => item.id === "challenge")?.coachAnswer,
  });
  assert.ok(solid.score >= 45);
  assert.ok(solid.usedEmployers.includes("Acme"));
  assert.ok(solid.usedSkills.includes("SQL"));
  const invented = scoreVoiceAnswer({
    prompt: practice.prompts.find((item) => item.id === "impact"),
    answer: "I doubled revenue by 400% in one quarter using a secret AI model.",
    facts: practice.facts,
  });
  assert.ok(invented.unverifiedNumbers.length >= 1);
  assert.ok(invented.score < solid.score);
  const summary = summarizeVoiceSession([
    { answer: "At Acme", feedback: { score: 60, unverifiedNumbers: [] } },
    { answer: "400%", feedback: { score: 20, unverifiedNumbers: ["400%"] } },
    { answer: "", feedback: null },
  ]);
  assert.equal(summary.answered, 2);
  assert.equal(summary.inventedMetricFlags, 1);
  assert.equal(summary.status, "in_progress");
});

test("searchCandidates only returns public profiles matching skills", () => {
  const rows = [
    {
      user_id: "u1",
      slug: "alex",
      headline: "Product Manager",
      summary: "Activation and SQL",
      skills: JSON.stringify(["SQL", "Product management"]),
      photo_url: "",
      preferences: JSON.stringify({ shareContact: true }),
      name: "Alex Rivera",
      email: "alex@example.com",
      phone: "555",
      city: "Austin",
      status: "active",
      plan_features: JSON.stringify({ public_profile: true }),
    },
    {
      user_id: "u2",
      slug: "hidden",
      headline: "Engineer",
      summary: "React",
      skills: JSON.stringify(["React"]),
      photo_url: "",
      preferences: "{}",
      name: "Sam Hidden",
      email: "sam@example.com",
      phone: "",
      city: "Dallas",
      status: "active",
      plan_features: JSON.stringify({ public_profile: false }),
    },
  ];
  const found = searchCandidates(rows, { skill: "SQL" });
  assert.equal(found.length, 1);
  assert.equal(found[0].slug, "alex");
  assert.equal(found[0].email, "alex@example.com");
  assert.equal(searchCandidates(rows, { skill: "React" }).length, 0);
});

test("employer pipeline normalizes stages and summarizes active hires", () => {
  assert.equal(normalizePipelineStatus("interviewing"), "Interviewing");
  assert.equal(canTransition("Saved", "Reviewing"), true);
  assert.equal(canTransition("Saved", "Hired"), true);
  assert.equal(canTransition("Hired", "Interviewing"), false);
  assert.equal(canTransition("Passed", "Reviewing"), true);
  const rows = [
    { status: "Saved", updatedAt: 3 },
    { status: "Interviewing", updatedAt: 2 },
    { status: "Hired", updatedAt: 9 },
    { status: "Passed", updatedAt: 8 },
  ];
  const summary = summarizePipeline(rows);
  assert.equal(summary.total, 4);
  assert.equal(summary.active, 2);
  assert.equal(summary.counts.Interviewing, 1);
  const ordered = sortPipeline(rows);
  assert.equal(ordered[0].status, "Interviewing");
  assert.ok(["Hired", "Passed"].includes(ordered.at(-1).status));
  assert.ok(ordered.slice(0, 2).every((row) => !["Hired", "Passed"].includes(row.status)));
});

test("employer live voice builds questions and scores against public facts", () => {
  assert.equal(makeJoinCode().length, 6);
  const questions = buildEmployerVoiceQuestions({
    roleTitle: "Product Manager",
    candidate: { headline: "PM", skills: ["SQL", "Product management"] },
    custom: ["How do you partner with design?"],
  });
  assert.ok(questions.some((item) => /Product Manager/.test(item.prompt)));
  assert.ok(questions.some((item) => item.id.startsWith("custom")));
  assert.equal(canAdvanceSession("scheduled", "live"), true);
  assert.equal(canAdvanceSession("complete", "live"), false);
  const facts = publicCandidateFacts({
    skills: JSON.stringify(["SQL"]),
    summary: "Grew activation 12%",
    employment: JSON.stringify([{ title: "PM", employer: "Acme", bullets: ["Owned activation with SQL"] }]),
  });
  assert.ok(facts.employers.includes("Acme"));
  const feedback = scoreLiveAnswer({
    question: questions.find((item) => item.id === "challenge"),
    answer: "At Acme as a PM I owned activation with SQL.",
    facts,
  });
  assert.ok(feedback.score >= 45);
  assert.ok(feedback.usedEmployers.includes("Acme"));
  const invented = scoreLiveAnswer({
    question: questions[0],
    answer: "I grew revenue 900% overnight.",
    facts,
  });
  assert.ok(invented.unverifiedNumbers.length >= 1);
});

test("employer postings validate open roles and score invite overlap", () => {
  const draft = normalizePostingInput({
    title: "Product Manager",
    company: "Northstar",
    description: "Own activation and partner with design on experiments.",
    skills: "SQL, Product management, Roadmapping",
    status: "open",
  });
  assert.equal(validatePosting(draft), "");
  assert.equal(validatePosting({ ...draft, description: "Too short", status: "open" }).length > 0, true);
  assert.equal(canChangePostingStatus("draft", "open"), true);
  assert.equal(canChangeInviteStatus("pending", "accepted"), true);
  assert.equal(canChangeInviteStatus("declined", "accepted"), false);
  const overlap = scoreCandidateForPosting(
    { skills: ["SQL", "Product management"] },
    { skills: ["SQL", "Product management", "Roadmapping"] },
  );
  assert.equal(overlap.matched.length, 2);
  assert.deepEqual(overlap.missing, ["Roadmapping"]);
  assert.equal(summarizePostings([{ status: "open" }, { status: "draft" }]).open, 1);
  assert.equal(summarizeInvites([{ status: "pending" }, { status: "accepted" }]).open, 1);
});

test("interview rooms track multi-party presence and shared turns", () => {
  assert.equal(canChangeRoomStatus("lobby", "live"), true);
  assert.equal(canChangeRoomStatus("ended", "live"), false);
  const participants = buildRoomParticipants({
    hostName: "Riley",
    hostUserId: "e1",
    candidateName: "Alex",
    candidateUserId: "c1",
    interviewers: [{ displayName: "Jordan" }],
  });
  assert.equal(participants.length, 3);
  const present = markPresence(participants, "host", Date.now());
  assert.equal(present.find((person) => person.id === "host")?.present, true);
  const turns = appendRoomTurn([], {
    kind: "answer",
    speakerRole: "candidate",
    speakerName: "Alex",
    text: "At Acme I owned activation with SQL.",
    feedback: { score: 70, unverifiedNumbers: [] },
  });
  assert.equal(turns.length, 1);
  const summary = summarizeRoom({ turns, participants: present, status: "live" });
  assert.equal(summary.candidateAnswers, 1);
  assert.equal(summary.averageScore, 70);
  assert.equal(summary.present, 1);
});

test("employer analytics funnel and SLA breaches use live hiring data", () => {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  const analytics = buildEmployerAnalytics({
    now,
    pipeline: [
      { id: "p1", status: "Saved", created_at: now - 10 * hour, updated_at: now - 10 * hour, candidate_user_id: "c1" },
      { id: "p2", status: "Hired", created_at: now - 20 * hour, updated_at: now - 2 * hour, candidate_user_id: "c2" },
      { id: "p3", status: "Interviewing", created_at: now - 200 * hour, updated_at: now - 200 * hour, candidate_user_id: "c3" },
    ],
    invites: [
      { id: "i1", status: "pending", created_at: now - 80 * hour, updated_at: now - 80 * hour, candidate_user_id: "c1" },
      { id: "i2", status: "accepted", created_at: now - 5 * hour, updated_at: now - 1 * hour, candidate_user_id: "c2" },
    ],
    postings: [{ status: "open" }, { status: "draft" }],
    rooms: [],
    voiceSessions: [],
  });
  assert.equal(analytics.funnel.saved, 1);
  assert.equal(analytics.funnel.hired, 1);
  assert.equal(analytics.postings.open, 1);
  assert.equal(analytics.invites.open, 1);
  assert.equal(analytics.rates.hireRate, 100);
  const sla = normalizeSlaSettings({ reviewHours: 48, inviteHours: 72, interviewHours: 168 });
  const breaches = findSlaBreaches({
    now,
    sla,
    pipeline: [
      { id: "p1", status: "Saved", created_at: now - 10 * hour, updated_at: now - 10 * hour, candidate_user_id: "c1" },
      { id: "p3", status: "Interviewing", created_at: now - 200 * hour, updated_at: now - 200 * hour, candidate_user_id: "c3" },
    ],
    invites: [
      { id: "i1", status: "pending", created_at: now - 80 * hour, updated_at: now - 80 * hour, candidate_user_id: "c1" },
    ],
    rooms: [],
    voiceSessions: [],
  });
  assert.ok(breaches.some((item) => item.kind === "invite"));
  assert.ok(breaches.some((item) => item.kind === "interview"));
  assert.ok(!breaches.some((item) => item.kind === "review"));
  const tips = buildEmployerInsights(analytics, breaches);
  assert.ok(tips.some((item) => item.id === "schedule-interviews" || item.id === "clear-invites"));
});

test("fresh data dir migrates and seeds schema version", () => {
  const dir = mkdtempSync(join(tmpdir(), "jobpilot-test-"));
  const script = `
    import { db } from "./db.mjs";
    import { migrate, SCHEMA_VERSION } from "./schema.mjs";
    migrate();
    const version = db.prepare("SELECT version FROM schema_version LIMIT 1").get();
    if (!version || version.version !== SCHEMA_VERSION) {
      console.error("bad version", version);
      process.exit(2);
    }
    const jobs = db.prepare("SELECT COUNT(*) AS count FROM jobs").get();
    if (!jobs || jobs.count < 1) process.exit(3);
    const sample = db.prepare("SELECT requirements FROM jobs LIMIT 1").get();
    const requirements = JSON.parse(sample.requirements || "{}");
    if (!Array.isArray(requirements.mandatory)) process.exit(4);
    const columns = db.prepare("PRAGMA table_info(applications)").all().map((row) => row.name);
    if (!columns.includes("questions")) process.exit(5);
    if (!db.prepare("PRAGMA table_info(users)").all().some((row) => row.name === "auto_daily_cap")) process.exit(6);
    const views = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='match_explanation_views'").get();
    if (!views) process.exit(7);
    const free = JSON.parse(db.prepare("SELECT features FROM plans WHERE id='free'").get().features);
    if (free.match_explain_limit !== 5) process.exit(8);
    if (free.resume_review_limit !== 3) process.exit(9);
    if (!db.prepare("PRAGMA table_info(ai_audit)").all().some((row) => row.name === "cost_micros")) process.exit(10);
    if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='employer_profiles'").get()) process.exit(11);
    if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='voice_practice_sessions'").get()) process.exit(12);
    if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='employer_pipeline'").get()) process.exit(13);
    if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='employer_voice_sessions'").get()) process.exit(14);
    if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='employer_postings'").get()) process.exit(15);
    if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='employer_invites'").get()) process.exit(16);
    if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='interview_rooms'").get()) process.exit(17);
    if (!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='employer_sla_settings'").get()) process.exit(18);
  `;
  try {
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: here,
      env: { ...process.env, JOBPILOT_DATA_DIR: dir },
      encoding: "utf8",
    });
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
