/** Fact-safe voice practice sessions built from interview prep prompts. */

function lower(value) {
  return String(value || "").toLowerCase();
}

function tokenize(text) {
  return lower(text)
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function unique(items) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = lower(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(String(item));
  }
  return out;
}

function bullets(doc = {}) {
  return (doc.employment || [])
    .flatMap((job) =>
      (job.bullets || []).map((bullet) => ({
        employer: String(job.employer || ""),
        title: String(job.title || ""),
        dates: String(job.dates || ""),
        bullet: String(bullet || "").trim(),
      })),
    )
    .filter((item) => item.bullet);
}

function extractFacts(doc = {}, match = {}) {
  const pool = bullets(doc);
  const skills = unique([...(match.matched || []), ...(doc.skills || [])]).slice(0, 16);
  const employers = unique(pool.map((item) => item.employer).filter(Boolean));
  const titles = unique(pool.map((item) => item.title).filter(Boolean));
  const phrases = unique(pool.map((item) => item.bullet)).slice(0, 12);
  const numbers = unique(
    [...phrases, String(doc.summary || "")]
      .join(" ")
      .match(/\d+(\.\d+)?%?|\b\d{4}\b/g) || [],
  );
  return {
    skills,
    employers,
    titles,
    phrases,
    numbers,
    pool,
    missing: unique(match.missing || []).slice(0, 8),
  };
}

/**
 * Build a voice practice script from an interview prep pack.
 */
export function buildVoicePractice({ prep, doc = {}, match = {} } = {}) {
  const facts = extractFacts(doc, match);
  const prompts = (prep?.prompts || []).map((item, index) => ({
    id: item.id || `q${index + 1}`,
    prompt: item.prompt,
    kind: item.kind || "general",
    coachAnswer: item.answer || "",
    ready: Boolean(item.ready),
    note: item.note || "",
    sourceBullet: item.sourceBullet || null,
  }));
  return {
    title: prep?.title || "Role",
    company: prep?.company || "",
    applicationId: prep?.applicationId || null,
    prompts,
    facts: {
      skills: facts.skills,
      employers: facts.employers,
      titles: facts.titles,
      knownNumbers: facts.numbers,
      missing: facts.missing,
    },
    coverage: prep?.coverage || null,
    reminders: [
      "Speak from resume facts only — employers, skills, and numbers you can verify.",
      "Browser speech is optional; typed answers work the same for coaching.",
      "Do not invent metrics during practice. Gaps stay honest.",
      prep?.coverage?.practiceReady
        ? "Prep coverage is ready — aim for STAR structure without new numbers."
        : "Finish interview prep coverage before treating this as interview-ready.",
    ],
  };
}

function hitList(answerLower, values) {
  return values.filter((value) => {
    const needle = lower(value);
    return needle.length > 2 && answerLower.includes(needle);
  });
}

/**
 * Score a spoken/typed answer against known resume facts. Never invents metrics.
 */
