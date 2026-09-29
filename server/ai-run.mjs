import { db } from "./db.mjs";
import { estimateCostMicros } from "./ai-cost.mjs";
import { resolveSystemPrompt } from "./prompt-registry.mjs";

const enabledProviderSql = "SELECT 1 AS assignment_enabled, ai_providers.* FROM ai_providers WHERE enabled = 1 ORDER BY kind = 'deterministic' DESC, created_at LIMIT 1";

export function assignmentFor(functionKey) {
  const assigned = db
    .prepare(
      `SELECT ai_assignments.enabled AS assignment_enabled, ai_providers.*
       FROM ai_assignments JOIN ai_providers ON ai_providers.id = ai_assignments.provider_id
       WHERE ai_assignments.function_key = ?`,
    )
    .get(functionKey);
  if (assigned?.enabled && assigned.assignment_enabled) return assigned;
  return db.prepare(enabledProviderSql).get() || assigned;
}

export async function completeJson(functionKey, system, user) {
  const assignment = assignmentFor(functionKey);
  const provider = assignment?.name || "Built-in rules";
  const model = assignment?.model || "rules-v1";
  const systemPrompt = resolveSystemPrompt(functionKey, system);
  if (!assignment || !assignment.assignment_enabled || !assignment.enabled || assignment.kind === "deterministic") {
    return { json: null, provider, model, kind: "deterministic", costMicros: 0 };
  }
  try {
    const text = await callProvider(assignment, systemPrompt, user);
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const json = start >= 0 && end > start ? JSON.parse(text.slice(start, end + 1)) : null;
    const costMicros = estimateCostMicros({
      kind: assignment.kind,
      model,
      system: systemPrompt,
      user,
      response: text,
    });
    return { json, provider, model, kind: assignment.kind, costMicros, promptSource: systemPrompt === system ? "code" : "registry" };
  } catch (error) {
    return {
      json: null,
      provider,
      model,
      kind: assignment.kind,
      costMicros: 0,
      error: error instanceof Error ? error.message : "AI call failed",
    };
  }
}

async function callProvider(provider, system, user) {
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
          { role: "user", content: user },
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
        max_tokens: 1800,
        temperature: 0,
        system,
        messages: [{ role: "user", content: user }],
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
          contents: [{ role: "user", parts: [{ text: `${system}\n\n${user}` }] }],
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
      },
    );
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message || `Google ${response.status}`);
    return body.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") || "{}";
  }
  throw new Error(`Unknown AI kind ${provider.kind}`);
}
