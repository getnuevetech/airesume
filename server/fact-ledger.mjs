/** Shared Fact Ledger rebuild and provenance helpers. */

export function padFactId(prefix, index) {
  return `${prefix}-${String(index + 1).padStart(3, "0")}`;
}

export function normalizeFact(fact, defaults = {}) {
  const statement = String(fact?.statement || "").replace(/\s+/g, " ").trim();
  if (!statement) return null;
  const confidence = Number(fact?.confidence);
  return {
    fact_id: String(fact?.fact_id || defaults.fact_id || ""),
    category: String(fact?.category || defaults.category || "general"),
    statement,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : Number(defaults.confidence ?? 0.8),
    source: String(fact?.source || defaults.source || "profile"),
    verified_by_user: Boolean(fact?.verified_by_user ?? defaults.verified_by_user ?? false),
    source_fact_ids: Array.isArray(fact?.source_fact_ids)
      ? fact.source_fact_ids.map(String).filter(Boolean)
      : [String(fact?.fact_id || defaults.fact_id || "")].filter(Boolean),
  };
}

/**
 * Rebuild ledger from profile fields. Preserves confidence from prior facts when the statement matches.
 */
export function rebuildFactsFromProfile(profile, priorFacts = []) {
  const prior = new Map();
  for (const item of priorFacts || []) {
    const key = String(item?.statement || "")
      .toLowerCase()
      .trim();
    if (key) prior.set(key, item);
  }

  function next(factId, category, statement, defaultConfidence, source = "profile") {
    const previous = prior.get(String(statement).toLowerCase());
    return normalizeFact(
      {
        fact_id: factId,
        category,
        statement,
        confidence: previous?.confidence ?? defaultConfidence,
        source: previous?.source || source,
        verified_by_user: true,
        source_fact_ids: [factId],
      },
      { confidence: defaultConfidence },
    );
  }

  const facts = [];
  if (profile.name) facts.push(next("ID-001", "identity", `Name: ${profile.name}`, 1));
  if (profile.email) facts.push(next("ID-002", "identity", `Email: ${profile.email}`, 1));
  if (profile.phone) facts.push(next("ID-003", "identity", `Phone: ${profile.phone}`, 1));
  if (profile.city) facts.push(next("ID-004", "identity", `Location: ${profile.city}`, 1));
  else if (profile.address) facts.push(next("ID-004", "identity", `Address: ${profile.address}`, 1));

  (profile.employment || []).forEach((job, index) => {
    const statement = `${job.title || "Role"}${job.employer ? ` at ${job.employer}` : ""}${job.dates ? ` (${job.dates})` : ""}`;
    facts.push(next(padFactId("EXP", index), "employment", statement, 1));
  });

  (profile.skills || []).forEach((skill, index) => {
    const text = String(skill || "").trim();
    if (!text) return;
    const factId = padFactId("SKILL", index);
    facts.push(
      normalizeFact(
        {
          fact_id: factId,
          category: "skill",
          statement: text,
          confidence: prior.get(text.toLowerCase())?.confidence ?? 1,
          source: prior.get(text.toLowerCase())?.source || "profile",
          verified_by_user: true,
          source_fact_ids: [factId],
        },
        { confidence: 1 },
      ),
    );
  });

  return facts.filter(Boolean);
}

export function skillFactsIndex(facts = []) {
  const map = new Map();
  for (const fact of facts || []) {
    if (!fact) continue;
    const isSkill = fact.category === "skill" || /^SKILL-/i.test(String(fact.fact_id || ""));
    if (!isSkill) continue;
    map.set(String(fact.statement || "").toLowerCase(), fact);
  }
  return map;
}

/** Skills eligible for matching — drop low-confidence unverified inferences. */
export function skillsForMatching(skills = [], facts = []) {
  const index = skillFactsIndex(facts);
  return (skills || []).filter((skill) => {
    const fact = index.get(String(skill).toLowerCase());
    if (!fact) return true;
    if (fact.verified_by_user) return true;
    return Number(fact.confidence || 0) >= 0.5;
  });
}

export function citeSkillFact(skill, facts = []) {
  const fact = skillFactsIndex(facts).get(String(skill).toLowerCase());
  if (!fact) {
    return {
      skill,
      fact_ids: [],
      confidence: null,
      verified: true,
    };
  }
  return {
    skill,
    fact_ids: fact.source_fact_ids?.length ? fact.source_fact_ids : [fact.fact_id].filter(Boolean),
    confidence: Number(fact.confidence),
    verified: Boolean(fact.verified_by_user) || Number(fact.confidence || 0) >= 0.5,
  };
}
