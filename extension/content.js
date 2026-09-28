/** Best-effort job field extraction from employer / ATS pages. */

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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "JOBPILOT_EXTRACT") {
    try {
      sendResponse({ ok: true, draft: extractJob() });
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : "Extract failed" });
    }
  }
  return true;
});
