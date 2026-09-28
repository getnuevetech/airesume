const $ = (id) => document.getElementById(id);

const SENSITIVE_RE =
  /password|captcha|recaptcha|ssn|social.?security|disability|veteran|race|ethnicity|gender|sex|criminal|conviction|authorization|sponsorship|citizen|visa|salary|compensation|eeo|demographic/i;

const CONTACT_PATTERNS = [
  { key: "name", re: /full[_\s-]?name|applicant[_\s-]?name|legal[_\s-]?name|(^|[\s_])name($|[\s_])/i },
  { key: "email", re: /e-?mail/i },
  { key: "phone", re: /phone|mobile|tel/i },
  { key: "city", re: /city|locality|town/i },
  { key: "address", re: /address|street|addr1|line[_\s-]?1/i },
];

function fingerprint(field) {
  return [field.name, field.id, field.autocomplete, field.placeholder, field.ariaLabel, field.label, field.type]
    .map((part) => String(part || "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
}

function isSensitive(field) {
  if (String(field.type || "").toLowerCase() === "password") return true;
  return SENSITIVE_RE.test(fingerprint(field));
}

function classifyContact(field) {
  if (isSensitive(field)) return null;
  const blob = fingerprint(field);
  for (const item of CONTACT_PATTERNS) if (item.re.test(blob)) return item.key;
  if (String(field.type || "").toLowerCase() === "email") return "email";
  if (String(field.type || "").toLowerCase() === "tel") return "phone";
  return null;
}

function classifyResume(field) {
  if (isSensitive(field)) return null;
  const blob = fingerprint(field);
  if ((field.tag === "textarea" || /textarea/i.test(field.type || "")) && /resume|cv|cover.?letter|additional.?info|comments/i.test(blob)) {
    return "resume";
  }
  return null;
}

function matchAnswer(field, answers) {
  const blob = fingerprint(field);
  if (!blob) return null;
  let best = null;
  let bestScore = 0;
  for (const answer of answers || []) {
    const prompt = String(answer.prompt || "").toLowerCase();
    if (!prompt) continue;
    const tokens = prompt.split(/[^a-z0-9]+/).filter((token) => token.length > 3);
    let hits = 0;
    for (const token of tokens) if (blob.includes(token)) hits += 1;
    const score = tokens.length ? hits / tokens.length : 0;
    if (score > bestScore && score >= 0.4) {
      best = answer;
      bestScore = score;
    }
  }
  return best;
}

function proposeFills(fields, kit) {
  const contact = new Map((kit.contact || []).map((item) => [item.key, item]));
  const proposals = [];
  for (const field of fields || []) {
    if (isSensitive(field) || field.sensitive) {
      proposals.push({ fieldId: field.uid, key: "sensitive", value: "", skipped: true, reason: "Sensitive fields stay blank." });
      continue;
    }
    const contactKey = classifyContact(field);
    if (contactKey) {
      const item = contact.get(contactKey);
      const value = String(item?.value || "").trim();
      proposals.push({ fieldId: field.uid, key: contactKey, value, skipped: !value, reason: value ? "" : "No kit value." });
      continue;
    }
    if (classifyResume(field)) {
      const value = String(kit.resumeText || "").trim();
      proposals.push({ fieldId: field.uid, key: "resume", value, skipped: !value, reason: value ? "" : "No resume text." });
      continue;
    }
    const answer = matchAnswer(field, kit.answers || []);
    if (answer) {
      proposals.push({
        fieldId: field.uid,
        key: "answer",
        value: answer.ready ? answer.answer : "",
        skipped: !answer.ready,
        reason: answer.ready ? "" : answer.blankReason || "Fill manually.",
      });
    }
  }
  return proposals;
}

async function loadSettings() {
  const stored = await chrome.storage.sync.get(["apiBase", "token", "applicationId"]);
  $("apiBase").value = stored.apiBase || "http://localhost:3000";
  $("token").value = stored.token || "";
  $("applicationId").value = stored.applicationId || "";
}

async function saveSettings() {
  await chrome.storage.sync.set({
    apiBase: $("apiBase").value.trim().replace(/\/$/, ""),
    token: $("token").value.trim(),
    applicationId: $("applicationId").value.trim(),
  });
  setStatus("Settings saved.");
}

function setStatus(message, isError = false) {
  const node = $("status");
  node.textContent = message;
  node.className = isError ? "status error" : "status";
}

function authHeaders(token) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function scanPage() {
  const tab = await activeTab();
  if (!tab?.id) throw new Error("No active tab.");
  const response = await chrome.tabs.sendMessage(tab.id, { type: "JOBPILOT_EXTRACT" });
  if (!response?.ok) throw new Error(response?.error || "Could not read this page.");
  const draft = response.draft;
  $("title").value = draft.title || "";
  $("company").value = draft.company || "";
  $("location").value = draft.location || "";
  $("description").value = draft.description || "";
  return draft;
}

async function capture(action) {
  await saveSettings();
  const apiBase = $("apiBase").value.trim().replace(/\/$/, "");
  const token = $("token").value.trim();
  if (!token) {
    setStatus("Paste an extension token from JobPilot Settings.", true);
    return;
  }
  const tab = await activeTab();
  const body = {
    action,
    sourceUrl: tab?.url || "",
    pageTitle: tab?.title || "",
    title: $("title").value.trim(),
    company: $("company").value.trim(),
    location: $("location").value.trim(),
    description: $("description").value.trim(),
  };
  setStatus("Sending capture…");
  const response = await fetch(`${apiBase}/api/extension/capture`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    setStatus(data.error || "Capture failed.", true);
    return;
  }
  if (data.application?.id) {
    $("applicationId").value = data.application.id;
    await chrome.storage.sync.set({ applicationId: data.application.id });
  }
  const score = data.job?.score != null ? ` · ${data.job.score}% match` : "";
  const status = data.application?.status ? ` · ${data.application.status}` : "";
  setStatus(`Captured “${data.job?.title || "role"}”${score}${status}.`);
}

async function detectFields() {
  const tab = await activeTab();
  if (!tab?.id) throw new Error("No active tab.");
  const response = await chrome.tabs.sendMessage(tab.id, { type: "JOBPILOT_DETECT_FIELDS" });
  if (!response?.ok) throw new Error(response?.error || "Could not detect fields.");
  const fillable = (response.fields || []).filter((field) => !field.sensitive);
  setStatus(`Detected ${response.fields.length} fields (${fillable.length} fillable, ${response.fields.length - fillable.length} sensitive skipped).`);
  return response.fields || [];
}

async function fillFromKit() {
  await saveSettings();
  const apiBase = $("apiBase").value.trim().replace(/\/$/, "");
  const token = $("token").value.trim();
  const applicationId = $("applicationId").value.trim();
  if (!token || !applicationId) {
    setStatus("Need an extension token and application id (run Assisted Apply first).", true);
    return;
  }
  const fields = await detectFields();
  const kitResponse = await fetch(`${apiBase}/api/extension/applications/${encodeURIComponent(applicationId)}/apply-kit`, {
    headers: authHeaders(token),
  });
  const kitData = await kitResponse.json().catch(() => ({}));
  if (!kitResponse.ok) {
    setStatus(kitData.error || "Could not load apply kit.", true);
    return;
  }
  const proposals = proposeFills(fields, kitData.kit || {});
  const ready = proposals.filter((item) => !item.skipped && item.value).length;
  if (!ready) {
    setStatus("No safe fills ready from the kit. Sensitive/blank fields stay empty.", true);
    return;
  }
  const tab = await activeTab();
  const fillResponse = await chrome.tabs.sendMessage(tab.id, { type: "JOBPILOT_FILL", proposals });
  if (!fillResponse?.ok) throw new Error(fillResponse?.error || "Fill failed.");
  await fetch(`${apiBase}/api/extension/applications/${encodeURIComponent(applicationId)}/apply-kit/event`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ event: "filled", detail: `filled=${fillResponse.filled}` }),
  }).catch(() => undefined);
  setStatus(`Filled ${fillResponse.filled} field(s); skipped ${fillResponse.skipped}. Review before submitting on the employer site.`);
}

