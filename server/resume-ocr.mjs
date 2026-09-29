/** Vision-capable AI completion for resume OCR and other image inputs. */

import { estimateCostMicros } from "./ai-cost.mjs";
import { resolveSystemPrompt } from "./prompt-registry.mjs";
import { assignmentFor } from "./ai-run.mjs";
import { prompts } from "./ai.mjs";

/**
 * @param {string} functionKey
 * @param {string} system
 * @param {string} userText
 * @param {{ mimeType: string, base64: string }} image
 */
export async function completeVisionJson(functionKey, system, userText, image) {
  const assignment = assignmentFor(functionKey);
  const provider = assignment?.name || "Built-in rules";
  const model = assignment?.model || "rules-v1";
  const systemPrompt = resolveSystemPrompt(functionKey, system);
  if (!assignment || !assignment.assignment_enabled || !assignment.enabled || assignment.kind === "deterministic") {
    return {
      json: null,
      provider,
      model,
      kind: "deterministic",
      costMicros: 0,
      error: "Assign a vision-capable AI provider to Resume OCR in Admin → AI pipelines.",
    };
  }
  if (!image?.base64 || !image?.mimeType) {
    return { json: null, provider, model, kind: assignment.kind, costMicros: 0, error: "Missing resume image." };
  }
  try {
    const text = await callVisionProvider(assignment, systemPrompt, userText, image);
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const json = start >= 0 && end > start ? JSON.parse(text.slice(start, end + 1)) : null;
    const costMicros = estimateCostMicros({
      kind: assignment.kind,
      model,
      system: systemPrompt,
      user: userText,
      response: text,
    });
    return { json, provider, model, kind: assignment.kind, costMicros };
  } catch (error) {
    return {
      json: null,
      provider,
      model,
      kind: assignment.kind,
      costMicros: 0,
      error: error instanceof Error ? error.message : "Vision AI call failed",
    };
  }
}

async function callVisionProvider(provider, system, userText, image) {
  const mime = normalizeMime(image.mimeType);
  if (provider.kind === "openai") {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${provider.api_key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: provider.model || "gpt-4o-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: userText || "Transcribe this resume image." },
              { type: "image_url", image_url: { url: `data:${mime};base64,${image.base64}` } },
            ],
          },
        ],
      }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message || `OpenAI ${response.status}`);
    return body.choices?.[0]?.message?.content || "{}";
  }
  if (provider.kind === "anthropic") {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": provider.api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: provider.model || "claude-3-5-haiku-latest",
        max_tokens: 4000,
        temperature: 0,
        system,
        messages: [
          {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: mime, data: image.base64 } },
              { type: "text", text: userText || "Transcribe this resume image." },
            ],
          },
        ],
      }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message || `Anthropic ${response.status}`);
    return body.content?.map((part) => part.text || "").join("\n") || "{}";
  }
  if (provider.kind === "google") {
    const model = provider.model || "gemini-2.0-flash";
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(provider.api_key)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                { text: `${system}\n\n${userText || "Transcribe this resume image."}` },
                { inline_data: { mime_type: mime, data: image.base64 } },
              ],
            },
          ],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
      },
    );
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message || `Google ${response.status}`);
    return body.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") || "{}";
  }
  throw new Error(`Vision OCR is not supported for AI kind ${provider.kind}.`);
}

function normalizeMime(value) {
  const mime = String(value || "").toLowerCase();
  if (mime === "image/jpg") return "image/jpeg";
  if (["image/png", "image/jpeg", "image/webp", "image/gif"].includes(mime)) return mime;
  return "image/png";
}

export function resumeImageMime(filename = "") {
  const lower = String(filename).toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "";
}

export function isResumeImageFilename(filename = "") {
  return Boolean(resumeImageMime(filename));
}

/**
 * Run the admin-assigned Resume OCR pipeline on an image buffer.
 * @returns {Promise<{ text: string, provider: string, model: string, costMicros: number, error?: string }>}
 */
export async function ocrResumeImage({ filename, buffer } = {}) {
  const mimeType = resumeImageMime(filename);
  if (!mimeType) {
    return { text: "", provider: "none", model: "none", costMicros: 0, error: "Unsupported image type." };
  }
  if (!Buffer.isBuffer(buffer) || buffer.length < 32) {
    return { text: "", provider: "none", model: "none", costMicros: 0, error: "Image file is empty." };
  }
  const base64 = buffer.toString("base64");
  const ai = await completeVisionJson(
    "resume_ocr",
    prompts.RESUME_OCR_V1,
    "Transcribe every readable word from this resume image into the text field.",
    { mimeType, base64 },
  );
  const text = String(ai.json?.text || "").trim();
  return {
    text,
    provider: ai.provider,
    model: ai.model,
    costMicros: ai.costMicros || 0,
    error: text ? undefined : ai.error || "No readable text was found in the image.",
  };
}
