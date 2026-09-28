/** Soft redaction helpers for logs and audit detail. */

const SECRET_RE =
  /(password|passwd|token|authorization|bearer|jpxt_|cookie|totp|secret|credential)\s*[:=]\s*["']?[^"'\\s,;]+/gi;
const RESUME_MARKERS = [/-----BEGIN/, /curriculum vitae/i, /work experience/i];

export function redactSensitive(value, { maxLen = 240 } = {}) {
  let text = typeof value === "string" ? value : JSON.stringify(value ?? "");
  text = text.replace(SECRET_RE, "$1=[REDACTED]");
  if (RESUME_MARKERS.some((re) => re.test(text)) && text.length > 400) {
    text = `[REDACTED resume/body ${text.length} chars]`;
  }
  if (text.length > maxLen) text = `${text.slice(0, maxLen)}…`;
  return text;
}

export function assertNoSecrets(text) {
  const sample = String(text || "");
  if (/password\s*[:=]\s*[^\[\s]+/i.test(sample) && !/\[REDACTED\]/i.test(sample)) {
    throw new Error("Sensitive password-like value leaked into log text.");
  }
  if (/jpxt_[a-z0-9]+/i.test(sample)) {
    throw new Error("Extension token leaked into log text.");
  }
  return true;
}
