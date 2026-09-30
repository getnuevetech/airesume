import assert from "node:assert/strict";
import test from "node:test";
import { weeklyEfficiency } from "./weekly-efficiency.mjs";

const NOW = Date.UTC(2026, 8, 30, 15); // Wednesday
const WEEK_START = Date.UTC(2026, 8, 28); // Monday UTC
const BEFORE = WEEK_START - 60_000;

test("weekly efficiency counts only this UTC week", () => {
  const week = weeklyEfficiency({
    now: NOW,
    applications: [
      { status: "Applied", created_at: BEFORE, updated_at: WEEK_START },
      { status: "Interview", created_at: WEEK_START + 1, updated_at: WEEK_START + 2 },
      { status: "Applied", created_at: BEFORE, updated_at: BEFORE },
      { status: "Ready", created_at: WEEK_START, updated_at: WEEK_START },
      { status: "Review required", created_at: NOW, updated_at: NOW },
      { status: "Ready", created_at: BEFORE, updated_at: BEFORE },
      { status: "Found", created_at: NOW, updated_at: NOW },
      { status: "Skipped", created_at: BEFORE, updated_at: BEFORE },
    ],
    followUpsDue: 0,
    ready: 2,
    recommended: 4,
    matchQuota: { unlimited: false, limit: 5, remaining: 2 },
    reviewQuota: { unlimited: true, limit: 0, remaining: null },
  });
  assert.equal(week.weekStart, WEEK_START);
  assert.equal(week.resetsAt, WEEK_START + 7 * 24 * 60 * 60 * 1000);
  assert.equal(week.submittedThisWeek, 2);
  assert.equal(week.preparedThisWeek, 2);
  assert.equal(week.trackedThisWeek, 4);
  assert.deepEqual(week.quotas, [
    "Match explanations: 2 of 5 left.",
    "Resume reviews: unlimited this week.",
  ]);
});

test("follow-ups outrank ready applications", () => {
  const week = weeklyEfficiency({
    now: NOW,
    followUpsDue: 1,
    ready: 3,
    recommended: 2,
  });
  assert.equal(week.next.href, "/account/applications#follow-ups");
  assert.equal(week.next.title, "Send follow-ups");
  assert.match(week.next.detail, /1 follow-up is due/);
});

test("ready applications outrank recommended jobs", () => {
  const week = weeklyEfficiency({ now: NOW, followUpsDue: 0, ready: 2, recommended: 9 });
  assert.equal(week.next.title, "Finish Assisted Apply");
  assert.equal(week.next.href, "/account/applications");
  assert.match(week.next.detail, /2 applications are ready/);
});

test("recommended jobs outrank an empty tracker", () => {
  const week = weeklyEfficiency({ now: NOW, recommended: 1 });
  assert.equal(week.next.href, "/account/jobs");
  assert.equal(week.next.title, "Review recommended jobs");
});

test("this week names roles and opens the newest prepared application", () => {
  const week = weeklyEfficiency({
    now: NOW,
    ready: 2,
    applications: [
      { id: "old", title: "Old role", company: "North", status: "Applied", created_at: BEFORE, updated_at: BEFORE },
      { id: "sub", title: "Analyst", company: "North", status: "Applied", created_at: WEEK_START, updated_at: NOW },
      { id: "prep-early", title: "Writer", company: "East", status: "Ready", created_at: WEEK_START, updated_at: WEEK_START + 10 },
      { id: "prep-late", title: "Editor", company: "West", status: "Review required", created_at: WEEK_START, updated_at: NOW - 1 },
      { id: "track", title: "Scout", company: "South", status: "Found", created_at: WEEK_START + 50, updated_at: WEEK_START + 50 },
    ],
  });
  assert.deepEqual(week.items.map((item) => [item.id, item.kind, item.label]), [
    ["sub", "submitted", "Submitted"],
    ["prep-late", "prepared", "Prepared"],
    ["track", "tracked", "Tracked"],
    ["prep-early", "prepared", "Prepared"],
  ]);
  assert.equal(week.items[0].href, "/account/applications#application-sub");
  assert.equal(week.more, 0);
  assert.equal(week.next.href, "/account/applications#application-prep-late");
});

test("the week list keeps five roles and counts the rest", () => {
  const applications = Array.from({ length: 6 }, (_, index) => ({
    id: `app-${index}`,
    title: `Role ${index}`,
    company: "North",
    status: "Found",
    created_at: WEEK_START + index,
    updated_at: WEEK_START + index,
  }));
  const week = weeklyEfficiency({ now: NOW, applications });
  assert.equal(week.trackedThisWeek, 6);
  assert.equal(week.items.length, 5);
  assert.equal(week.items[0].id, "app-5");
  assert.equal(week.more, 1);
});

test("an empty week points at the resume", () => {
  const week = weeklyEfficiency({ now: NOW, applications: [] });
  assert.equal(week.submittedThisWeek, 0);
  assert.equal(week.preparedThisWeek, 0);
  assert.equal(week.trackedThisWeek, 0);
  assert.equal(week.next.href, "/account/resume");
  assert.match(week.next.detail, /Fact Ledger/);
});
