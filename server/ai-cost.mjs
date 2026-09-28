/** Approximate AI call cost estimates and audit rollups. */

import { db } from "./db.mjs";

/** USD per 1M tokens: [input, output]. Deterministic / unknown → 0. */
const MODEL_RATES = {
  "gpt-4o-mini": [0.15, 0.6],
  "gpt-4o": [2.5, 10],
  "gpt-4.1-mini": [0.4, 1.6],
  "gpt-4.1": [2, 8],
  "claude-3-5-haiku": [0.8, 4],
  "claude-3-5-sonnet": [3, 15],
  "claude-3-haiku": [0.25, 1.25],
  "gemini-2.0-flash": [0.1, 0.4],
  "gemini-1.5-flash": [0.075, 0.3],
  "gemini-1.5-pro": [1.25, 5],
};

function rateFor(model = "") {
  const key = String(model || "").toLowerCase();
  for (const [name, rate] of Object.entries(MODEL_RATES)) {
    if (key.includes(name)) return rate;
  }
  if (/mini|haiku|flash|nano/.test(key)) return [0.15, 0.6];
  if (/sonnet|pro|gpt-4/.test(key)) return [2.5, 10];
  return [0.5, 1.5];
}

export function estimateTokens(text = "") {
  const length = String(text || "").length;
  return Math.max(1, Math.ceil(length / 4));
}

/**
 * Estimate call cost in USD micros (1e-6 dollars).
 * Deterministic providers are free.
 */
export function estimateCostMicros({ kind, model, system = "", user = "", response = "" } = {}) {
  if (!kind || kind === "deterministic") return 0;
  const [inRate, outRate] = rateFor(model);
  const inputTokens = estimateTokens(`${system}\n${user}`);
  const outputTokens = estimateTokens(response || "{}");
  const dollars = (inputTokens / 1e6) * inRate + (outputTokens / 1e6) * outRate;
  return Math.max(0, Math.round(dollars * 1e6));
}

export function moneyFromMicros(micros) {
  const value = Number(micros) || 0;
  if (value === 0) return "$0.00";
  if (value < 100) return `$${(value / 1e6).toFixed(6)}`;
  if (value < 10000) return `$${(value / 1e6).toFixed(4)}`;
  return `$${(value / 1e6).toFixed(2)}`;
}

function bucketRows(since) {
  return db
    .prepare(
      `SELECT function_name, provider, model, COUNT(*) AS calls, COALESCE(SUM(cost_micros), 0) AS cost_micros
       FROM ai_audit WHERE created_at >= ?
       GROUP BY function_name, provider, model
       ORDER BY cost_micros DESC, calls DESC`,
    )
    .all(since);
}

function rollup(since, now = Date.now()) {
  const rows = bucketRows(since);
  const byFunctionMap = new Map();
  const byProviderMap = new Map();
  let calls = 0;
  let costMicros = 0;
  for (const row of rows) {
    calls += row.calls;
    costMicros += row.cost_micros;
    const fn = byFunctionMap.get(row.function_name) || { functionName: row.function_name, calls: 0, costMicros: 0 };
    fn.calls += row.calls;
    fn.costMicros += row.cost_micros;
    byFunctionMap.set(row.function_name, fn);
    const key = `${row.provider}/${row.model}`;
    const provider = byProviderMap.get(key) || { provider: row.provider, model: row.model, calls: 0, costMicros: 0 };
    provider.calls += row.calls;
    provider.costMicros += row.cost_micros;
    byProviderMap.set(key, provider);
  }
  const decorate = (item) => ({ ...item, costLabel: moneyFromMicros(item.costMicros) });
  return {
    since,
    until: now,
    calls,
    costMicros,
    costLabel: moneyFromMicros(costMicros),
    byFunction: [...byFunctionMap.values()].map(decorate).sort((a, b) => b.costMicros - a.costMicros || b.calls - a.calls),
    byProvider: [...byProviderMap.values()].map(decorate).sort((a, b) => b.costMicros - a.costMicros || b.calls - a.calls),
  };
}

export function auditCostSummary(now = Date.now()) {
  const day = 24 * 60 * 60 * 1000;
  return {
    last24Hours: rollup(now - day, now),
    last7Days: rollup(now - 7 * day, now),
    last30Days: rollup(now - 30 * day, now),
  };
}
