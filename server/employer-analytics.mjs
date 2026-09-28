/** Employer hiring analytics and SLA helpers. */

import { PIPELINE_STATUSES, normalizePipelineStatus, summarizePipeline } from "./employer-pipeline.mjs";
import { normalizeInviteStatus, summarizeInvites } from "./employer-postings.mjs";
import { normalizeRoomStatus } from "./interview-rooms.mjs";
import { normalizeSessionStatus } from "./employer-voice.mjs";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export const DEFAULT_SLA = {
  reviewHours: 48,
  inviteHours: 72,
  interviewHours: 168,
};

export function normalizeSlaSettings(input = {}, fallback = DEFAULT_SLA) {
  const clamp = (value, fallbackValue) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 1) return fallbackValue;
    return Math.min(720, Math.round(num));
  };
  return {
    reviewHours: clamp(input.reviewHours ?? input.review_hours, fallback.reviewHours),
    inviteHours: clamp(input.inviteHours ?? input.invite_hours, fallback.inviteHours),
    interviewHours: clamp(input.interviewHours ?? input.interview_hours, fallback.interviewHours),
  };
}

function ageHours(from, now) {
  if (!from) return 0;
  return Math.max(0, Math.round((Number(now) - Number(from)) / HOUR_MS));
}

function median(values = []) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Build hiring funnel and activity rollups for an employer.
 */
export function buildEmployerAnalytics({
  pipeline = [],
  invites = [],
  postings = [],
  rooms = [],
  voiceSessions = [],
  now = Date.now(),
} = {}) {
  const pipelineSummary = summarizePipeline(pipeline);
  const inviteSummary = summarizeInvites(invites);
  const openPostings = postings.filter((row) => String(row.status || "").toLowerCase() === "open").length;
  const liveRooms = rooms.filter((row) => normalizeRoomStatus(row.status) === "live").length;
  const endedRooms = rooms.filter((row) => normalizeRoomStatus(row.status) === "ended").length;
  const liveVoice = voiceSessions.filter((row) => normalizeSessionStatus(row.status) === "live").length;
  const completeVoice = voiceSessions.filter((row) => normalizeSessionStatus(row.status) === "complete").length;

  const hired = pipelineSummary.counts.Hired || 0;
  const passed = pipelineSummary.counts.Passed || 0;
  const decided = hired + passed;
  const hireRate = decided ? Math.round((hired / decided) * 100) : null;

  const acceptedInvites = inviteSummary.counts.accepted || 0;
  const respondedInvites =
    (inviteSummary.counts.accepted || 0) + (inviteSummary.counts.declined || 0) + (inviteSummary.counts.viewed || 0);
  const inviteAcceptRate = inviteSummary.total ? Math.round((acceptedInvites / inviteSummary.total) * 100) : null;

  const timeToInterviewHours = pipeline
    .filter((row) => ["Interviewing", "Offer", "Hired"].includes(normalizePipelineStatus(row.status)))
    .map((row) => ageHours(row.created_at || row.createdAt, row.updated_at || row.updatedAt || now))
    .filter((value) => value >= 0);

  const inviteResponseHours = invites
    .filter((row) => ["viewed", "accepted", "declined"].includes(normalizeInviteStatus(row.status)))
    .map((row) => ageHours(row.created_at || row.createdAt, row.updated_at || row.updatedAt || now));

  const weekAgo = now - 7 * DAY_MS;
  const recent = {
    pipelineAdds: pipeline.filter((row) => Number(row.created_at || row.createdAt || 0) >= weekAgo).length,
    invitesSent: invites.filter((row) => Number(row.created_at || row.createdAt || 0) >= weekAgo).length,
    roomsOpened: rooms.filter((row) => Number(row.created_at || row.createdAt || 0) >= weekAgo).length,
    hires: pipeline.filter(
      (row) =>
        normalizePipelineStatus(row.status) === "Hired" && Number(row.updated_at || row.updatedAt || 0) >= weekAgo,
    ).length,
  };

  return {
    generatedAt: now,
    funnel: {
      saved: pipelineSummary.counts.Saved || 0,
      reviewing: pipelineSummary.counts.Reviewing || 0,
      interviewing: pipelineSummary.counts.Interviewing || 0,
      offer: pipelineSummary.counts.Offer || 0,
      hired,
      passed,
      active: pipelineSummary.active,
      total: pipelineSummary.total,
    },
    pipelineStatuses: PIPELINE_STATUSES.map((status) => ({
      status,
      count: pipelineSummary.counts[status] || 0,
    })),
    postings: {
      total: postings.length,
      open: openPostings,
      draft: postings.filter((row) => String(row.status || "").toLowerCase() === "draft").length,
      closed: postings.filter((row) => String(row.status || "").toLowerCase() === "closed").length,
    },
    invites: {
      ...inviteSummary,
      acceptRate: inviteAcceptRate,
      responded: respondedInvites,
    },
    interviews: {
      rooms: rooms.length,
      liveRooms,
      endedRooms,
      voiceSessions: voiceSessions.length,
      liveVoice,
      completeVoice,
    },
    rates: {
      hireRate,
      inviteAcceptRate,
      medianHoursToInterview: median(timeToInterviewHours),
      medianInviteResponseHours: median(inviteResponseHours),
    },
    recent,
  };
}

