import { completeJson } from "./ai-run.mjs";

const AUTH_TYPES = ["none", "bearer", "basic", "header"];
const FORMATS = ["auto", "json", "rss", "html"];

export function normalizeFeedUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value || "").trim());
  } catch {
    throw new Error("Enter a valid http or https feed URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Feed URL must start with http or https.");
  }
  parsed.hash = "";
  parsed.hostname = parsed.hostname.toLowerCase();
  if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/+$/, "");
  return parsed.toString();
}

export function feedConfig(input, current = {}) {
  const authType = AUTH_TYPES.includes(input.authType) ? input.authType : current.authType || "none";
  const secretInput = input.secret == null ? "" : String(input.secret);
  const secret = secretInput && !secretInput.startsWith("••••") ? secretInput : current.secret || "";
  return {
    url: input.url == null ? current.url || "" : String(input.url).trim(),
    format: FORMATS.includes(input.format) ? input.format : current.format || "auto",
    authType,
    username: input.username == null ? current.username || "" : String(input.username),
    headerName: input.headerName == null ? current.headerName || "" : String(input.headerName).trim(),
    employer: input.employer == null ? current.employer || "" : String(input.employer).trim(),
    secret: authType === "none" ? "" : secret,
  };
}

export function publicFeedConfig(config) {
  return {
    url: config.url || "",
    format: config.format || "auto",
    authType: config.authType || "none",
    username: config.username || "",
    headerName: config.headerName || "",
    employer: config.employer || "",
    hasSecret: Boolean(config.secret),
  };
}

function feedHeaders(config) {
  const headers = {
    Accept: "application/json, application/rss+xml, application/atom+xml, text/xml, */*",
    "User-Agent": "JobPilot/1.0",
  };
  if (config.authType === "bearer" && config.secret) headers.Authorization = `Bearer ${config.secret}`;
  if (config.authType === "basic" && (config.username || config.secret)) {
    headers.Authorization = `Basic ${Buffer.from(`${config.username}:${config.secret}`).toString("base64")}`;
  }
  if (config.authType === "header" && config.headerName && config.secret) headers[config.headerName] = config.secret;
  return headers;
}

