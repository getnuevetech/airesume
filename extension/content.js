/** Best-effort job extraction + Assisted Apply field detect/fill (never auto-submit). */

function textOf(el) {
  return String(el?.innerText || el?.textContent || "")
    .replace(/\s+/g, " ")
    .trim();
}

function meta(name) {
  const node =
    document.querySelector(`meta[property="${name}"]`) ||
    document.querySelector(`meta[name="${name}"]`);
  return String(node?.getAttribute("content") || "").trim();
}

function firstText(selectors) {
  for (const selector of selectors) {
    const node = document.querySelector(selector);
    const value = textOf(node);
    if (value) return value;
  }
  return "";
}

function extractJob() {
  const title =
    firstText(["h1", "[data-testid='job-title']", ".job-title", ".posting-headline"]) ||
    meta("og:title") ||
    document.title;
  const company =
    firstText([
      "[data-testid='company-name']",
      ".company",
      ".employer",
      ".job-company",
      "a[data-company-name]",
    ]) || meta("og:site_name");
  const location = firstText([
    "[data-testid='location']",
    ".location",
    ".job-location",
    "[class*='location']",
  ]);
  const description =
    firstText([
      "[data-testid='job-description']",
      "#job-description",
      ".job-description",
      ".description",
      "article",
      "main",
    ]) || textOf(document.body).slice(0, 8000);

  return {
    sourceUrl: window.location.href,
    pageTitle: document.title,
    title: title.slice(0, 160),
    company: company.slice(0, 160),
    location: location.slice(0, 160),
    description: description.slice(0, 12000),
  };
}

const SENSITIVE_RE =
  /password|captcha|recaptcha|ssn|social.?security|disability|veteran|race|ethnicity|gender|sex|criminal|conviction|authorization|sponsorship|citizen|visa|salary|compensation|eeo|demographic/i;

const CONTACT_PATTERNS = [
  { key: "name", re: /full[_\s-]?name|applicant[_\s-]?name|legal[_\s-]?name|(^|[\s_])name($|[\s_])/i },
  { key: "email", re: /e-?mail/i },
  { key: "phone", re: /phone|mobile|tel/i },
  { key: "city", re: /city|locality|town/i },
  { key: "address", re: /address|street|addr1|line[_\s-]?1/i },
];

function labelFor(el) {
  if (!el) return "";
  if (el.labels && el.labels[0]) return textOf(el.labels[0]);
  const id = el.getAttribute("id");
  if (id) {
    const byFor = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (byFor) return textOf(byFor);
  }
  return textOf(el.closest("label")) || String(el.getAttribute("aria-label") || "");
}

function fingerprint(el) {
  return [
    el.getAttribute("name"),
    el.id,
    el.getAttribute("autocomplete"),
    el.getAttribute("placeholder"),
    el.getAttribute("aria-label"),
    labelFor(el),
    el.type,
  ]
    .map((part) => String(part || "").trim().toLowerCase())
    .filter(Boolean)
    .join(" ");
}

function isSensitive(el) {
  if (String(el.type || "").toLowerCase() === "password") return true;
  return SENSITIVE_RE.test(fingerprint(el));
}

function classifyContact(el) {
  if (isSensitive(el)) return null;
  const blob = fingerprint(el);
  for (const item of CONTACT_PATTERNS) {
    if (item.re.test(blob)) return item.key;
  }
  if (String(el.type || "").toLowerCase() === "email") return "email";
  if (String(el.type || "").toLowerCase() === "tel") return "phone";
  return null;
}

function classifyResume(el) {
  if (isSensitive(el)) return null;
  const blob = fingerprint(el);
  if (el.tagName === "TEXTAREA" && /resume|cv|cover.?letter|additional.?info|comments/i.test(blob)) return "resume";
  return null;
}

function detectFields() {
  const nodes = [...document.querySelectorAll("input, textarea, select")].filter((el) => {
    if (el.disabled || el.readOnly) return false;
    if (el.type === "hidden" || el.type === "submit" || el.type === "button" || el.type === "checkbox" || el.type === "radio" || el.type === "file") {
      return false;
    }
    return true;
  });
  return nodes.map((el, index) => {
    const uid = el.dataset.jpFieldId || `jp-field-${index}`;
    el.dataset.jpFieldId = uid;
    return {
      uid,
      tag: el.tagName.toLowerCase(),
      type: el.type || "",
      name: el.getAttribute("name") || "",
      id: el.id || "",
      autocomplete: el.getAttribute("autocomplete") || "",
      placeholder: el.getAttribute("placeholder") || "",
      ariaLabel: el.getAttribute("aria-label") || "",
      label: labelFor(el),
      sensitive: isSensitive(el),
      contactKey: classifyContact(el),
      resumeKey: classifyResume(el),
    };
  });
}

function setValue(el, value) {
  const next = String(value || "");
  el.focus();
  el.value = next;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function applyFills(proposals) {
  let filled = 0;
  let skipped = 0;
  for (const proposal of proposals || []) {
    const el = document.querySelector(`[data-jp-field-id="${CSS.escape(proposal.fieldId)}"]`);
    if (!el) {
      skipped += 1;
      continue;
    }
    if (proposal.skipped || !proposal.value || isSensitive(el)) {
      skipped += 1;
      continue;
    }
    setValue(el, proposal.value);
    filled += 1;
  }
  return { filled, skipped };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "JOBPILOT_EXTRACT") {
    try {
      sendResponse({ ok: true, draft: extractJob() });
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : "Extract failed" });
    }
    return true;
  }
  if (message?.type === "JOBPILOT_DETECT_FIELDS") {
    try {
      sendResponse({ ok: true, fields: detectFields() });
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : "Detect failed" });
    }
    return true;
  }
  if (message?.type === "JOBPILOT_FILL") {
    try {
      const result = applyFills(message.proposals || []);
      sendResponse({ ok: true, ...result });
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : "Fill failed" });
    }
    return true;
  }
  return true;
});
