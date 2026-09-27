import { completeJson } from "./ai-run.mjs";

const AUTH_TYPES = ["none", "bearer", "basic", "header"];
const FORMATS = ["auto", "json", "rss"];

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
    : body?.jobs || body?.data || body?.results || body?.postings || [];
  if (!Array.isArray(list)) return [];
  const rows = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const title = String(item.title || item.text || item.name || item.position || "").trim();
    const named = String(item.company || item.company_name || item.organization || "").trim();
    const employer = String(item.hiring_company || item.hiringCompany || item.client || item.primary_company || item.primaryCompany || "").trim();
    const company = named || String(item.employer || fallbackCompany || "").trim();
    if (!title || !company) continue;
    const applyUrl = String(item.apply_url || item.applyUrl || item.application_url || item.applicationUrl || "").trim();
    const sourceUrl = String(item.url || item.absolute_url || item.hostedUrl || item.link || applyUrl || "").trim();
    rows.push({
      externalKey: String(item.id || item.internal_job_id || `${company}-${title}`).slice(0, 180),
      title,
      company,
      employer,
      location: textOf(item.location) || textOf(item.categories?.location) || String(item.location_name || ""),
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

export function parseFeedDocument(text, contentType, fallbackCompany, format = "auto") {
  const body = String(text || "").trim();
  const looksFeed = /<(rss|feed|item|entry)\b/i.test(body);
  if (/<form\b/i.test(body) && /type=["']password["']/i.test(body) && !looksFeed) {
    throw new Error("This address opened a sign-in page. Use the site's JSON or RSS feed URL, then add the token or username and password that feed expects.");
  }
  if (format === "rss") return listingsFromXml(body, fallbackCompany);
  if (format === "json") {
    try {
      return listingsFromJson(JSON.parse(body), fallbackCompany);
    } catch {
      throw new Error("This feed was marked JSON, but the response was not a JSON job list.");
    }
  }
  const type = String(contentType || "").toLowerCase();
  const looksXml = type.includes("xml") || type.includes("rss") || body.startsWith("<");
  const looksJson = type.includes("json") || body.startsWith("{") || body.startsWith("[");
  if (looksXml && !looksJson) return listingsFromXml(body, fallbackCompany);
  if (!looksJson && /<form[\s\S]{0,800}type=["']password["']/i.test(body.slice(0, 5000))) {
    throw new Error("This address opened a sign-in page. Use the site's JSON or RSS feed URL, then add the token or username and password that feed expects.");
  }
  try {
    return listingsFromJson(JSON.parse(body), fallbackCompany);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("This address opened")) throw error;
    if (body.startsWith("<")) return listingsFromXml(body, fallbackCompany);
    throw new Error("This feed is not a JSON or RSS job list. Paste the feed URL, not a public search page.");
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
    throw new Error(`Could not reach the feed. ${message}`);
  }
  if (response.status === 401 || response.status === 403) {
    throw new Error("This feed requires access. Add the API token or username and password on this feed, then pull again.");
  }
  if (!response.ok) throw new Error(`Feed returned ${response.status}.`);
  const listings = parseFeedDocument(await response.text(), response.headers.get("content-type") || "", config.employer || source.name, config.format || "auto");
  if (!listings.length) throw new Error("The feed responded, but no jobs were in it. Check the URL and the default employer name.");
  return listings.map((listing) => ({ ...listing, sourceUrl: listing.sourceUrl || config.url }));
}
