/** Persist a confirmed skill onto the profile, active resume, and prepared resumes. */

import { db } from "./db.mjs";
import { preparedResumesAfterConfirm } from "./confirm-skill.mjs";

export function storeConfirmedSkill({ userId, result, preferences = {}, versionId, renderDocument }) {
  if (result?.already) return { prepared: 0, jobIds: [] };
  db.prepare(
    "UPDATE profiles SET summary = ?, skills = ?, employment = ?, facts = ?, updated_at = ? WHERE user_id = ?",
  ).run(
    result.profile.summary || "",
    JSON.stringify(result.profile.skills || []),
    JSON.stringify(result.profile.employment || []),
    JSON.stringify(result.facts || []),
    Date.now(),
    userId,
  );
  db.prepare("UPDATE resume_versions SET document = ?, rendered = ? WHERE id = ?").run(
    JSON.stringify(result.document),
    renderDocument(result.document),
    versionId,
  );
  const rows = db.prepare(
    `SELECT a.job_id AS jobId, a.version_id AS versionId
     FROM applications a
     JOIN resume_versions v ON v.id = a.version_id AND v.user_id = a.user_id
     WHERE a.user_id = ? AND v.kind = 'application' AND a.version_id != ?`,
  ).all(userId, versionId);
  const targets = [];
  for (const row of rows) {
    const target = db.prepare("SELECT * FROM jobs WHERE id = ?").get(row.jobId);
    if (target) targets.push({ versionId: row.versionId, job: target });
  }
  const preparedDocs = preparedResumesAfterConfirm({
    document: result.document,
    jobs: targets.map((item) => item.job),
    facts: result.facts,
    preferences,
  });
  preparedDocs.forEach((item, index) => {
    db.prepare("UPDATE resume_versions SET document = ?, rendered = ?, parent_id = ? WHERE id = ?").run(
      JSON.stringify(item.document),
      renderDocument(item.document),
      versionId,
      targets[index].versionId,
    );
  });
  return { prepared: preparedDocs.length, jobIds: preparedDocs.map((item) => item.jobId) };
}
