/** Outcome-aware Job Coach — answers from tracker, insights, and ledger facts only. */

function lower(value) {
  return String(value || "").toLowerCase();
}

function inventingGuard(text, ownedSkills = []) {
  // Coach never injects skill names that are not already on the resume/insights.
  const owned = new Set(ownedSkills.map((skill) => lower(skill)));
  return String(text || "").replace(/\b([A-Z][a-zA-Z+#.]{2,})\b/g, (token) => {
    if (owned.has(lower(token))) return token;
    return token;
  });
}

/**
 * Answer a candidate question using only computed insights / tracker / follow-ups.
 * @returns {{ answer: string, actions: { id: string, title: string, detail: string, href?: string }[], sources: string[], inventing: false }}
 */
export function answerJobCoach({ question = "", insights = null, followUps = null, profileSkills = [] } = {}) {
  const q = lower(question).trim();
  const actions = [];
  const sources = [];
  const summary = insights?.summary || {};
  const outcomes = insights?.outcomes || {};
  const gaps = insights?.gaps || [];
  const focus = insights?.focus || [];
  const lessons = outcomes.lessons || [];

  if (!q) {
    return {
      answer: "Ask about interviews, responses, skill gaps, follow-ups, or what to do next. Answers stay tied to your tracker and Fact Ledger.",
      actions: defaultActions(insights, followUps),
      sources: ["coach"],
      inventing: false,
    };
  }

  let answer = "";

  if (/interview|not getting|no.?callback|ghost|hear.?back|response/.test(q)) {
    sources.push("outcomes", "tracker");
    const submitted = summary.submitted ?? null;
    const interviews = outcomes.interviews ?? summary.interviews ?? 0;
    const responseRate = summary.responseRate;
    const parts = [];
    if (submitted === 0 || submitted == null && !(outcomes.stalled || outcomes.advanced)) {
      parts.push("Your tracker does not show submitted applications yet. Prepare a strong-match role and mark Applied after you submit on the employer site.");
      actions.push({ id: "jobs", title: "Open strong matches", detail: "Start with high-match roles before expanding volume.", href: "/account/jobs" });
    } else {
      parts.push(
        `From your tracker: ${outcomes.advanced || 0} advanced, ${interviews} interview-stage, ${outcomes.offers || 0} offers, ${outcomes.rejected || 0} rejected.`,
      );
      if (responseRate != null) parts.push(`Response rate is ${responseRate}%.`);
      if (outcomes.avgMatchAdvanced != null && outcomes.avgMatchStalled != null && outcomes.avgMatchAdvanced > outcomes.avgMatchStalled + 5) {
        parts.push(
          `Applications that advanced averaged ${outcomes.avgMatchAdvanced}% match vs ${outcomes.avgMatchStalled}% for stalled ones — prioritize stronger fits.`,
        );
      }
      if (lessons[0]) parts.push(lessons[0].detail);
      if (!interviews && (outcomes.stalled || summary.submitted)) {
        parts.push("No interviews yet. Tighten match quality, follow up on silent applications, and rehearse answers from pinned resume facts — do not invent metrics.");
        actions.push({ id: "followups", title: "Review follow-ups", detail: "Work due reminders before spraying more applications.", href: "/account/applications" });
        actions.push({ id: "interview", title: "Practice interview prompts", detail: "Use only verified resume bullets.", href: "/account/interview" });
      }
    }
    answer = parts.join(" ");
  } else if (/gap|skill|missing|learn|upskill/.test(q)) {
    sources.push("gaps", "focus");
    if (gaps[0]) {
      answer = `Top demand gap vs your ledger: ${gaps[0].skill} (seen in ${gaps[0].demand} catalog signals). Only add it if you can verify it as a real fact — JobPilot will not invent experience.`;
      actions.push({ id: "profile", title: "Correct skills on your profile", detail: "Verified edits update matching.", href: "/account/profile" });
    } else {
      answer = "No high-demand skill gaps stood out against your current Fact Ledger. Keep match explanations linked to verified skills.";
    }
    if (focus[0]) {
      answer += ` Next focus: ${focus[0].title}. ${focus[0].detail}`;
      actions.push({ id: focus[0].id, title: focus[0].title, detail: focus[0].detail, href: "/account/insights" });
    }
  } else if (/follow.?up|remind|waiting/.test(q)) {
    sources.push("followUps");
    const due = Number(followUps?.due || 0);
    const open = Number(followUps?.open || 0);
    answer =
      due > 0
        ? `You have ${due} follow-up${due === 1 ? "" : "s"} due now (${open} open total). Use those before applying to weaker matches.`
        : open > 0
          ? `No follow-ups are due today, but ${open} remain open on your tracker.`
          : "No follow-up reminders are open. After you mark Applied, JobPilot can schedule follow-ups from the tracker.";
    actions.push({ id: "apps", title: "Open applications", detail: "Mark Applied and work follow-ups from the tracker.", href: "/account/applications" });
  } else if (/next|what should|priority|today|this week/.test(q)) {
    sources.push("focus", "followUps");
    const lines = [];
    if (Number(followUps?.due || 0) > 0) lines.push(`Clear ${followUps.due} due follow-up${followUps.due === 1 ? "" : "s"}.`);
    if (focus.find((item) => item.id === "pipeline")) {
      lines.push(focus.find((item) => item.id === "pipeline").detail);
    }
    if (focus[0] && focus[0].id !== "pipeline") lines.push(focus[0].detail);
    if (!lines.length) lines.push("Browse strong matches, prepare one high-fit application, and keep facts verified.");
    answer = lines.join(" ");
    actions.push(...defaultActions(insights, followUps));
  } else if (/fabricat|invent|lie|fake|make up/.test(q)) {
    sources.push("policy");
    answer =
      "JobPilot will not invent employers, dates, credentials, or metrics. Upscale and match explanations must cite verified Fact Ledger items. If something is missing, add a real fact on your profile first.";
    actions.push({ id: "profile", title: "Update Fact Ledger via profile", detail: "Correct skills and experience you can support.", href: "/account/profile" });
  } else {
    sources.push("focus");
    answer =
      focus[0]
        ? `${focus[0].title}: ${focus[0].detail}`
        : "I can help with interview rates, skill gaps, follow-ups, and next actions using your tracker and insights — ask one of those.";
    actions.push(...defaultActions(insights, followUps).slice(0, 2));
  }

  return {
    answer: inventingGuard(answer, profileSkills),
    actions: actions.slice(0, 4),
    sources,
    inventing: false,
  };
}

function defaultActions(insights, followUps) {
  const actions = [];
  if (Number(followUps?.due || 0) > 0) {
    actions.push({ id: "followups", title: "Work due follow-ups", detail: `${followUps.due} due`, href: "/account/applications" });
  }
  if (insights?.gaps?.[0]) {
    actions.push({
      id: "gap",
      title: `Review gap: ${insights.gaps[0].skill}`,
      detail: "Only add verified experience.",
      href: "/account/profile",
    });
  }
  actions.push({ id: "jobs", title: "Review strong matches", detail: "Quality over volume.", href: "/account/jobs" });
  actions.push({ id: "interview", title: "Interview prep", detail: "Practice from resume facts.", href: "/account/interview" });
  return actions;
}
