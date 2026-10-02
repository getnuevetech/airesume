/** Operator-filled legal entity fields used in Terms/Privacy contact blocks. */

import { db } from "./db.mjs";

export const LEGAL_ENTITY_SETTING = "legal_entity";

export const EMPTY_LEGAL_ENTITY = {
  legalName: "",
  mailingAddress: "",
  privacyEmail: "",
  supportEmail: "",
};

/**
 * @param {unknown} raw
 */
export function normalizeLegalEntity(raw = {}) {
  const src = raw && typeof raw === "object" ? raw : {};
  return {
    legalName: String(src.legalName || "").trim(),
    mailingAddress: String(src.mailingAddress || "").trim(),
    privacyEmail: String(src.privacyEmail || "").trim().toLowerCase(),
    supportEmail: String(src.supportEmail || "").trim().toLowerCase(),
  };
}

export function getLegalEntity() {
  try {
    const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(LEGAL_ENTITY_SETTING);
    if (!row?.value) return { ...EMPTY_LEGAL_ENTITY };
    return normalizeLegalEntity(JSON.parse(row.value));
  } catch {
    return { ...EMPTY_LEGAL_ENTITY };
  }
}

export function saveLegalEntity(raw) {
  const next = normalizeLegalEntity(raw);
  if (next.privacyEmail && !next.privacyEmail.includes("@")) {
    return { ok: false, error: "Privacy email must be a valid email address." };
  }
  if (next.supportEmail && !next.supportEmail.includes("@")) {
    return { ok: false, error: "Support email must be a valid email address." };
  }
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(LEGAL_ENTITY_SETTING, JSON.stringify(next));
  return { ok: true, entity: next };
}

export function legalEntityComplete(entity = getLegalEntity()) {
  return Boolean(entity.legalName && entity.mailingAddress && entity.privacyEmail && entity.supportEmail);
}

/** Replace bracket placeholders in published legal copy with saved entity fields. */
export function applyLegalEntityToText(text, entity = getLegalEntity()) {
  let out = String(text || "");
  if (entity.legalName) out = out.split("[COMPANY LEGAL NAME]").join(entity.legalName);
  if (entity.mailingAddress) out = out.split("[COMPANY MAILING ADDRESS]").join(entity.mailingAddress);
  if (entity.privacyEmail) out = out.split("[PRIVACY EMAIL]").join(entity.privacyEmail);
  if (entity.supportEmail) {
    out = out.split("[LEGAL / SUPPORT EMAIL]").join(entity.supportEmail);
    out = out.split("[LEGAL/SUPPORT EMAIL]").join(entity.supportEmail);
  }
  return out;
}

/**
 * @template T
 * @param {T} doc
 * @param {ReturnType<typeof normalizeLegalEntity>} [entity]
 * @returns {T}
 */
export function applyLegalEntityToDoc(doc, entity = getLegalEntity()) {
  if (!doc || typeof doc !== "object") return doc;
  const clone = structuredClone(doc);
  if (Array.isArray(clone.sections)) {
    for (const section of clone.sections) {
      if (!Array.isArray(section.blocks)) continue;
      for (const block of section.blocks) {
        if (block.type === "p" && typeof block.text === "string") {
          block.text = applyLegalEntityToText(block.text, entity);
        }
        if (block.type === "ul" && Array.isArray(block.items)) {
          block.items = block.items.map((item) => applyLegalEntityToText(item, entity));
        }
      }
    }
  }
  return clone;
}