export function scoreVoiceAnswer({ prompt, answer = "", facts = {}, coachAnswer = "" } = {}) {
  const text = String(answer || "").trim();
  const answerLower = lower(text);
  const skills = facts.skills || [];
  const employers = facts.employers || [];
  const titles = facts.titles || [];
  const knownNumbers = facts.knownNumbers || [];
  const usedSkills = hitList(answerLower, skills);
  const usedEmployers = hitList(answerLower, employers);
  const usedTitles = hitList(answerLower, titles);
  const usedNumbers = hitList(answerLower, knownNumbers);
  const spokenNumbers = text.match(/\d+(\.\d+)?%?|\b\d{4}\b/g) || [];
  const unverifiedNumbers = spokenNumbers.filter(
    (num) => !knownNumbers.some((known) => lower(known) === lower(num)),
  );

  const notes = [];
  let score = 0;
  if (!text) {
    return {
      score: 0,
      label: "empty",
      usedSkills: [],
      usedEmployers: [],
      usedTitles: [],
      usedNumbers: [],
      unverifiedNumbers: [],
      notes: ["No answer captured. Speak or type a response based on a real resume bullet."],
      suggestion: coachAnswer || "Lean on a verified bullet from your resume before answering aloud.",
    };
  }

  if (text.split(/\s+/).length >= 18) score += 20;
  else if (text.split(/\s+/).length >= 8) score += 10;
  else notes.push("Answers under a few sentences rarely cover Situation → Action → Result.");

  if (usedEmployers.length || usedTitles.length) {
    score += 25;
    notes.push(`Anchored to ${[...usedTitles, ...usedEmployers].slice(0, 2).join(" / ")}.`);
  } else {
    notes.push("Name the role or employer from your resume so the story stays concrete.");
  }

  if (usedSkills.length) {
    score += Math.min(30, usedSkills.length * 12);
    notes.push(`Referenced verified skills: ${usedSkills.slice(0, 4).join(", ")}.`);
  } else if (skills.length) {
    notes.push(`Try weaving in a matched skill such as ${skills[0]}.`);
  }

  if (usedNumbers.length) {
    score += 15;
    notes.push(`Kept metrics that already appear on your resume (${usedNumbers.slice(0, 3).join(", ")}).`);
  }

  if (unverifiedNumbers.length) {
    score = Math.max(0, score - 20);
    notes.push(
      `Flagged numbers not found on your resume (${unverifiedNumbers.slice(0, 3).join(", ")}). Drop them or confirm them in your fact ledger first.`,
    );
  }

  if (prompt?.kind === "growth" && /master|expert|proficient/i.test(text) && (facts.missing || []).length) {
    score = Math.max(0, score - 10);
    notes.push("Growth answers should stay honest about gaps — avoid claiming mastery you have not listed.");
  }

  if (prompt?.kind === "star" || prompt?.kind === "impact") {
    const hasStarShape =
      /\b(situation|task|action|result|owned|led|delivered|built|shipped)\b/i.test(text) ||
      text.split(/\s+/).length >= 24;
    if (hasStarShape) score += 8;
    else notes.push("Shape the story as Situation → Action → Result using one resume bullet.");
  }

  if (prompt?.kind === "followup" && /guarantee|offer|salary|visa/i.test(text)) {
    score = Math.max(0, score - 15);
    notes.push("Follow-ups should stay polite and factual — avoid salary, visa, or outcome promises.");
  }

  // Reject claiming employers/skills not in the fact ledger.
  const claimedEmployerish = text.match(/\bat\s+([A-Z][A-Za-z0-9&.\- ]{1,40})/g) || [];
  for (const claim of claimedEmployerish.slice(0, 3)) {
    const name = claim.replace(/^\bat\s+/i, "").trim();
    if (name.length < 3) continue;
    const known = employers.some((employer) => lower(employer).includes(lower(name)) || lower(name).includes(lower(employer)));
    if (!known && !titles.some((title) => lower(title).includes(lower(name)))) {
      // Soft flag only when name looks like a company token and is not in resume.
      if (/[A-Z]/.test(name[0]) && !/^(the|this|that|my|our)$/i.test(name)) {
        notes.push(`“${name}” is not on your resume employers list — stick to verified workplaces.`);
        score = Math.max(0, score - 8);
      }
    }
  }

  if (prompt?.sourceBullet?.bullet && answerLower.includes(lower(prompt.sourceBullet.bullet).slice(0, 24))) {
    score += 10;
    notes.push("Echoed your source resume bullet.");
  }

  score = Math.max(0, Math.min(100, score));
  let label = "needs work";
  if (score >= 75) label = "strong";
  else if (score >= 45) label = "solid";

  const suggestion = prompt?.sourceBullet
    ? `Next pass: start from “${prompt.sourceBullet.bullet}” (${[prompt.sourceBullet.title, prompt.sourceBullet.employer].filter(Boolean).join(" · ")}).`
    : coachAnswer
      ? `Coach draft to rehearse (facts only): ${coachAnswer}`
      : "Pull one concrete bullet from your resume and answer in STAR order.";

  return {
    score,
    label,
    usedSkills,
    usedEmployers,
    usedTitles,
    usedNumbers,
    unverifiedNumbers,
    notes,
    suggestion,
  };
}

/**
 * Summarize a finished practice session from stored turns.
 */
export function summarizeVoiceSession(turns = []) {
  const answered = turns.filter((turn) => String(turn.answer || "").trim());
  const avg =
    answered.length === 0
      ? 0
      : Math.round(answered.reduce((sum, turn) => sum + Number(turn.feedback?.score || 0), 0) / answered.length);
  const invented = answered.filter((turn) => (turn.feedback?.unverifiedNumbers || []).length > 0).length;
  const strong = answered.filter((turn) => Number(turn.feedback?.score || 0) >= 75).length;
  const coverage = turns.length ? Math.round((answered.length / turns.length) * 100) : 0;
  return {
    answered: answered.length,
    total: turns.length,
    averageScore: avg,
    inventedMetricFlags: invented,
    strongAnswers: strong,
    coveragePercent: coverage,
    practiceHardened: invented === 0 && coverage >= 70 && avg >= 45,
    status: answered.length >= turns.length && turns.length ? "complete" : answered.length ? "in_progress" : "started",
  };
}
