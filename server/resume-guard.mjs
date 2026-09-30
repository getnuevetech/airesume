/** Fact-ledger aware claim checks and job-specific resume shaping. */

function numbersIn(text) {
  return String(text || "").match(/\d[\d,.]*/g) || [];
}

function factBlob(facts = []) {
  return (facts || [])
    .map((fact) => (typeof fact === "string" ? fact : fact?.statement || ""))
    .filter(Boolean)
    .join("\n");
}

/**
 * Reject proposed text that introduces numbers absent from source or fact ledger.
 */
export function claimsSupported(proposed, source, facts = []) {
  const blob = `${source || ""}\n${factBlob(facts)}`;
  return numbersIn(proposed).every((number) => blob.includes(number));
}

/** Normalize AI paths like employment[0].bullets[1] → employment.0.bullets.1 */
export function normalizeResumePath(path) {
  return String(path || "")
    .replace(/\[(\d+)\]/g, ".$1")
    .replace(/^\.+/, "")
    .trim();
}

/**
 * Ensure every employer / skill token in the document appears in facts or source text.
 * Used after tailoring so we never invent entities.
 */
export function documentSupportedByFacts(doc, facts = [], source = "") {
  const blob = `${source}\n${factBlob(facts)}`.toLowerCase();
  const employers = (doc.employment || []).map((job) => String(job.employer || "").trim()).filter(Boolean);
  for (const employer of employers) {
    if (!blob.includes(employer.toLowerCase())) return false;
  }
  for (const skill of doc.skills || []) {
    const token = String(skill || "").trim();
    if (!token) continue;
    if (!blob.includes(token.toLowerCase())) return false;
  }
  return true;
}

function bulletRank(bullet, matched) {
  const text = String(bullet || "").toLowerCase();
  return matched.reduce((score, skill) => (text.includes(String(skill).toLowerCase()) ? score + 1 : score), 0);
}

/**
 * Build a job-specific presentation of the fact ledger.
 * Only reorders existing skills/roles/bullets — does not invent text.
 */
export function tailoredDocument(doc, job, match, facts = []) {
  const matched = [...(match.matched || []), ...(match.preferredMatched || [])];
  const skills = [...(doc.skills || [])].sort((a, b) => {
    const aHit = matched.some((skill) => a.toLowerCase().includes(String(skill).toLowerCase()) || String(skill).toLowerCase().includes(a.toLowerCase()));
    const bHit = matched.some((skill) => b.toLowerCase().includes(String(skill).toLowerCase()) || String(skill).toLowerCase().includes(b.toLowerCase()));
    return Number(bHit) - Number(aHit);
  });
  const role = `${job.title || ""} ${job.role || ""}`.toLowerCase();
  const employment = (doc.employment || [])
    .map((item) => ({
      ...item,
      bullets: [...(item.bullets || [])].sort((a, b) => bulletRank(b, matched) - bulletRank(a, matched)),
    }))
    .sort((a, b) => {
      const aTitle = `${a.title || ""}`.toLowerCase();
      const bTitle = `${b.title || ""}`.toLowerCase();
      const aScore = role && aTitle && (role.includes(aTitle) || aTitle.includes(role.split(" ")[0] || "")) ? 1 : bulletRank((a.bullets || []).join(" "), matched);
      const bScore = role && bTitle && (role.includes(bTitle) || bTitle.includes(role.split(" ")[0] || "")) ? 1 : bulletRank((b.bullets || []).join(" "), matched);
      return bScore - aScore;
    });
  const next = {
    ...doc,
    skills,
    employment,
    target: {
      company: job.primary_company || job.company || "",
      title: job.title || "",
      matchLabel: match.label || "",
    },
  };
  const source = JSON.stringify(doc);
  if (!documentSupportedByFacts(next, facts, source)) {
    return { ...doc, skills };
  }
  for (const item of employment) {
    for (const bullet of item.bullets || []) {
      if (!claimsSupported(bullet, source, facts)) {
        return { ...doc, skills };
      }
    }
  }
  return next;
}

function sameBag(left, right) {
  const a = [...left].map(String).sort();
  const b = [...right].map(String).sort();
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

function roleKey(job) {
  return `${job?.title || ""}|${job?.employer || ""}`.toLowerCase();
}

function roleLabel(job) {
  return [job?.title, job?.employer].filter(Boolean).join(" at ");
}

/**
 * Explain how a job-specific resume was reordered from the source resume.
 * Only reports moves of skills, roles, and bullets that already exist.
 */
export function describeTailoring(original = {}, tailored = {}) {
  const changes = [];
  const origSkills = (original.skills || []).map(String);
  const nextSkills = (tailored.skills || []).map(String);
  if (sameBag(origSkills, nextSkills) && origSkills[0] && nextSkills[0] && origSkills[0] !== nextSkills[0]) {
    changes.push({
      kind: "skills",
      before: origSkills.join(", "),
      after: nextSkills.join(", "),
      detail: `${nextSkills[0]} now leads the skills list.`,
    });
  }
  const origJobs = original.employment || [];
  const nextJobs = tailored.employment || [];
  const origKeys = origJobs.map(roleKey);
  const nextKeys = nextJobs.map(roleKey);
  if (sameBag(origKeys, nextKeys) && origKeys[0] && nextKeys[0] && origKeys[0] !== nextKeys[0]) {
    changes.push({
      kind: "role",
      before: roleLabel(origJobs[0]),
      after: roleLabel(nextJobs[0]),
      detail: `${roleLabel(nextJobs[0])} now leads experience.`,
    });
  }
  if (sameBag(origKeys, nextKeys)) {
    for (const next of nextJobs) {
      const prev = origJobs.find((job) => roleKey(job) === roleKey(next));
      if (!prev) continue;
      const before = (prev.bullets || []).map(String);
      const after = (next.bullets || []).map(String);
      if (sameBag(before, after) && before[0] && after[0] && before[0] !== after[0]) {
        changes.push({
          kind: "bullet",
          before: before[0],
          after: after[0],
          detail: `"${after[0]}" now leads ${roleLabel(next)}.`,
        });
      }
    }
  }
  const company = String(tailored.target?.company || "");
  const title = String(tailored.target?.title || "");
  const target = [title, company].filter(Boolean).join(" at ");
  const summary = changes.length
    ? `Reordered your resume for ${target || "this role"}. No new employers, dates, or skills were added.`
    : `Your resume already leads with the facts ${target ? `${target} asks for` : "this role asks for"}. Nothing new was added.`;
  return { summary, changes };
}

/** Preview stored on an application version. Upload and upscale versions are not job tailors. */
export function tailoringPreview(version, versions = []) {
  if (!version || version.kind !== "application") return null;
  let original = {};
  let tailored = {};
  try {
    const parent = versions.find((row) => row.id === version.parent_id);
    original = parent?.document ? JSON.parse(parent.document) : {};
    tailored = version.document ? JSON.parse(version.document) : {};
  } catch {
    return null;
  }
  const described = describeTailoring(original, tailored);
  return {
    versionId: version.id,
    label: version.label || "",
    rendered: version.rendered || "",
    summary: described.summary,
    changes: described.changes,
  };
}