async function markApplied() {
  await saveSettings();
  const apiBase = $("apiBase").value.trim().replace(/\/$/, "");
  const token = $("token").value.trim();
  const applicationId = $("applicationId").value.trim();
  if (!token || !applicationId) {
    setStatus("Need an extension token and application id.", true);
    return;
  }
  const response = await fetch(`${apiBase}/api/extension/applications/${encodeURIComponent(applicationId)}/mark-applied`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    setStatus(data.error || "Could not mark Applied.", true);
    return;
  }
  setStatus(`Marked Applied in JobPilot tracker. Employer submission stays on their site.`);
}

$("save").addEventListener("click", () => void saveSettings().catch((err) => setStatus(err.message, true)));
$("refresh").addEventListener("click", () => void scanPage().then(() => setStatus("Page scanned.")).catch((err) => setStatus(err.message, true)));
$("track").addEventListener("click", () => void capture("track").catch((err) => setStatus(err.message, true)));
$("prepare").addEventListener("click", () => void capture("prepare").catch((err) => setStatus(err.message, true)));
$("detect").addEventListener("click", () => void detectFields().catch((err) => setStatus(err.message, true)));
$("fill").addEventListener("click", () => void fillFromKit().catch((err) => setStatus(err.message, true)));
$("markApplied").addEventListener("click", () => void markApplied().catch((err) => setStatus(err.message, true)));

void loadSettings()
  .then(() => scanPage())
  .then(() => setStatus("Ready to capture or autofill."))
  .catch((err) => setStatus(err.message || "Open a listing page first.", true));
