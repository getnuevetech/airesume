/**
 * Producer → reviewer disagreement reconciliation.
 * Rules are the final authority against the resume source text.
 * Never invents content; only keep / drop / ask-confirm.
 */

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function textAppearsInSource(source, value) {
  const needle = normalize(value);
  if (!needle || needle.length < 2) return false;
  const hay = normalize(source);
  if (hay.includes(needle)) return true;
  const compact = (text) => text.replace(/[^a-z0-9@.+]/g, "");
  return compact(hay).includes(compact(needle));
}

function pushDecision(decisions, decision) {
  decisions.push(decision);
}

function labelTokens(label) {
  return String(label || "")
    .split(/[:|/,\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function jobLabel(job, index) {
  const title = String(job?.title || "").trim();
  const employer = String(job?.employer || "").trim();
  if (title && employer) return `${title} at ${employer}`;
  if (title || employer) return title || employer;
  return `role ${index + 1}`;
}

function pushUniqueQuestion(questions, question) {
  const next = String(question || "").trim();
  if (!next) return;
  if (questions.some((item) => normalize(item) === normalize(next))) return;
  questions.push(next);
}

/** Turn path-like reviewer labels into plain questions for candidates. */
export function humanizeClaimLabel(label, employment = []) {
  const raw = String(label || "").trim();
  if (!raw) return "";
  if (/^please\b/i.test(raw) && !/[\[\].]/.test(raw)) return raw;

  const empMatch = raw.match(/^employment\s*[\[.]?\s*(\d+)\s*[\].]?\s*[.\[]?\s*([a-zA-Z_][\w]*)?/i);
  if (empMatch) {
    const index = Number(empMatch[1]);
    const field = String(empMatch[2] || "").toLowerCase();
    const where = jobLabel(employment[index], Number.isFinite(index) ? index : 0);
    if (field === "dates" || field === "date") return `Confirm the dates for ${where}.`;
    if (field === "title") return `Confirm the job title for ${where}.`;
    if (field === "employer" || field === "company") return `Confirm the employer for ${where}.`;
    if (field.startsWith("bullet")) return `Confirm the accomplishments listed for ${where}.`;
    if (!field) return `Confirm the details for ${where}.`;
    return `Confirm the ${field.replace(/_/g, " ")} for ${where}.`;
  }

  const eduMatch = raw.match(/^education\s*[\[.]?\s*(\d+)\s*[\].]?\s*[.\[]?\s*([a-zA-Z_][\w]*)?/i);
  if (eduMatch) {
    const field = String(eduMatch[2] || "entry").toLowerCase().replace(/_/g, " ");
    return `Confirm education ${field} #${Number(eduMatch[1]) + 1}.`;
  }

  const skillMatch = raw.match(/^skills?\s*[\[.]?\s*(\d+)/i);
  if (skillMatch) return `Confirm skill #${Number(skillMatch[1]) + 1} from your resume.`;

  if (/[\[\]]/.test(raw) || /^[a-z_][\w.]*\[\d+\]/i.test(raw) || /^[a-z_]+\.\d+(\.|$)/i.test(raw)) {
    return "Confirm a resume detail the second review could not verify.";
  }

  if (/^employer:/i.test(raw)) return `Confirm the employer “${raw.slice(9).trim()}”.`;
  if (/^title:/i.test(raw)) return `Confirm the role title “${raw.slice(6).trim()}”.`;
  if (/^skill:/i.test(raw)) return `Confirm the skill “${raw.slice(6).trim()}”.`;

  return /^please\b/i.test(raw) ? raw : `Please confirm: ${raw}`;
}

/**
 * @param {object} options
 * @param {string} options.source Resume text
 * @param {object} options.profile Rules-cleaned producer profile
 * @param {{ status?: string, unsupported?: string[], notes?: string[] } | null} options.reviewer
 */
export function reconcileProducerReviewer({ source = "", profile = {}, reviewer = null } = {}) {
  const decisions = [];
  const next = {
    ...profile,
    skills: Array.isArray(profile.skills) ? profile.skills.slice() : [],
    employment: Array.isArray(profile.employment)
      ? profile.employment.map((job) => ({ ...job, bullets: [...(job.bullets || [])] }))
      : [],
    education: Array.isArray(profile.education) ? profile.education.slice() : [],
    facts: Array.isArray(profile.facts) ? profile.facts.map((fact) => ({ ...fact })) : [],
    questions: Array.isArray(profile.questions) ? profile.questions.slice() : [],
    warnings: Array.isArray(profile.warnings) ? profile.warnings.slice() : [],
  };

  const unsupported = Array.isArray(reviewer?.unsupported)
    ? reviewer.unsupported.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  const notes = Array.isArray(reviewer?.notes) ? reviewer.notes.map((item) => String(item || "").trim()).filter(Boolean) : [];
  const reviewerStatus = String(reviewer?.status || "").toLowerCase();

  if (!reviewer) {
    return {
      profile: next,
      decisions,
      status: "skipped",
      dropped: [],
      kept: [],
      confirmed: [],
    };
  }

  if (reviewerStatus === "pass" && !unsupported.length) {
    pushDecision(decisions, {
      field: "*",
      action: "agree",
      reason: "Reviewer agreed with the producer profile.",
    });
    return {
      profile: next,
      decisions,
      status: "agree",
      dropped: [],
      kept: [],
      confirmed: [],
    };
  }

  const dropped = [];
  const confirmed = [];
  const kept = [];
  const employmentDateJobs = [];
  let genericPathConfirms = 0;

  for (const label of unsupported) {
    const field = normalize(label);
    const tokens = labelTokens(label);

    if (["name", "email", "phone", "city", "address", "summary"].includes(field)) {
      const value = next[field];
      if (!value) {
        pushDecision(decisions, {
          field,
          action: "drop",
          reason: "Reviewer flagged it; rules had already removed the value.",
        });
        dropped.push(field);
        continue;
      }
      if (textAppearsInSource(source, value)) {
        pushDecision(decisions, {
          field,
          action: "keep",
          reason: "Reviewer flagged it, but the value appears in the resume source.",
        });
        kept.push(field);
      } else {
        next[field] = "";
        pushDecision(decisions, {
          field,
          action: "drop",
          reason: "Reviewer flagged it and the value is not clearly in the resume.",
        });
        dropped.push(field);
        if (!next.questions.some((item) => normalize(item).includes(field))) {
          pushUniqueQuestion(next.questions, `Confirm your ${field} — the reviewer could not verify it from the resume.`);
        }
      }
      continue;
    }

    // Skills: drop unverified tokens reviewers rejected.
    let skillHit = false;
    next.skills = next.skills.filter((skill) => {
      const match =
        tokens.some((token) => normalize(skill) === normalize(token) || normalize(skill).includes(normalize(token))) ||
        normalize(skill) === field ||
        field.includes(normalize(skill));
      if (!match) return true;
      skillHit = true;
      if (textAppearsInSource(source, skill)) {
        pushDecision(decisions, {
          field: `skill:${skill}`,
          action: "keep",
          reason: "Skill appears in the resume despite reviewer flag.",
        });
        kept.push(`skill:${skill}`);
        return true;
      }
      pushDecision(decisions, {
        field: `skill:${skill}`,
        action: "drop",
        reason: "Skill was not found in the resume source.",
      });
      dropped.push(`skill:${skill}`);
      return false;
    });
    if (skillHit) continue;

    const empPath = String(label).match(/^employment\s*[\[.]?\s*(\d+)\s*[\].]?\s*[.\[]?\s*([a-zA-Z_][\w]*)?/i);
    if (empPath) {
      const index = Number(empPath[1]);
      const pathField = String(empPath[2] || "").toLowerCase();
      const job = next.employment[index];
      pushDecision(decisions, {
        field: label,
        action: "confirm",
        reason: "Reviewer flagged an employment detail for candidate confirmation.",
      });
      confirmed.push(label);
      if (pathField === "dates" || pathField === "date") {
        if (Number.isFinite(index) && !employmentDateJobs.includes(index)) employmentDateJobs.push(index);
      } else {
        pushUniqueQuestion(next.questions, humanizeClaimLabel(label, next.employment));
      }
      next.facts = next.facts.map((fact) => {
        const statement = normalize(fact.statement);
        const title = normalize(job?.title || "");
        const employer = normalize(job?.employer || "");
        if ((title && statement.includes(title)) || (employer && statement.includes(employer))) {
          return { ...fact, confidence: Math.min(Number(fact.confidence || 1), 0.4), verified_by_user: false };
        }
        if (!tokens.some((token) => statement.includes(normalize(token))) && !statement.includes(field)) {
          return fact;
        }
        return { ...fact, confidence: Math.min(Number(fact.confidence || 1), 0.4), verified_by_user: false };
      });
      continue;
    }

    // Employers / titles in employment.
    let employmentHit = false;
    next.employment = next.employment
      .map((job) => {
        const employer = String(job.employer || "");
        const title = String(job.title || "");
        const employerFlagged =
          tokens.some((token) => normalize(employer).includes(normalize(token))) ||
          field.includes(normalize(employer)) ||
          normalize(employer).includes(field);
        const titleFlagged =
          tokens.some((token) => normalize(title).includes(normalize(token))) ||
          field.includes(normalize(title));
        if (!employerFlagged && !titleFlagged) return job;
        employmentHit = true;
        let nextJob = { ...job };
        if (employerFlagged) {
          if (textAppearsInSource(source, employer)) {
            pushDecision(decisions, {
              field: `employer:${employer}`,
              action: "keep",
              reason: "Employer appears in the resume source.",
            });
            kept.push(`employer:${employer}`);
          } else {
            pushDecision(decisions, {
              field: `employer:${employer}`,
              action: "drop",
              reason: "Employer not found in the resume source.",
            });
            dropped.push(`employer:${employer}`);
            nextJob = { ...nextJob, employer: "" };
          }
        }
        if (titleFlagged && !textAppearsInSource(source, title)) {
          pushDecision(decisions, {
            field: `title:${title}`,
            action: "confirm",
            reason: "Title disputed; asking the candidate to confirm.",
          });
          confirmed.push(`title:${title}`);
          pushUniqueQuestion(next.questions, `Confirm the role title “${title}” — it was flagged in second review.`);
        } else if (titleFlagged) {
          pushDecision(decisions, {
            field: `title:${title}`,
            action: "keep",
            reason: "Title appears in the resume source.",
          });
          kept.push(`title:${title}`);
        }
        return nextJob;
      })
      .filter((job) => job.title || job.employer || (job.bullets || []).length);
    if (employmentHit) continue;

    // Generic claim → ask confirmation with a human-readable question.
    pushDecision(decisions, {
      field: label,
      action: "confirm",
      reason: "Could not auto-map the reviewer flag; candidate confirmation required.",
    });
    confirmed.push(label);
    const question = humanizeClaimLabel(label, next.employment);
    if (/Confirm a resume detail/i.test(question)) {
      genericPathConfirms += 1;
    } else {
      pushUniqueQuestion(next.questions, question);
    }
    next.facts = next.facts.map((fact) => {
      const statement = normalize(fact.statement);
      if (!tokens.some((token) => statement.includes(normalize(token))) && !statement.includes(field)) {
        return fact;
      }
      return {
        ...fact,
        confidence: Math.min(Number(fact.confidence || 1), 0.4),
        verified_by_user: false,
      };
    });
  }

  if (employmentDateJobs.length === 1) {
    const index = employmentDateJobs[0];
    pushUniqueQuestion(next.questions, humanizeClaimLabel(`employment[${index}].dates`, next.employment));
  } else if (employmentDateJobs.length > 1) {
    pushUniqueQuestion(
      next.questions,
      "Confirm the employment dates for each role we extracted — some date ranges looked unclear in second review.",
    );
  }
  if (genericPathConfirms > 0) {
    pushUniqueQuestion(
      next.questions,
      "Confirm any experience dates or details that look incomplete before activating your account.",
    );
  }

  // Rebuild fact statements for dropped skills/employers loosely by filtering orphans.
  const skillSet = new Set(next.skills.map((skill) => normalize(skill)));
  next.facts = next.facts.filter((fact) => {
    if (fact.category === "skill") return skillSet.has(normalize(fact.statement));
    return true;
  });

  for (const note of notes.slice(0, 4)) {
    if (/[\[\].]/.test(note) || /^[a-z_]+\.\d+/i.test(note)) {
      pushUniqueQuestion(next.questions, humanizeClaimLabel(note, next.employment));
    } else {
      pushUniqueQuestion(next.questions, note);
    }
  }

  if (reviewerStatus === "fail" && !unsupported.length) {
    pushDecision(decisions, {
      field: "*",
      action: "confirm",
      reason: "Reviewer failed without field list; keep rules profile and ask for confirmation.",
    });
    confirmed.push("*");
    if (!next.warnings.some((item) => /second review/i.test(item))) {
      next.warnings.push("A second review asked for confirmation before trusting every extracted detail.");
    }
  }

  const status =
    dropped.length && !kept.length && !confirmed.length
      ? "dropped"
      : confirmed.length
        ? "confirm"
        : kept.length && dropped.length
          ? "partial"
          : kept.length
            ? "kept"
            : "confirm";

  if (dropped.length) {
    next.warnings.push("Disagreement reconciliation removed claims the resume does not support.");
  }

  next.review = {
    ...(next.review || {}),
    status: dropped.length || confirmed.length || !next.name || !next.email ? "adjusted" : next.review?.status || "pass",
    unsupported: [...new Set([...(next.review?.unsupported || []), ...unsupported])],
    reconciliation: {
      status,
      decisions,
      dropped,
      kept,
      confirmed,
    },
  };

  return {
    profile: next,
    decisions,
    status,
    dropped,
    kept,
    confirmed,
  };
}
