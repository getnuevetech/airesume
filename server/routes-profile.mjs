/** Profile edit, photo, template, and public resume routes. */

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, extname } from "node:path";
import { db, id, uploadsDir } from "./db.mjs";
import { completeJson } from "./ai-run.mjs";
import { RESUME_TEMPLATES, resolveTemplate, templateLimitOf } from "./schema.mjs";

function clamp(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(1.35, Math.max(1, number));
}

export function registerProfile(app, ctx) {
  const {
    requireUser,
    requireFeature,
    featuresOf,
    parse,
    slugify,
    activeVersion,
    renderDocument,
    documentFromProfile,
    audit,
    upload,
  } = ctx;

  app.put("/api/account/template", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const access = featuresOf(user);
    const limit = templateLimitOf(access.features);
    const templateId = String(req.body.template || "");
    const index = RESUME_TEMPLATES.findIndex((item) => item.id === templateId);
    if (index < 0) {
      res.status(400).json({ error: "Choose one of the resume templates." });
      return;
    }
    if (index >= limit) {
      res.status(403).json({ error: `The ${access.plan.name} plan includes ${limit} template${limit === 1 ? "" : "s"}.` });
      return;
    }
    db.prepare("UPDATE profiles SET template = ?, updated_at = ? WHERE user_id = ?").run(templateId, Date.now(), user.id);
    res.json({ template: templateId });
  });

  app.put("/api/profile", (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const access = requireFeature(user, "profile_edit", res);
    if (!access) return;
    const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(user.id);
    if (!profile) {
      res.status(400).json({ error: "Upload a resume before editing a profile." });
      return;
    }
    const name = String(req.body.name || user.name).trim();
    const phone = String(req.body.phone || "").trim();
    const address = String(req.body.address || "").trim();
    const city = String(req.body.city || "").trim();
    const headline = String(req.body.headline || "").trim();
    const summary = String(req.body.summary || "").trim();
    const skills = Array.isArray(req.body.skills) ? req.body.skills.map((skill) => String(skill).trim()).filter(Boolean).slice(0, 24) : [];
    const employment = Array.isArray(req.body.employment) ? req.body.employment.slice(0, 12) : [];
    const education = Array.isArray(req.body.education) ? req.body.education.map(String).filter(Boolean).slice(0, 8) : [];
    let slug = String(req.body.slug || profile.slug || "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
    if (!slug) slug = slugify(name, user.id);
    const clash = db.prepare("SELECT user_id FROM profiles WHERE slug = ? AND user_id != ?").get(slug, user.id);
    if (clash) {
      res.status(409).json({ error: "That public link is already in use." });
      return;
    }
    const preferences = {
      ...parse(profile.preferences, {}),
      salary: String(req.body.salary || ""),
      workArrangement: String(req.body.workArrangement || ""),
      locations: String(req.body.locations || ""),
      workAuthorization: String(req.body.workAuthorization || ""),
      shareContact: Boolean(req.body.shareContact),
    };
    const facts = [
      { fact_id: "ID-001", statement: `Name: ${name}`, verified_by_user: true },
      phone ? { fact_id: "ID-003", statement: `Phone: ${phone}`, verified_by_user: true } : null,
      city ? { fact_id: "ID-004", statement: `Location: ${city}`, verified_by_user: true } : null,
      ...employment.map((job, index) => ({ fact_id: `EXP-${index + 1}`, statement: `${job.title || "Role"}${job.employer ? ` at ${job.employer}` : ""}`, verified_by_user: true })),
      ...skills.map((skill, index) => ({ fact_id: `SKILL-${index + 1}`, statement: skill, verified_by_user: true })),
    ].filter(Boolean);
    db.prepare("UPDATE users SET name = ?, phone = ?, address = ?, city = ? WHERE id = ?").run(name, phone, address, city, user.id);
    db.prepare(
      "UPDATE profiles SET headline = ?, summary = ?, skills = ?, employment = ?, education = ?, facts = ?, preferences = ?, slug = ?, updated_at = ? WHERE user_id = ?",
    ).run(headline, summary, JSON.stringify(skills), JSON.stringify(employment), JSON.stringify(education), JSON.stringify(facts), JSON.stringify(preferences), slug, Date.now(), user.id);
    const document = { headline, summary, skills, employment, education };
    const current = activeVersion(user.id);
    if (current) {
      db.prepare("UPDATE resume_versions SET document = ?, rendered = ? WHERE id = ?").run(JSON.stringify(document), renderDocument(document), current.id);
    }
    res.json({ ok: true, slug });
  });

  app.post("/api/profile/photo", upload.single("photo"), (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    if (!req.file) {
      res.status(400).json({ error: "Choose an image." });
      return;
    }
    const extension = extname(req.file.originalname || "").toLowerCase();
    if (![".png", ".jpg", ".jpeg", ".webp"].includes(extension)) {
      res.status(400).json({ error: "Use a PNG, JPG, or WEBP photo." });
      return;
    }
    const name = `${id("photo")}${extension}`;
    writeFileSync(join(uploadsDir, name), req.file.buffer);
    db.prepare("UPDATE profiles SET photo_url = ?, updated_at = ? WHERE user_id = ?").run(`/uploads/${name}`, Date.now(), user.id);
    res.json({ photoUrl: `/uploads/${name}` });
  });

  app.post("/api/profile/photo/enhance", async (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    if (!requireFeature(user, "image_enhance", res)) return;
    const profile = db.prepare("SELECT * FROM profiles WHERE user_id = ?").get(user.id);
    if (!profile?.photo_url) {
      res.status(400).json({ error: "Upload a photo first." });
      return;
    }
    const ai = await completeJson(
      "image_enhance",
      "Return JSON {contrast, color, sharpness} as numbers from 1 to 1.35. These tune the existing photo. Do not describe a different person.",
      "Tune this resume headshot.",
    );
    const contrast = clamp(ai.json?.contrast, 1.08);
    const color = clamp(ai.json?.color, 1.05);
    const sharpness = clamp(ai.json?.sharpness, 1.25);
    const source = join(uploadsDir, profile.photo_url.replace(/^\/uploads\//, ""));
    const nextName = `${id("photo")}.jpg`;
    const dest = join(uploadsDir, nextName);
    try {
      const dir = mkdtempSync(join(tmpdir(), "photo-"));
      const script = join(dir, "enhance.py");
      writeFileSync(
        script,
        `from PIL import Image, ImageEnhance\nim = Image.open(${JSON.stringify(source)}).convert("RGB")\nim = ImageEnhance.Contrast(im).enhance(${contrast})\nim = ImageEnhance.Color(im).enhance(${color})\nim = ImageEnhance.Sharpness(im).enhance(${sharpness})\nim.save(${JSON.stringify(dest)}, quality=92)\n`,
      );
      execFileSync("python3", [script], { timeout: 20000 });
    } catch {
      res.status(500).json({ error: "The photo could not be enhanced." });
      return;
    }
    db.prepare("UPDATE profiles SET photo_url = ?, updated_at = ? WHERE user_id = ?").run(`/uploads/${nextName}`, Date.now(), user.id);
    audit({
      userId: user.id,
      functionName: "image_enhance",
      provider: ai.provider,
      model: ai.model,
      status: "applied",
      detail: `${contrast},${color},${sharpness}`,
      costMicros: ai.costMicros || 0,
    });
    res.json({ photoUrl: `/uploads/${nextName}`, provider: ai.provider, model: ai.model });
  });

  app.get("/api/public/resume/:slug", (req, res) => {
    const profile = db.prepare("SELECT * FROM profiles WHERE slug = ?").get(req.params.slug);
    if (!profile) {
      res.status(404).json({ error: "This resume link is not public." });
      return;
    }
    const user = db.prepare("SELECT * FROM users WHERE id = ? AND status = 'active'").get(profile.user_id);
    if (!user || !featuresOf(user).features.public_profile) {
      res.status(404).json({ error: "This resume link is not public." });
      return;
    }
    const version = activeVersion(user.id);
    const doc = version ? parse(version.document, {}) : documentFromProfile(profile);
    const preferences = parse(profile.preferences, {});
    res.json({
      name: user.name,
      headline: doc.headline || profile.headline || "",
      summary: doc.summary || "",
      skills: doc.skills || [],
      employment: doc.employment || [],
      education: doc.education || [],
      photoUrl: profile.photo_url || "",
      city: user.city || "",
      email: preferences.shareContact === false ? "" : user.email,
      phone: preferences.shareContact === false ? "" : user.phone || "",
      template: resolveTemplate(profile.template, templateLimitOf(featuresOf(user).features)),
    });
  });
}
