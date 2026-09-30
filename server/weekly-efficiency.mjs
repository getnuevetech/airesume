/** This-week activity and the single next action for the account overview. */

import { isSubmittedStatus } from "./apply-rules.mjs";
import { startOfUtcWeek } from "./quota.mjs";

const PREPARED = new Set(["Ready", "Review required"]);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const ITEM_LIMIT = 5;
const KIND_LABEL = { submitted: "Submitted", prepared: "Prepared", tracked: "Tracked" };

function finiteStamp(value) {
  const stamp = Number(value);
  return Number.isFinite(stamp) && stamp > 0 ? stamp : 0;
}

/** Prefer the latest edit, then the create time. */
function activityStamp(row) {
  return finiteStamp(row?.updated_at) || finiteStamp(row?.created_at);
}

function quotaLine(label, quota) {
  if (!quota) return "";
  if (quota.unlimited) return `${label}: unlimited this week.`;
  const left = Number.isFinite(Number(quota.remaining)) ? Number(quota.remaining) : 0;
  const limit = Number.isFinite(Number(quota.limit)) ? Number(quota.limit) : 0;
  return `${label}: ${left} of ${limit} left.`;
}

function activityKind(row, weekStart) {
  const created = finiteStamp(row?.created_at);
  const active = activityStamp(row);
  if (active >= weekStart && isSubmittedStatus(row?.status)) return "submitted";
  if (active >= weekStart && PREPARED.has(String(row?.status || ""))) return "prepared";
  if (created >= weekStart) return "tracked";
  return "";
}

function nextAction({ followUpsDue, ready, recommended, preparedHref }) {
  if (followUpsDue > 0) {
    const noun = followUpsDue === 1 ? "follow-up is" : "follow-ups are";
    return {
      href: "/account/applications#follow-ups",
      title: "Send follow-ups",
      detail: `${followUpsDue} ${noun} due.`,
    };
  }
  if (ready > 0) {
    const noun = ready === 1 ? "application is" : "applications are";
    return {
      href: preparedHref || "/account/applications",
      title: "Finish Assisted Apply",
      detail: `${ready} ${noun} ready to submit.`,
    };
  }
  if (recommended > 0) {
    const noun = recommended === 1 ? "recommended role is" : "recommended roles are";
    return {
      href: "/account/jobs",
      title: "Review recommended jobs",
      detail: `${recommended} ${noun} waiting.`,
    };
  }
  return {
    href: "/account/resume",
    title: "Review your resume",
    detail: "Confirm claims so the next matches stay grounded in your Fact Ledger.",
  };
}

export function weeklyEfficiency({
  applications = [],
  followUpsDue = 0,
  ready = 0,
  recommended = 0,
  matchQuota = null,
  reviewQuota = null,
  now = Date.now(),
} = {}) {
  const weekStart = startOfUtcWeek(now);
  let submittedThisWeek = 0;
  let preparedThisWeek = 0;
  let trackedThisWeek = 0;
  const ranked = [];
  for (const row of applications) {
    const created = finiteStamp(row?.created_at);
    const active = activityStamp(row);
    if (created >= weekStart) trackedThisWeek += 1;
    if (active >= weekStart && isSubmittedStatus(row?.status)) submittedThisWeek += 1;
    else if (active >= weekStart && PREPARED.has(String(row?.status || ""))) preparedThisWeek += 1;
    const kind = activityKind(row, weekStart);
    const id = String(row?.id || "");
    if (!kind || !id) continue;
    ranked.push({
      id,
      title: String(row?.title || "Role"),
      company: String(row?.company || ""),
      status: String(row?.status || ""),
      kind,
      label: KIND_LABEL[kind],
      href: `/account/applications#application-${id}`,
      stamp: kind === "tracked" ? created : active,
    });
  }
  ranked.sort((a, b) => b.stamp - a.stamp || a.title.localeCompare(b.title));
  const roles = ranked.map(({ id, kind, label }) => ({ id, kind, label }));
  const items = ranked.slice(0, ITEM_LIMIT).map(({ stamp: _stamp, ...item }) => item);
  const preparedHref = ranked.find((item) => item.kind === "prepared")?.href || "";
  const quotas = [
    quotaLine("Match explanations", matchQuota),
    quotaLine("Resume reviews", reviewQuota),
  ].filter(Boolean);
  return {
    weekStart,
    resetsAt: weekStart + WEEK_MS,
    submittedThisWeek,
    preparedThisWeek,
    trackedThisWeek,
    followUpsDue: Number(followUpsDue) || 0,
    items,
    roles,
    more: Math.max(0, ranked.length - items.length),
    next: nextAction({
      followUpsDue: Number(followUpsDue) || 0,
      ready: Number(ready) || 0,
      recommended: Number(recommended) || 0,
      preparedHref,
    }),
    quotas,
  };
}
