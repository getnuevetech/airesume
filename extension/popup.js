const $ = (id) => document.getElementById(id);

async function loadSettings() {
  const stored = await chrome.storage.sync.get(["apiBase", "token"]);
  $("apiBase").value = stored.apiBase || "http://localhost:3000";
  $("token").value = stored.token || "";
}

async function saveSettings() {
  await chrome.storage.sync.set({
    apiBase: $("apiBase").value.trim().replace(/\/$/, ""),
    token: $("token").value.trim(),
  });
  setStatus("Settings saved.");
}

function setStatus(message, isError = false) {
  const node = $("status");
  node.textContent = message;
  node.className = isError ? "status error" : "status";
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
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    setStatus(data.error || "Capture failed.", true);
    return;
  }
  const score = data.job?.score != null ? ` · ${data.job.score}% match` : "";
  const status = data.application?.status ? ` · ${data.application.status}` : "";
  setStatus(`Captured “${data.job?.title || "role"}”${score}${status}.`);
}

$("save").addEventListener("click", () => void saveSettings().catch((err) => setStatus(err.message, true)));
$("refresh").addEventListener("click", () => void scanPage().then(() => setStatus("Page scanned.")).catch((err) => setStatus(err.message, true)));
$("track").addEventListener("click", () => void capture("track").catch((err) => setStatus(err.message, true)));
$("prepare").addEventListener("click", () => void capture("prepare").catch((err) => setStatus(err.message, true)));

void loadSettings()
  .then(() => scanPage())
  .then(() => setStatus("Ready to capture."))
  .catch((err) => setStatus(err.message || "Open a listing page first.", true));