function decodeXml(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function xmlTag(block, name) {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function atomLink(block) {
  const alternate = block.match(/<link\b[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*>/i)
    || block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*rel=["']alternate["'][^>]*>/i);
  if (alternate) return alternate[1];
  const any = block.match(/<link\b[^>]*href=["']([^"']+)["'][^>]*\/?\s*>/i);
  return any ? any[1] : xmlTag(block, "link");
}

function stripHtml(value) {
  return decodeXml(String(value || ""));
}

function textOf(value) {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "object" && value.name) return String(value.name).trim();
  return "";
}

export function listingsFromJson(body, fallbackCompany) {
  const list = Array.isArray(body)
    ? body
    : body?.jobs || body?.data || body?.results || body?.postings || body?.job_postings || body?.items || [];
  if (!Array.isArray(list)) return [];
  const rows = [];
  for (const item of list) {
    if (!item || typeof item === "string") continue;
    if (typeof item !== "object") continue;
    const title = String(item.title || item.text || item.name || item.position || item.job_title || "").trim();
    const named = String(item.company || item.company_name || item.organization || item.companyName || "").trim();
    const employer = String(item.hiring_company || item.hiringCompany || item.client || item.primary_company || item.primaryCompany || "").trim();
    const company = named || employer || String(item.employer || fallbackCompany || "").trim();
    if (!title || !company) continue;
    const applyUrl = String(item.apply_url || item.applyUrl || item.application_url || item.applicationUrl || "").trim();
    const sourceUrl = String(item.url || item.absolute_url || item.hostedUrl || item.link || applyUrl || "").trim();
    const location =
      textOf(item.location) ||
      textOf(item.categories?.location) ||
      String(item.location_name || item.locationName || "");
    rows.push({
      externalKey: String(item.id || item.internal_job_id || item.gh_jid || `${company}-${title}`).slice(0, 180),
      title,
      company,
      employer: employer && employer !== company ? employer : "",
      location,
      remoteType: String(item.remote_type || item.remoteType || item.workplaceType || ""),
      salaryMin: Number(item.salary_min || item.salaryMin) || null,
      salaryMax: Number(item.salary_max || item.salaryMax) || null,
      description: stripHtml(item.description || item.descriptionPlain || item.content || item.job_description || item.summary || ""),
      skills: Array.isArray(item.skills) ? item.skills.map(String) : [],
      category: String(item.category || ""),
      role: String(item.role || ""),
      sourceUrl,
      applyUrl,
    });
  }
  return rows;
}

export function listingsFromXml(xml, fallbackCompany) {
  const blocks = xml.split(/<(?:item|entry)\b/i).slice(1);
  const rows = [];
  for (const piece of blocks) {
    const block = piece.split(/<\/(?:item|entry)>/i)[0] || piece;
    const title = xmlTag(block, "title");
    const company = xmlTag(block, "company") || fallbackCompany || xmlTag(block, "author") || xmlTag(block, "dc:creator") || "";
    if (!title || !company) continue;
    const sourceUrl = atomLink(block);
    rows.push({
      externalKey: (xmlTag(block, "guid") || xmlTag(block, "id") || `${company}-${title}`).slice(0, 180),
      title,
      company: company.trim(),
      employer: xmlTag(block, "employer") || xmlTag(block, "hiringCompany") || "",
      location: xmlTag(block, "location") || "",
      remoteType: "",
      salaryMin: null,
      salaryMax: null,
      description: xmlTag(block, "description") || xmlTag(block, "summary") || xmlTag(block, "content") || "",
      skills: [],
      category: "",
      role: "",
      sourceUrl,
      applyUrl: xmlTag(block, "applyUrl") || "",
    });
  }
  return rows;
}

export function listingsFromHtml(html, fallbackCompany, baseUrl = "") {
  const body = String(html || "");
  const companyFallback = String(fallbackCompany || "").trim();
  const rows = [];
  const seen = new Set();

  const push = (title, href, company = "", location = "", description = "") => {
    const cleanTitle = decodeXml(title).replace(/\s+/g, " ").trim();
    if (!cleanTitle || cleanTitle.length < 3 || cleanTitle.length > 160) return;
    let sourceUrl = decodeXml(href).trim();
    if (sourceUrl && baseUrl) {
      try {
        sourceUrl = new URL(sourceUrl, baseUrl).toString();
      } catch {
        sourceUrl = "";
      }
    }
    const companyName = decodeXml(company).trim() || companyFallback;
    if (!companyName) return;
    const key = `${cleanTitle.toLowerCase()}|${sourceUrl || companyName.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    rows.push({
      externalKey: (sourceUrl || `${companyName}-${cleanTitle}`).slice(0, 180),
      title: cleanTitle,
      company: companyName,
      employer: "",
      location: decodeXml(location).trim(),
      remoteType: /remote/i.test(`${location} ${description}`) ? "remote" : "",
      salaryMin: null,
      salaryMax: null,
      description: decodeXml(description).slice(0, 5000),
      skills: [],
      category: "",
      role: "",
      sourceUrl,
      applyUrl: sourceUrl,
    });
  };

  for (const match of body.matchAll(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const json = JSON.parse(match[1]);
      const nodes = Array.isArray(json) ? json : json["@graph"] ? json["@graph"] : [json];
      for (const node of nodes) {
        const type = String(node?.["@type"] || "");
        if (!/JobPosting/i.test(type)) continue;
        push(
          node.title || node.name || "",
          node.url || node.mainEntityOfPage || "",
          node.hiringOrganization?.name || companyFallback,
          node.jobLocation?.address?.addressLocality || node.jobLocationType || "",
          node.description || "",
        );
      }
    } catch {
      // Ignore invalid JSON-LD blocks.
    }
  }

  for (const match of body.matchAll(
    /<a\b[^>]*href=["']([^"']*(?:\/jobs?\/|\/careers?\/|\/position\/|\/opening\/|gh_jid=|lever\.co\/|ashbyhq\.com\/|greenhouse\.io\/)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi,
  )) {
    const title = decodeXml(match[2]).replace(/\s+/g, " ").trim();
    if (!title || title.length < 3) continue;
    push(title, match[1], companyFallback);
  }

  if (!rows.length) {
    for (const match of body.matchAll(/<(h1|h2|h3)[^>]*>([\s\S]*?)<\/\1>/gi)) {
      const inner = match[2];
      const link = inner.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i);
      if (!link) continue;
      const title = decodeXml(link[2]).replace(/\s+/g, " ").trim();
      if (!title || title.length < 4 || title.length > 120) continue;
      if (!/engineer|manager|analyst|designer|developer|specialist|director|lead|coordinator|assistant|officer|consultant|architect|scientist|nurse|teacher|sales|support|intern|product|marketing|finance|operations|technician/i.test(title)) {
        continue;
      }
      push(title, link[1], companyFallback);
    }
  }

  return rows;
}

function isLoginWall(body) {
  return /<form\b/i.test(body) && /type=["']password["']/i.test(body) && !/<(rss|feed|item|entry)\b/i.test(body);
}

export function parseFeedDocument(text, contentType, fallbackCompany, format = "auto", baseUrl = "") {
  const body = String(text || "").trim();
  if (format !== "html" && isLoginWall(body) && !/<(rss|feed|item|entry)\b/i.test(body) && !/"@type"\s*:\s*"JobPosting"/i.test(body)) {
    throw new Error(
      "This address opened a sign-in page. Prefer a public careers page, JSON feed, or RSS/Atom URL that does not require login.",
    );
  }
  if (format === "rss") return listingsFromXml(body, fallbackCompany);
  if (format === "html") {
    const rows = listingsFromHtml(body, fallbackCompany, baseUrl);
    if (!rows.length) {
      throw new Error("No public job listings were found on that page. Use a public careers URL, or a JSON/RSS feed.");
    }
    return rows;
  }
  if (format === "json") {
    try {
      return listingsFromJson(JSON.parse(body), fallbackCompany);
    } catch {
      throw new Error("This feed was marked JSON, but the response was not a JSON job list.");
    }
  }
  const type = String(contentType || "").toLowerCase();
  const looksXml = type.includes("xml") || type.includes("rss") || /<(rss|feed)\b/i.test(body);
  const looksJson = type.includes("json") || body.startsWith("{") || body.startsWith("[");
  const looksHtml = type.includes("html") || /<html\b/i.test(body) || /<body\b/i.test(body);
  if (looksXml && !looksJson) return listingsFromXml(body, fallbackCompany);
  if (!looksJson && isLoginWall(body.slice(0, 8000))) {
    throw new Error(
      "This address opened a sign-in page. Prefer a public careers page, JSON feed, or RSS/Atom URL that does not require login.",
    );
  }
  if (looksJson) {
    try {
      return listingsFromJson(JSON.parse(body), fallbackCompany);
    } catch {
      // Fall through to HTML/XML attempts.
    }
  }
  if (looksHtml || /JobPosting|\/jobs\/|\/careers\//i.test(body)) {
    const htmlRows = listingsFromHtml(body, fallbackCompany, baseUrl);
    if (htmlRows.length) return htmlRows;
  }
  try {
    return listingsFromJson(JSON.parse(body), fallbackCompany);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("This address opened")) throw error;
    if (body.startsWith("<")) {
      const xmlRows = listingsFromXml(body, fallbackCompany);
      if (xmlRows.length) return xmlRows;
      const htmlRows = listingsFromHtml(body, fallbackCompany, baseUrl);
      if (htmlRows.length) return htmlRows;
    }
    throw new Error(
      "Could not read jobs from that URL. Use a public careers page, JSON job feed, or RSS/Atom feed — login is not required for public sources.",
    );
  }
}

function appears(value, evidence) {
  const text = String(value || "").trim();
  if (text.length < 2) return "";
  return evidence.includes(text.toLowerCase()) ? text : "";
}

export function localPrimary(listing) {
  const description = String(listing.description || "");
  const evidence = `${JSON.stringify(listing)}\n${description}`.toLowerCase();
  const emailMatch = description.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const describedUrl = (description.match(/https?:\/\/[^\s)"']+/i) || [])[0] || "";
  const employer = appears(listing.employer, evidence);
  const company = String(listing.company || "").trim();
  const applyUrl = appears(listing.applyUrl, evidence) || appears(describedUrl, evidence);
  return {
    primaryCompany: employer || company,
    primaryUrl: applyUrl,
    primaryEmail: emailMatch ? appears(emailMatch[0], evidence) : "",
  };
}

export async function resolvePrimary(listing) {
  const evidence = `${JSON.stringify(listing)}\n${listing.description || ""}`.toLowerCase();
  const local = localPrimary(listing);
  const ai = await completeJson(
    "job_primary",
    'Return JSON {"primaryCompany","primaryUrl","primaryEmail"}. Copy each value from the listing. If the listed company is the employer, primaryCompany is that company. Never invent a company, URL, or email.',
    JSON.stringify({
      title: listing.title,
      company: listing.company,
      employer: listing.employer || "",
      applyUrl: listing.applyUrl || "",
      url: listing.sourceUrl || "",
      description: String(listing.description || "").slice(0, 4000),
    }),
  );
  return {
    primaryCompany: appears(ai.json?.primaryCompany, evidence) || local.primaryCompany || listing.company,
    primaryUrl: appears(ai.json?.primaryUrl, evidence) || local.primaryUrl || "",
    primaryEmail: appears(ai.json?.primaryEmail, evidence) || local.primaryEmail || "",
  };
}

export async function fetchFeedListings(source, config) {
  if (!config.url) throw new Error("Add a feed URL before pulling.");
  let response;
  try {
    response = await fetch(config.url, { headers: feedHeaders(config), redirect: "follow", signal: AbortSignal.timeout(20000) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Feed request failed.";
    if (/abort|timeout/i.test(message)) {
      throw new Error("The feed timed out after 20 seconds. Check the URL or try again.");
    }
    throw new Error(`Could not reach the feed. ${message}`);
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error(
      "This source blocked anonymous access (HTTP " +
        response.status +
        "). Prefer a public careers page or public JSON/RSS feed. Only add a token if the publisher documents a public API key.",
    );
  }
  if (!response.ok) throw new Error(`Feed returned HTTP ${response.status}. Check the URL and access settings.`);
  const bodyText = await response.text();
  const listings = parseFeedDocument(
    bodyText,
    response.headers.get("content-type") || "",
    config.employer || source.name,
    config.format || "auto",
    config.url,
  );
  if (!listings.length) {
    const hint = !config.employer
      ? " If listings omit a company name, set “Default employer” on this feed."
      : "";
    throw new Error(`The source responded, but no jobs were found.${hint}`);
  }
  return listings.map((listing) => ({ ...listing, sourceUrl: listing.sourceUrl || config.url }));
}
