/** Employer job postings and outbound invite routes. */

import { db, id } from "./db.mjs";
import { extractRequirements } from "./match.mjs";
import {
  INVITE_STATUSES,
  POSTING_STATUSES,
  canChangeInviteStatus,
  canChangePostingStatus,
  inviteMessageDefault,
  normalizeInviteStatus,
  normalizePostingInput,
  normalizePostingStatus,
  publicPosting,
  scoreCandidateForPosting,
  summarizeInvites,
  summarizePostings,
  validatePosting,
} from "./employer-postings.mjs";

function parse(value, fallback) {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function employerSource() {
  let source = db.prepare("SELECT * FROM job_sources WHERE kind = 'employer' LIMIT 1").get();
  if (!source) {
    const sourceId = id("src");
    db.prepare(
      "INSERT INTO job_sources (id, name, kind, config, enabled, created_at) VALUES (?, 'Employer postings', 'employer', '{}', 1, ?)",
    ).run(sourceId, Date.now());
    source = db.prepare("SELECT * FROM job_sources WHERE id = ?").get(sourceId);
  }
  return source;
}

function syncPostingToCatalog(posting) {
  const source = employerSource();
  const skills = parse(posting.skills, []);
  const requirements = parse(posting.requirements, {})?.mandatory
    ? parse(posting.requirements, {})
    : extractRequirements({
        title: posting.title,
        description: posting.description,
        skills,
        role: posting.role,
        category: posting.category,
      });
  const key = `employer:${posting.id}`;
  const existing = posting.job_id
    ? db.prepare("SELECT * FROM jobs WHERE id = ?").get(posting.job_id)
    : db.prepare("SELECT * FROM jobs WHERE source_id = ? AND external_key = ?").get(source.id, key);
  const active = normalizePostingStatus(posting.status) === "open" ? 1 : 0;
  if (existing) {
    db.prepare(
      `UPDATE jobs SET title = ?, company = ?, location = ?, remote_type = ?, employment_type = ?, salary_min = ?, salary_max = ?,
        description = ?, skills = ?, requirements = ?, category = ?, role = ?, source_url = ?, primary_company = ?, primary_url = ?,
        verification = ?, verification_note = ?, active = ? WHERE id = ?`,
    ).run(
      posting.title,
      posting.company,
      posting.location || "",
      posting.remote_type || "",
      posting.employment_type || "full-time",
      posting.salary_min,
      posting.salary_max,
      posting.description || "",
      JSON.stringify(skills),
      JSON.stringify(requirements),
      posting.category || "",
      posting.role || "",
      posting.apply_url || "",
      posting.company,
      posting.apply_url || "",
      "Employer posted",
      "Posted by an employer account on JobPilot.",
      active,
      existing.id,
    );
    return existing.id;
  }
  const jobId = id("job");
  db.prepare(
    `INSERT INTO jobs (id, source_id, external_key, title, company, location, remote_type, employment_type, salary_min, salary_max,
      description, skills, requirements, category, role, source_url, verification, verification_note, primary_company, primary_url, primary_email, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Employer posted', 'Posted by an employer account on JobPilot.', ?, ?, '', ?, ?)`,
  ).run(
    jobId,
    source.id,
    key,
    posting.title,
    posting.company,
    posting.location || "",
    posting.remote_type || "",
    posting.employment_type || "full-time",
    posting.salary_min,
    posting.salary_max,
    posting.description || "",
    JSON.stringify(skills),
    JSON.stringify(requirements),
    posting.category || "",
    posting.role || "",
    posting.apply_url || "",
    posting.company,
    posting.apply_url || "",
    active,
    Date.now(),
  );
  return jobId;
}

function loadPublicCandidate(candidateUserId) {
  const row = db
    .prepare(
      `SELECT profiles.user_id, profiles.slug, profiles.headline, profiles.summary, profiles.skills, profiles.preferences,
              users.name, users.email, users.phone, users.city, users.status, users.role, plans.features AS plan_features
       FROM profiles
       JOIN users ON users.id = profiles.user_id
       LEFT JOIN plans ON plans.id = COALESCE(users.plan_id, 'free')
       WHERE profiles.user_id = ?`,
    )
    .get(candidateUserId);
  if (!row || row.role !== "user" || row.status !== "active" || !row.slug) return null;
  const features = parse(row.plan_features, {});
  if (features.public_profile === false) return null;
  const preferences = parse(row.preferences, {});
  const skills = parse(row.skills, []);
  return {
    userId: row.user_id,
    name: row.name || "",
    headline: row.headline || "",
    summary: String(row.summary || "").slice(0, 280),
    skills: (Array.isArray(skills) ? skills : []).map(String).slice(0, 12),
    city: row.city || "",
    slug: row.slug,
    resumeUrl: `/resume/${row.slug}`,
    email: preferences.shareContact === false ? "" : String(row.email || ""),
    phone: preferences.shareContact === false ? "" : String(row.phone || ""),
  };
}

function publicInvite(row, { includeCandidate = true, includePosting = true } = {}) {
  const posting = includePosting ? publicPosting(db.prepare("SELECT * FROM employer_postings WHERE id = ?").get(row.posting_id)) : null;
  const candidate = includeCandidate ? loadPublicCandidate(row.candidate_user_id) : null;
  return {
    id: row.id,
    postingId: row.posting_id,
    candidateUserId: row.candidate_user_id,
    pipelineId: row.pipeline_id || "",
    message: row.message || "",
    status: normalizeInviteStatus(row.status),
    overlap: parse(row.overlap, { score: 0, matched: [], missing: [] }),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    posting,
    candidate,
  };
}

export function registerEmployerPostings(app, ctx) {
  const { requireUser, requireFeature } = ctx;

  function requireEmployer(req, res) {
    const user = requireUser(req, res);
    if (!user) return null;
    if (user.role !== "employer") {
      res.status(403).json({ error: "Employer access required." });
      return null;
    }
    return user;
  }

  function allowCandidate(req, res) {
    const user = requireUser(req, res);
    if (!user) return null;
    if (user.role === "employer") {
      res.status(403).json({ error: "Candidate access required." });
      return null;
    }
    if (requireFeature && !requireFeature(user, "job_browse", res)) return null;
    return user;
  }

  app.get("/api/employer/postings", (req, res) => {
    const user = requireEmployer(req, res);
    if (!user) return;
    const rows = db
      .prepare("SELECT * FROM employer_postings WHERE employer_user_id = ? ORDER BY updated_at DESC")
      .all(user.id);
    res.json({
      postings: rows.map(publicPosting),
      summary: summarizePostings(rows),
      statuses: POSTING_STATUSES,
    });
  });

  app.post("/api/employer/postings", (req, res) => {
    const user = requireEmployer(req, res);
    if (!user) return;
    const company = db.prepare("SELECT company_name FROM employer_profiles WHERE user_id = ?").get(user.id)?.company_name || "";
    const input = normalizePostingInput(req.body, company);
    const error = validatePosting(input);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    const requirements = extractRequirements({
      title: input.title,
      description: input.description,
      skills: input.skills,
      role: input.role,
      category: input.category,
    });
    const now = Date.now();
    const postingId = id("post");
    db.prepare(
      `INSERT INTO employer_postings
        (id, employer_user_id, title, company, location, remote_type, employment_type, salary_min, salary_max,
         description, skills, requirements, category, role, apply_url, status, job_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?)`,
    ).run(
      postingId,
      user.id,
      input.title,
      input.company,
      input.location,
      input.remoteType,
      input.employmentType,
      input.salaryMin,
      input.salaryMax,
      input.description,
      JSON.stringify(input.skills),
      JSON.stringify(requirements),
      input.category,
      input.role,
      input.applyUrl,
      input.status,
      now,
      now,
    );
    let row = db.prepare("SELECT * FROM employer_postings WHERE id = ?").get(postingId);
    if (normalizePostingStatus(row.status) === "open") {
      const jobId = syncPostingToCatalog(row);
      db.prepare("UPDATE employer_postings SET job_id = ?, updated_at = ? WHERE id = ?").run(jobId, Date.now(), postingId);
      row = db.prepare("SELECT * FROM employer_postings WHERE id = ?").get(postingId);
    }
    res.json({ posting: publicPosting(row) });
  });

  app.put("/api/employer/postings/:id", (req, res) => {
    const user = requireEmployer(req, res);
    if (!user) return;
    const current = db
      .prepare("SELECT * FROM employer_postings WHERE id = ? AND employer_user_id = ?")
      .get(req.params.id, user.id);
    if (!current) {
      res.status(404).json({ error: "Posting not found." });
      return;
    }
    const input = normalizePostingInput(
      { ...publicPosting(current), ...req.body, skills: req.body.skills ?? parse(current.skills, []) },
      current.company,
    );
    if (!canChangePostingStatus(current.status, input.status)) {
      res.status(400).json({ error: `Cannot move posting from ${current.status} to ${input.status}.` });
      return;
    }
    const error = validatePosting(input);
    if (error) {
      res.status(400).json({ error });
      return;
    }
    const requirements = extractRequirements({
      title: input.title,
      description: input.description,
      skills: input.skills,
      role: input.role,
      category: input.category,
    });
    db.prepare(
      `UPDATE employer_postings SET title = ?, company = ?, location = ?, remote_type = ?, employment_type = ?, salary_min = ?, salary_max = ?,
        description = ?, skills = ?, requirements = ?, category = ?, role = ?, apply_url = ?, status = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      input.title,
      input.company,
      input.location,
      input.remoteType,
      input.employmentType,
      input.salaryMin,
      input.salaryMax,
      input.description,
      JSON.stringify(input.skills),
      JSON.stringify(requirements),
      input.category,
      input.role,
      input.applyUrl,
      input.status,
      Date.now(),
      current.id,
    );
    let row = db.prepare("SELECT * FROM employer_postings WHERE id = ?").get(current.id);
    if (["open", "closed", "draft"].includes(normalizePostingStatus(row.status))) {
      const jobId = syncPostingToCatalog(row);
      if (jobId !== row.job_id) {
        db.prepare("UPDATE employer_postings SET job_id = ?, updated_at = ? WHERE id = ?").run(jobId, Date.now(), row.id);
        row = db.prepare("SELECT * FROM employer_postings WHERE id = ?").get(row.id);
      }
    }
    res.json({ posting: publicPosting(row) });
  });

  app.get("/api/employer/invites", (req, res) => {
    const user = requireEmployer(req, res);
    if (!user) return;
    const rows = db
      .prepare("SELECT * FROM employer_invites WHERE employer_user_id = ? ORDER BY updated_at DESC LIMIT 100")
      .all(user.id);
    res.json({
      invites: rows.map((row) => publicInvite(row)),
      summary: summarizeInvites(rows),
      statuses: INVITE_STATUSES,
    });
  });

  app.post("/api/employer/invites", (req, res) => {
    const user = requireEmployer(req, res);
    if (!user) return;
    const postingId = String(req.body.postingId || "").trim();
    const candidateUserId = String(req.body.candidateUserId || "").trim();
    const posting = db
      .prepare("SELECT * FROM employer_postings WHERE id = ? AND employer_user_id = ?")
      .get(postingId, user.id);
    if (!posting) {
      res.status(404).json({ error: "Posting not found." });
      return;
    }
    if (normalizePostingStatus(posting.status) !== "open") {
      res.status(400).json({ error: "Invites can only be sent for open postings." });
      return;
    }
    const candidate = loadPublicCandidate(candidateUserId);
    if (!candidate) {
      res.status(400).json({ error: "Only public candidates can be invited." });
      return;
    }
    const existing = db
      .prepare("SELECT id FROM employer_invites WHERE posting_id = ? AND candidate_user_id = ?")
      .get(postingId, candidateUserId);
    if (existing) {
      res.json({ invite: publicInvite(db.prepare("SELECT * FROM employer_invites WHERE id = ?").get(existing.id)), created: false });
      return;
    }
    const overlap = scoreCandidateForPosting(candidate, publicPosting(posting));
    const pipelineId = String(req.body.pipelineId || "").trim();
    const pipeline = pipelineId
      ? db.prepare("SELECT id FROM employer_pipeline WHERE id = ? AND employer_user_id = ?").get(pipelineId, user.id)
      : db
          .prepare("SELECT id FROM employer_pipeline WHERE employer_user_id = ? AND candidate_user_id = ?")
          .get(user.id, candidateUserId);
    const message =
      String(req.body.message || "").trim().slice(0, 1000) ||
      inviteMessageDefault({ posting: publicPosting(posting), employerName: user.name });
    const now = Date.now();
    const inviteId = id("inv");
    db.prepare(
      `INSERT INTO employer_invites
        (id, employer_user_id, posting_id, candidate_user_id, pipeline_id, message, status, overlap, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    ).run(inviteId, user.id, postingId, candidateUserId, pipeline?.id || "", message, JSON.stringify(overlap), now, now);
    if (pipeline?.id) {
      const current = db.prepare("SELECT status FROM employer_pipeline WHERE id = ?").get(pipeline.id);
      if (current && !["Interviewing", "Offer", "Hired", "Passed"].includes(current.status)) {
        db.prepare("UPDATE employer_pipeline SET status = 'Reviewing', updated_at = ? WHERE id = ?").run(now, pipeline.id);
      }
    }
    res.json({ invite: publicInvite(db.prepare("SELECT * FROM employer_invites WHERE id = ?").get(inviteId)), created: true });
  });

  app.get("/api/invites", (req, res) => {
    const user = allowCandidate(req, res);
    if (!user) return;
    const rows = db
      .prepare("SELECT * FROM employer_invites WHERE candidate_user_id = ? ORDER BY updated_at DESC LIMIT 50")
      .all(user.id);
    res.json({
      invites: rows.map((row) => publicInvite(row, { includeCandidate: false })),
      summary: summarizeInvites(rows),
    });
  });

  app.post("/api/invites/:id/respond", (req, res) => {
    const user = allowCandidate(req, res);
    if (!user) return;
    const row = db
      .prepare("SELECT * FROM employer_invites WHERE id = ? AND candidate_user_id = ?")
      .get(req.params.id, user.id);
    if (!row) {
      res.status(404).json({ error: "Invite not found." });
      return;
    }
    const next = normalizeInviteStatus(req.body.status, "");
    if (!["viewed", "accepted", "declined"].includes(next)) {
      res.status(400).json({ error: "Respond with viewed, accepted, or declined." });
      return;
    }
    if (!canChangeInviteStatus(row.status, next)) {
      res.status(400).json({ error: `Cannot move invite from ${row.status} to ${next}.` });
      return;
    }
    db.prepare("UPDATE employer_invites SET status = ?, updated_at = ? WHERE id = ?").run(next, Date.now(), row.id);
    const updated = db.prepare("SELECT * FROM employer_invites WHERE id = ?").get(row.id);
    let applicationId = "";
    if (next === "accepted") {
      const posting = db.prepare("SELECT * FROM employer_postings WHERE id = ?").get(updated.posting_id);
      if (posting?.job_id) {
        const existingApp = db
          .prepare("SELECT id FROM applications WHERE user_id = ? AND job_id = ?")
          .get(user.id, posting.job_id);
        if (existingApp) {
          applicationId = existingApp.id;
        } else {
          applicationId = id("app");
          const now = Date.now();
          db.prepare(
            `INSERT INTO applications (id, user_id, job_id, version_id, mode, status, match_score, target_company, target_url, target_email, delivery, questions, created_at, updated_at)
             VALUES (?, ?, ?, '', 'invite', 'Found', ?, ?, ?, '', 'invite', '[]', ?, ?)`,
          ).run(
            applicationId,
            user.id,
            posting.job_id,
            Number(parse(updated.overlap, {}).score) || 0,
            posting.company || "",
            posting.apply_url || "",
            now,
            now,
          );
        }
      }
    }
    res.json({
      invite: publicInvite(updated, { includeCandidate: false }),
      applicationId,
    });
  });
}
