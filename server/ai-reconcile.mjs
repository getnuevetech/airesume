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

  const unsupported = Array.isArray(reviewer?.unsupported) ? reviewer.unsupported.map(String).filter(Boolean) : [];
  const reviewerStatus = String(reviewer?.status || "").toLowerCase();
  const notes = Array.isArray(reviewer?.notes) ? reviewer.notes.map(String).filter(Boolean) : [];

  if (!unsupported.length && reviewerStatus !== "fail") {
    return {
      profile: next,
      decisions: [
        {
          field: "*",
          action: "agree",
          reason: "Producer and reviewer agree; rules profile unchanged.",
        },
      ],
      status: "agree",
      dropped: [],
      confirmed: [],
      kept: [],
    };
  }

  const dropped = [];
  const confirmed = [];
  const kept = [];

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
          next.questions.push(`Confirm your ${field} — the reviewer could not verify it from the resume.`);
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
          next.questions.push(`Confirm the role title “${title}” — it was flagged in second review.`);
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

    // Generic claim → ask confirmation, lower related fact confidence.
    pushDecision(decisions, {
      field: label,
      action: "confirm",
      reason: "Could not auto-map the reviewer flag; candidate confirmation required.",
    });
    confirmed.push(label);
    next.questions.push(`Please confirm: ${label}`);
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

  // Rebuild fact statements for dropped skills/employers loosely by filtering orphans.
  const skillSet = new Set(next.skills.map((skill) => normalize(skill)));
  next.facts = next.facts.filter((fact) => {
    if (fact.category === "skill") return skillSet.has(normalize(fact.statement));
    return true;
  });

  for (const note of notes.slice(0, 4)) {
    if (!next.questions.includes(note)) next.questions.push(note);
  }

  const status = dropped.length && !kept.length && !confirmed.length ? "dropped" : confirmed.length ? "confirm" : kept.length && dropped.length ? "partial" : kept.length ? "kept" : "confirm";

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
