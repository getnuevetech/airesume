/** Fact-safe interview prep packs from resume bullets and the listing. */

const BEHAVIORAL = [
  { id: "tell-me", prompt: "Tell me about yourself.", kind: "intro" },
  { id: "why-role", prompt: "Why this role?", kind: "motivation" },
  { id: "challenge", prompt: "Tell me about a challenging project.", kind: "star" },
  { id: "conflict", prompt: "Describe a time you worked through disagreement.", kind: "star" },
  { id: "impact", prompt: "What impact are you most proud of?", kind: "star" },
  { id: "weakness", prompt: "What is a growth area for you?", kind: "growth" },
];

function lower(value) {
  return String(value || "").toLowerCase();
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

function pickBullet(pool, needles = []) {
  const ranked = pool
    .map((item) => {
      const blob = lower(`${item.title} ${item.employer} ${item.bullet}`);
      const hits = needles.filter((needle) => needle && blob.includes(lower(needle))).length;
      return { item, hits };
    })
    .sort((a, b) => b.hits - a.hits);
  return ranked[0]?.item || pool[0] || null;
}

function starAnswer(item, job) {
  if (!item) {
    return {
      ready: false,
      answer: "",
      note: "No matching resume bullet found — write this from a real experience.",
    };
  }
  const company = job.primary_company || job.company || "the company";
  const situation = [item.title, item.employer].filter(Boolean).join(" at ");
  const answer = [
    `Situation: ${situation}${item.dates ? ` (${item.dates})` : ""}.`,
    `Task: Deliver work relevant to ${job.title || "this role"} at ${company}.`,
    `Action: ${item.bullet}`,
    "Result: Tie the outcome to metrics you can verify from that role — do not invent numbers.",
  ].join(" ");
  return { ready: true, answer, note: "Built only from your resume bullet. Add a verified result if you have one." };
}

function introAnswer(doc, job, match) {
  const role = (doc.employment || [])[0];
  const skills = (match?.matched || doc.skills || []).slice(0, 4);
  if (!role && !skills.length && !doc.summary) {
    return { ready: false, answer: "", note: "Add employment or skills on your profile first." };
  }
  const bits = [];
  if (role?.title) bits.push(`I am a ${role.title}${role.employer ? ` most recently at ${role.employer}` : ""}`);
  else if (doc.headline) bits.push(String(doc.headline));
  if (skills.length) bits.push(`with strength in ${skills.join(", ")}`);
  bits.push(`and I am preparing for ${job.title || "this role"} at ${job.primary_company || job.company || "the company"}`);
  if (doc.summary) bits.push(`Summary from my resume: ${String(doc.summary).slice(0, 220)}`);
  return { ready: true, answer: `${bits.join(" ")}.`, note: "Uses only headline, summary, roles, and matched skills from your profile." };
}

function whyRoleAnswer(doc, job, match) {
  const skills = (match?.matched || []).slice(0, 3);
  if (!skills.length && !(doc.employment || []).length) {
    return { ready: false, answer: "", note: "Prepare this after confirming overlapping skills." };
  }
  const company = job.primary_company || job.company || "the company";
  const bits = [`I am interested in ${job.title || "this role"} at ${company}`];
  if (skills.length) bits.push(`because my background overlaps on ${skills.join(", ")}`);
  const role = (doc.employment || [])[0];
  if (role?.title) bits.push(`and my work as ${role.title}${role.employer ? ` at ${role.employer}` : ""} is close to what this listing asks for`);
  return { ready: true, answer: `${bits.join(" ")}.`, note: "Motivation draft from match overlap only." };
}

function growthAnswer(missing = []) {
  if (!missing.length) {
    return {
      ready: true,
      answer: "I keep sharpening skills that listings like this emphasize, and I only claim tools I have actually used.",
      note: "No hard skill gap flagged — keep the answer honest.",
    };
  }
  return {
    ready: true,
    answer: `A growth area for roles like this is ${missing[0]}. I do not claim it as a strength yet; I am prepared to discuss adjacent experience from my resume instead.`,
    note: "Names a catalog gap without inventing proficiency.",
  };
}

function askEmployer(job, match) {
  const company = job.primary_company || job.company || "the team";
  const asks = [
    `What does success look like for ${job.title || "this role"} in the first 90 days at ${company}?`,
    `How does the team measure impact for work like ${(match?.matched || ["this role"])[0]}?`,
  ];
  if ((match?.missing || [])[0]) {
    asks.push(`Where would someone grow ${match.missing[0]} support on this team?`);
  } else {
    asks.push("What is the biggest problem this hire should help solve this quarter?");
  }
  return asks.slice(0, 3);
}

/**
 * Build an interview prep pack. Never invents employers, metrics, or skills.
 */
export function buildInterviewPrep({ job, doc = {}, match = {}, application = null } = {}) {
  const pool = bullets(doc);
  const matched = match.matched || [];
  const missing = match.missing || [];
  const company = application?.target_company || job.primary_company || job.company || "";
  const listingSignals = String(job.description || "")
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter((line) => line.length > 24 && line.length < 160)
    .slice(0, 4);

  const prompts = BEHAVIORAL.map((item) => {
    if (item.kind === "intro") {
      const draft = introAnswer(doc, job, match);
      return { ...item, ...draft };
    }
    if (item.kind === "motivation") {
      const draft = whyRoleAnswer(doc, job, match);
      return { ...item, ...draft };
    }
    if (item.kind === "growth") {
      const draft = growthAnswer(missing);
      return { ...item, ...draft };
    }
    const bullet = pickBullet(pool, [...matched, job.role, job.title, job.category]);
    const draft = starAnswer(bullet, job);
    return {
      ...item,
      ...draft,
      sourceBullet: bullet
        ? { title: bullet.title, employer: bullet.employer, bullet: bullet.bullet }
        : null,
    };
  });

  const talkingPoints = matched.slice(0, 6).map((skill) => {
    const bullet = pickBullet(pool, [skill]);
    return {
      skill,
      detail: bullet
        ? `${bullet.bullet} (${[bullet.title, bullet.employer].filter(Boolean).join(" · ")})`
        : `Be ready to explain how you used ${skill} using only real examples from your history.`,
      ready: Boolean(bullet),
    };
  });

  return {
    applicationId: application?.id || null,
    status: application?.status || "",
    title: job.title || "Role",
    company,
    score: match.score || null,
    label: match.label || "",
    listingUrl: application?.target_url || job.primary_url || job.source_url || "",
    briefing: {
      role: job.role || job.title || "",
      category: job.category || "",
      location: job.location || job.remote_type || "",
      verification: job.verification || "",
      signals: listingSignals,
      missing,
      matched,
    },
    prompts,
    talkingPoints,
    askEmployer: askEmployer(job, match),
    reminders: [
      "Only use employers, skills, and numbers that appear in your resume or fact ledger.",
      "If a gap is listed, say how you would ramp — do not claim mastery you do not have.",
      "Sensitive topics (salary, visa, disability, veteran, EEO) stay your call.",
    ],
  };
}
