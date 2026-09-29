import assert from "node:assert/strict";
import test from "node:test";
import { migrate, SCHEMA_VERSION, AI_FUNCTIONS } from "./schema.mjs";
import { db } from "./db.mjs";
import { DEFAULT_PROMPTS } from "./ai.mjs";
import { isResumeImageFilename, resumeImageMime, ocrResumeImage } from "./resume-ocr.mjs";
import { loadResumeText } from "./extract.mjs";

test("schema 25 seeds resume_ocr AI function and prompt", () => {
  assert.ok(SCHEMA_VERSION >= 25);
  migrate();
  assert.ok(AI_FUNCTIONS.some((item) => item.key === "resume_ocr"));
  assert.ok(DEFAULT_PROMPTS.resume_ocr.includes("OCR"));
  assert.ok(db.prepare("SELECT function_key FROM ai_assignments WHERE function_key = ?").get("resume_ocr"));
  assert.ok(
    db
      .prepare("SELECT id FROM ai_prompt_versions WHERE function_key = ? AND status = 'published'")
      .get("resume_ocr"),
  );
});

test("resume image filename helpers accept png jpg webp gif", () => {
  assert.equal(isResumeImageFilename("resume.PNG"), true);
  assert.equal(resumeImageMime("scan.jpeg"), "image/jpeg");
  assert.equal(resumeImageMime("page.webp"), "image/webp");
  assert.equal(isResumeImageFilename("resume.pdf"), false);
  assert.equal(isResumeImageFilename("resume.docx"), false);
});

test("deterministic resume OCR returns empty with assign-provider guidance", async () => {
  migrate();
  // Tiny fake PNG header bytes — enough for buffer check; deterministic assignment cannot OCR.
  const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Buffer.alloc(40, 1)]);
  const result = await ocrResumeImage({ filename: "resume.png", buffer });
  assert.equal(result.text, "");
  assert.ok(/Assign a vision|Resume OCR|No readable/i.test(result.error || ""));
});

test("loadResumeText routes images through OCR metadata", async () => {
  migrate();
  const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Buffer.alloc(40, 2)]);
  const loaded = await loadResumeText("photo-resume.jpg", buffer);
  assert.equal(loaded.text, "");
  assert.ok(loaded.ocr);
  assert.ok(loaded.ocr.provider);

  const plain = await loadResumeText("plain.txt", Buffer.from("Alex Example\nalex@example.com\nProduct Manager with SQL and roadmapping."));
  assert.ok(plain.text.includes("Alex Example"));
  assert.equal(plain.ocr, null);
});
