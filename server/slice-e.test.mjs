import assert from "node:assert/strict";
import test from "node:test";
import { buildCareerInsights } from "./career-intel.mjs";
import { buildInterviewPrep } from "./interview-prep.mjs";
import { buildVoicePractice, scoreVoiceAnswer, summarizeVoiceSession } from "./voice-interview.mjs";
import {
  ensureFollowUpReminder,
  followUpMetrics,
  listFollowUpReminders,
  updateFollowUpReminder,
} from "./follow-ups.mjs";
import { migrate, SCHEMA_VERSION } from "./schema.mjs";
import { db, id } from "./db.mjs";

test("schema includes follow-up reminders table", () => {
  assert.ok(SCHEMA_VERSION >= 18);
  migrate();
  const columns = db.prepare("PRAGMA table_info(follow_up_reminders)").all();
  assert.ok(columns.some((column) => column.name === "due_at"));
});

test("career insights tie lessons to tracker outcomes", () => {
  const insights = buildCareerInsights({
    doc: { skills: ["SQL", "Product management"], employment: [], education: [] },
    preferences: {},
    jobs: [
      {
        id: "job_win",
        title: "PM",
        company: "A",
        category: "Product",
        role: "Product Manager",
        skills: ["Product management", "SQL"],
        requirements: { mandatory: ["Product management", "SQL"], preferred: [] },
      },
      {
        id: "job_stall",
        title: "Analyst",
        company: "B",
        category: "Data",
        skills: ["Python"],
        requirements: { mandatory: ["Python"], preferred: [] },
      },
    ],
    applications: [
      { id: "a1", job_id: "job_win", status: "Interview", match_score: 88 },
      { id: "a2", job_id: "job_stall", status: "Applied", match_score: 42 },
      { id: "a3", job_id: "job_win", status: "Offer", match_score: 90 },
    ],
    options: { skillLimit: 5 },
  });
  assert.equal(insights.summary.interviews, 2);
  assert.equal(insights.summary.offers, 1);
  assert.ok(insights.outcomes.winningSkills.some((item) => item.skill === "SQL"));
  assert.ok(insights.outcomes.lessons.length >= 1);
  assert.ok(insights.focus.some((item) => /outcome|offer|match|SQL|follow/i.test(`${item.id} ${item.title}`)));
});

test("interview prep coverage and follow-up prompt harden practice readiness", () => {
  const prep = buildInterviewPrep({
    job: {
      title: "Product Manager",
      company: "Northstar",
      primary_company: "Northstar",
      category: "Product",
      role: "Product Manager",
      description: "Own activation.\nPartner with design.",
    },
    doc: {
      summary: "Product manager focused on activation.",
      skills: ["Product management", "SQL"],
      employment: [{ title: "PM", employer: "Acme", dates: "2021-2024", bullets: ["Owned activation with SQL dashboards"] }],
    },
    match: { score: 88, label: "strong", matched: ["Product management", "SQL"], missing: ["Roadmapping"] },
    application: { id: "app_1", status: "Interview", target_company: "Northstar" },
  });
  assert.ok(prep.prompts.some((item) => item.id === "follow-up" && item.ready));
  assert.ok(prep.coverage.percent >= 50);
  assert.equal(prep.coverage.practiceReady, true);
  assert.ok(prep.coverage.starWithSource >= 1);
});

test("voice practice flags invented metrics and summarizes hardened coverage", () => {
  const prep = buildInterviewPrep({
    job: { title: "PM", company: "Northstar", primary_company: "Northstar", description: "SQL activation" },
    doc: {
      skills: ["SQL"],
      employment: [{ title: "PM", employer: "Acme", bullets: ["Owned activation with SQL dashboards"] }],
    },
    match: { score: 80, matched: ["SQL"], missing: ["Roadmapping"] },
    application: { id: "app_1", status: "Interview", target_company: "Northstar" },
  });
  const practice = buildVoicePractice({
    prep,
    doc: {
      skills: ["SQL"],
      employment: [{ title: "PM", employer: "Acme", bullets: ["Owned activation with SQL dashboards"] }],
    },
    match: { matched: ["SQL"], missing: ["Roadmapping"] },
  });
  assert.deepEqual(practice.facts.missing, ["Roadmapping"]);
  const invented = scoreVoiceAnswer({
    prompt: practice.prompts.find((item) => item.id === "challenge"),
    answer: "At Acme I grew revenue 400% with a secret framework.",
    facts: practice.facts,
  });
  assert.ok(invented.unverifiedNumbers.length >= 1);
  assert.ok(invented.score < 70);
  const summary = summarizeVoiceSession([
    { answer: "At Acme as PM I owned activation with SQL dashboards for the product team.", feedback: { score: 80, unverifiedNumbers: [] } },
    { answer: "", feedback: null },
  ]);
  assert.equal(summary.answered, 1);
  assert.equal(summary.coveragePercent, 50);
  assert.equal(summary.practiceHardened, false);
});

test("follow-up reminders create snooze and complete", () => {
  migrate();
  const userId = id("usr");
  const appId = id("app");
  const reminder = ensureFollowUpReminder({
    userId,
    applicationId: appId,
    status: "Applied",
    company: "Acme",
    title: "PM",
    now: Date.now() - 4 * 24 * 60 * 60 * 1000,
  });
  assert.ok(reminder);
  assert.equal(reminder.kind, "apply_followup");
  const again = ensureFollowUpReminder({
    userId,
    applicationId: appId,
    status: "Applied",
    company: "Acme",
    title: "PM",
  });
  assert.equal(again.id, reminder.id);
  const listed = listFollowUpReminders(userId);
  assert.ok(listed.some((item) => item.id === reminder.id && item.overdue));
  const snoozed = updateFollowUpReminder(userId, reminder.id, "snooze", { snoozeDays: 2 });
  assert.equal(snoozed.reminder.status, "snoozed");
  const done = updateFollowUpReminder(userId, reminder.id, "done");
  assert.equal(done.reminder.status, "done");
  const metrics = followUpMetrics(userId);
  assert.ok(metrics.done >= 1);
});
