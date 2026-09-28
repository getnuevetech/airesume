/** Draft application answers from the fact ledger. Sensitive fields stay blank. */

const SENSITIVE = [
  { id: "salary", pattern: /salary|compensation|pay expectation|expected pay|base pay|total comp/i, label: "Salary / compensation" },
  { id: "sponsorship", pattern: /sponsor|visa|h-?1b|immigration/i, label: "Visa / sponsorship" },
  { id: "authorization", pattern: /work authorization|authorized to work|legally authorized/i, label: "Work authorization" },
  { id: "disability", pattern: /disability|disabled|accommodation/i, label: "Disability" },
  { id: "veteran", pattern: /veteran|military service|protected veteran/i, label: "Veteran status" },
  { id: "race", pattern: /\brace\b|ethnicity|demographic|eeo|equal opportunity/i, label: "Race / ethnicity" },
  { id: "gender", pattern: /\bgender\b|\bsex\b|pronoun/i, label: "Gender" },
  { id: "criminal", pattern: /criminal|conviction|background check/i, label: "Criminal / background" },
];

function sensitiveMatch(prompt) {
  return SENSITIVE.find((item) => item.pattern.test(prompt)) || null;
}

function bullets(doc) {
  return (doc.employment || [])
    .flatMap((job) => (job.bullets || []).map((bullet) => ({ employer: job.employer || "", title: job.title || "", bullet })))
    .filter((item) => item.bullet);
}

function whyFit(doc, job, match) {
  const skills = (match?.matched || doc.skills || []).slice(0, 4);
  const role = (doc.employment || [])[0];
  const bits = [];
  if (role?.title) bits.push(`I most recently worked as ${role.title}${role.employer ? ` at ${role.employer}` : ""}`);
  if (skills.length) bits.push(`with strength in ${skills.join(", ")}`);
  bits.push(`which aligns with ${job.title || "this role"} at ${job.primary_company || job.company || "the company"}`);
  return `${bits.join(" ")}.`;
}

function experienceSummary(doc) {
  const roles = (doc.employment || []).slice(0, 3).map((job) => {
    const lead = [job.title, job.employer].filter(Boolean).join(" at ");
    const first = (job.bullets || [])[0];
    return first ? `${lead}: ${first}` : lead;
  }).filter(Boolean);
  return roles.join(" ") || String(doc.summary || "").trim();
}

/**
 * Build question drafts for an application.
 * Sensitive prompts are returned blank for the user to fill.
 */
export function draftQuestions(job, doc = {}, preferences = {}, match = {}) {
  const description = String(job.description || "");
  const questions = [];
  const seen = new Set();

  function push(item) {
    const key = item.prompt.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    questions.push(item);
  }

  push({
    id: "why-fit",
    prompt: `Why are you a fit for ${job.title || "this role"}?`,
    kind: "draft",
    answer: whyFit(doc, job, match),
    source: "profile",
  });

  push({
    id: "experience",
    prompt: "Summarize your relevant experience.",
    kind: "draft",
    answer: experienceSummary(doc).slice(0, 900),
    source: "profile",
  });

  if ((doc.skills || []).length) {
    push({
      id: "skills",
      prompt: "Which skills from your background apply here?",
      kind: "draft",
      answer: (match.matched?.length ? match.matched : doc.skills).slice(0, 10).join(", "),
      source: "profile",
    });
  }

  const lineQuestions = description
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter((line) => /\?$/.test(line) || /^(please )?(describe|explain|tell us|what is|how many|are you|do you|have you)\b/i.test(line));

  lineQuestions.slice(0, 8).forEach((prompt, index) => {
    const sensitive = sensitiveMatch(prompt);
    if (sensitive) {
      push({
        id: `jd-${sensitive.id}-${index}`,
        prompt,
        kind: "user",
        answer: "",
        blankReason: `Left blank — ${sensitive.label} must be entered by you.`,
        source: "listing",
      });
      return;
    }
    const tip = bullets(doc).find((item) => prompt.toLowerCase().split(/\W+/).some((token) => token.length > 4 && item.bullet.toLowerCase().includes(token)));
    push({
      id: `jd-${index}`,
      prompt,
      kind: tip ? "draft" : "user",
      answer: tip ? tip.bullet : "",
      blankReason: tip ? "" : "No matching fact found — add your own answer.",
      source: "listing",
    });
  });

  // Always include sensitive placeholders when preferences suggest they may be asked.
  for (const item of SENSITIVE) {
    if (item.id === "authorization" || item.id === "salary" || item.id === "sponsorship") {
      push({
        id: `std-${item.id}`,
        prompt: item.label,
        kind: "user",
        answer: "",
        blankReason: `Left blank — ${item.label} must be entered by you.`,
        source: "policy",
      });
    }
  }

  if (preferences.workAuthorization) {
    const auth = questions.find((item) => item.id === "std-authorization");
    // Still leave blank for explicit confirmation; surface preference as hint only.
    if (auth) auth.hint = `Profile note: ${preferences.workAuthorization}`;
  }
  if (preferences.salary) {
    const salary = questions.find((item) => item.id === "std-salary");
    if (salary) salary.hint = `Profile target salary note is set, but the answer stays blank until you confirm.`;
  }

  return questions.slice(0, 16);
}