/**
 * Flag SLA breaches for pipeline, invites, and interviewing backlog.
 */
export function findSlaBreaches({
  pipeline = [],
  invites = [],
  rooms = [],
  voiceSessions = [],
  sla = DEFAULT_SLA,
  now = Date.now(),
} = {}) {
  const settings = normalizeSlaSettings(sla);
  const breaches = [];
  const interviewedCandidateIds = new Set([
    ...rooms.map((row) => row.candidate_user_id || row.candidateUserId).filter(Boolean),
    ...voiceSessions.map((row) => row.candidate_user_id || row.candidateUserId).filter(Boolean),
  ]);

  for (const row of pipeline) {
    const status = normalizePipelineStatus(row.status);
    const hours = ageHours(row.updated_at || row.updatedAt || row.created_at || row.createdAt, now);
    if (["Saved", "Reviewing"].includes(status) && hours >= settings.reviewHours) {
      breaches.push({
        id: `pipeline-review-${row.id}`,
        kind: "review",
        severity: hours >= settings.reviewHours * 2 ? "high" : "medium",
        subjectId: row.id,
        candidateUserId: row.candidate_user_id || row.candidateUserId || "",
        title: status === "Saved" ? "Shortlist waiting for review" : "Candidate stuck in Reviewing",
        detail: `${hours}h in ${status} (SLA ${settings.reviewHours}h).`,
        hoursOver: hours - settings.reviewHours,
        action: "Move the candidate forward or pass them.",
      });
    }
    if (
      status === "Interviewing" &&
      hours >= settings.interviewHours &&
      !interviewedCandidateIds.has(row.candidate_user_id || row.candidateUserId)
    ) {
      breaches.push({
        id: `pipeline-interview-${row.id}`,
        kind: "interview",
        severity: "high",
        subjectId: row.id,
        candidateUserId: row.candidate_user_id || row.candidateUserId || "",
        title: "Interview stage with no room or voice session",
        detail: `${hours}h in Interviewing without a scheduled room (SLA ${settings.interviewHours}h).`,
        hoursOver: hours - settings.interviewHours,
        action: "Open an interview room or update the stage.",
      });
    }
  }

  for (const row of invites) {
    const status = normalizeInviteStatus(row.status);
    if (!["pending", "viewed"].includes(status)) continue;
    const hours = ageHours(row.created_at || row.createdAt, now);
    if (hours < settings.inviteHours) continue;
    breaches.push({
      id: `invite-${row.id}`,
      kind: "invite",
      severity: hours >= settings.inviteHours * 2 ? "high" : "medium",
      subjectId: row.id,
      candidateUserId: row.candidate_user_id || row.candidateUserId || "",
      title: status === "pending" ? "Invite awaiting candidate response" : "Viewed invite still open",
      detail: `${hours}h since invite sent (SLA ${settings.inviteHours}h).`,
      hoursOver: hours - settings.inviteHours,
      action: "Follow up with the candidate or close the invite.",
    });
  }

  return breaches.sort((a, b) => b.hoursOver - a.hoursOver || a.title.localeCompare(b.title));
}

export function buildEmployerInsights(analytics, breaches = []) {
  const tips = [];
  if ((analytics.funnel.active || 0) === 0) {
    tips.push({
      id: "start-pipeline",
      title: "Build the pipeline",
      detail: "Save public candidates and open a posting so invites and interviews have somewhere to go.",
    });
  }
  if ((analytics.postings.open || 0) === 0 && (analytics.funnel.total || 0) > 0) {
    tips.push({
      id: "open-posting",
      title: "Publish an open role",
      detail: "Open postings unlock outbound invites and keep the catalog current.",
    });
  }
  if ((analytics.invites.open || 0) > 3) {
    tips.push({
      id: "clear-invites",
      title: "Clear waiting invites",
      detail: `${analytics.invites.open} invites are still pending or viewed. Follow up or close stale ones.`,
    });
  }
  if (breaches.some((item) => item.kind === "interview")) {
    tips.push({
      id: "schedule-interviews",
      title: "Schedule overdue interviews",
      detail: "Candidates in Interviewing without a room are past your interview SLA.",
    });
  }
  if (breaches.some((item) => item.kind === "review")) {
    tips.push({
      id: "review-backlog",
      title: "Work the review backlog",
      detail: "Shortlisted candidates have waited longer than your review SLA.",
    });
  }
  if ((analytics.rates.hireRate || 0) >= 50 && (analytics.funnel.hired || 0) > 0) {
    tips.push({
      id: "healthy-hire-rate",
      title: "Hire rate looks healthy",
      detail: `${analytics.rates.hireRate}% of decided candidates were hired. Keep the same screening bar.`,
    });
  }
  if (!tips.length) {
    tips.push({
      id: "steady",
      title: "No urgent hiring blockers",
      detail: "Funnel and SLA checks look clear. Keep moving active candidates weekly.",
    });
  }
  return tips.slice(0, 5);
}
