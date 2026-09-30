/** Parse pasted job text or a public listing URL into structured fields. */

import { extractRequirements } from "./match.mjs";

const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

export function assertPublicHttpUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value || "").trim());
  } catch {
    throw new Error("Enter a valid http or https job URL.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Job URL must start with http or https.");
  }
  const host = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new Error("That host cannot be imported.");
  }
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.|169\.254\.)/.test(host)) {
    throw new Error("Private network URLs cannot be imported.");
  }
  return parsed.toString();
}

function decodeHtml(value) {
  let current = String(value || "");
  for (let pass = 0; pass < 2; pass += 1) {
    const next = current
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
    if (next === current) break;
    current = next;
  }
  return current;
}

export function htmlToText(html) {
  const decoded = decodeHtml(html);
  return decoded
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<h[1-6][^>]*>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function field(text, names) {
  for (const name of names) {
    const match = text.match(new RegExp(`(?:^|\\n)\\s*${name}\\s*[:\\-]\\s*(.+)`, "i"));
    if (match) return match[1].trim();
  }
  return "";
}

function salaryRange(text) {
  const match = String(text || "").match(/\$?\s?(\d{2,3}(?:,\d{3})?)(?:\s*k)?\s*[-–to]+\s*\$?\s?(\d{2,3}(?:,\d{3})?)(?:\s*k)?/i);
  if (!match) return { salaryMin: null, salaryMax: null };
  const scale = /k/i.test(match[0]) ? 1000 : 1;
  const min = Number(match[1].replace(/,/g, "")) * scale;
  const max = Number(match[2].replace(/,/g, "")) * scale;
  return {
    salaryMin: Number.isFinite(min) ? min : null,
    salaryMax: Number.isFinite(max) ? max : null,
  };
}

function remoteType(text) {
  const blob = String(text || "").toLowerCase();
  if (/\bremote\b/.test(blob)) return "remote";
  if (/\bhybrid\b/.test(blob)) return "hybrid";
  if (/\bonsite\b|\bon-site\b|\bin office\b/.test(blob)) return "onsite";
  return "";
}

/**
 * Turn freeform paste into a job draft.
 */
export function parseJobPaste(input = {}) {
  const sourceUrl = String(input.url || input.sourceUrl || "").trim();
  let text = String(input.text || input.description || "").trim();
  if (!text && !sourceUrl) {
    throw new Error("Paste a job description or a listing URL.");
  }
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  let title = String(input.title || field(text, ["title", "role", "position", "job title"]) || lines[0] || "").trim();
  let company = String(input.company || field(text, ["company", "employer", "organization", "org"]) || "").trim();
  if (!company && lines[1] && lines[1].length < 80 && !/require|responsib|about the/i.test(lines[1])) {
    company = lines[1];
  }
  if (!company) company = "Unknown company";
  if (!title) title = "Untitled role";
  const location = String(input.location || field(text, ["location", "based in", "office"]) || "").trim();
  const description = text
    .split(/\n/)
    .filter((line) => !/^\s*(title|role|position|job title|company|employer|organization|org|location|based in|office)\s*[:\-]\s+/i.test(line))
    .join("\n")
    .trim() || `${title}\n${company}`;
  const pay = salaryRange(description);
  const skillsFromText = extractSkillsFromDescription(description);
  const skills = Array.isArray(input.skills) && input.skills.length ? input.skills.map(String) : skillsFromText;
  const requirements = extractRequirements({
    title,
    description,
    skills,
    role: title,
  });
  return {
    title: title.slice(0, 160),
    company: company.slice(0, 120),
    location: location.slice(0, 120),
    remoteType: remoteType(`${location}\n${description}`),
    description: description.slice(0, 12000),
    skills: skills.slice(0, 16),
    requirements,
    salaryMin: pay.salaryMin,
    salaryMax: pay.salaryMax,
    sourceUrl,
    role: title.slice(0, 80),
  };
}

export function extractSkillsFromDescription(description) {
  const text = String(description || "");
  const skills = [];
  const section = text.match(/(?:requirements|qualifications|must have|what you.?ll need|you have)[:\s]*([\s\S]{0,2500}?)(?:\n\s*\n|responsibilities|about |benefits|nice to have|$)/i);
  const block = section ? section[1] : text;
  const bullets = block.split(/\n+/).map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim()).filter(Boolean);
  for (const bullet of bullets) {
    if (bullet.length < 3 || bullet.length > 48) continue;
    if (/^(the|you|we|our|this|and|with|for)\b/i.test(bullet)) continue;
    if (/[.!?]/.test(bullet) && bullet.length > 30) continue;
    skills.push(bullet.replace(/\.$/, ""));
  }
  const known = [
    "JavaScript",
    "TypeScript",
    "React",
    "Node",
    "Python",
    "SQL",
    "Product management",
    "Figma",
    "AWS",
    "Java",
    "Go",
    "Kubernetes",
    "Excel",
    "A/B testing",
    "User research",
    "Roadmapping",
    "Communication",
    "Leadership",
  ];
  for (const skill of known) {
    if (new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)) skills.push(skill);
  }
  const seen = new Set();
  return skills.filter((skill) => {
    const key = skill.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 16);
}

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function metaContent(html, key) {
  const source = String(html || "");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match) return match[1].trim();
  }
  return "";
}

function tagText(html, tag) {
  const match = String(html || "").match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? htmlToText(match[1]) : "";
}

function cleanTitle(value) {
  return String(value || "")
    .replace(/\s+[|–—-]\s+.*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

function organizationName(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  return String(value.name || "");
}

function locationName(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  const address = value.address;
  const source = address && typeof address === "object" ? address : value;
  if (typeof source === "string") return source;
  const parts = [source.addressLocality, source.addressRegion, source.addressCountry]
    .map((part) => (typeof part === "string" ? part : part?.name || ""))
    .filter(Boolean);
  if (parts.length) return parts.join(", ");
  return String(value.name || source.name || "");
}

function collectJobPostings(node, found) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    node.forEach((item) => collectJobPostings(item, found));
    return;
  }
  const type = node["@type"];
  const types = Array.isArray(type) ? type : [type];
  if (types.some((item) => String(item || "").toLowerCase() === "jobposting")) found.push(node);
  if (node["@graph"]) collectJobPostings(node["@graph"], found);
}

function listingFromFields({ title, company, location, description, url }) {
  const cleanDescription = htmlToText(description || "").slice(0, 20000);
  return {
    url: String(url || ""),
    title: cleanTitle(title),
    company: String(company || "").slice(0, 120),
    location: String(location || "").slice(0, 120),
    text: cleanDescription,
  };
}

export function listingApiUrl(value) {
  let parsed;
  try {
    parsed = new URL(String(value || "").trim());
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const parts = parsed.pathname.split("/").filter(Boolean);
  if ((host === "boards.greenhouse.io" || host === "job-boards.greenhouse.io") && parts[1] === "jobs" && parts[0] && parts[2]) {
    return `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(parts[0])}/jobs/${encodeURIComponent(parts[2])}`;
  }
  if (host === "jobs.lever.co" && parts[0] && parts[1]) {
    return `https://api.lever.co/v0/postings/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}`;
  }
  return null;
}

export function listingFromJson(body, pageUrl = "") {
  let data;
  try {
    data = typeof body === "string" ? JSON.parse(body) : body;
  } catch {
    return null;
  }
  const job = data?.title ? data : data?.job || data?.posting || null;
  if (!job?.title) return null;
  return listingFromFields({
    title: job.title,
    company: organizationName(job.company) || job.company_name || "",
    location: locationName(job.location) || job.categories?.location || "",
    description: job.content || job.descriptionPlain || job.description || "",
    url: job.absolute_url || job.hostedUrl || job.applyUrl || pageUrl,
  });
}

export function extractListingFromHtml(html, pageUrl = "") {
  const source = String(html || "");
  const postings = [];
  for (const match of source.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      collectJobPostings(JSON.parse(match[1]), postings);
    } catch {
      // Ignore broken structured data and keep reading the page.
    }
  }
  const schema = postings[0];
  const schemaListing = schema?.title
    ? listingFromFields({
        title: schema.title,
        company: organizationName(schema.hiringOrganization),
        location: locationName(schema.jobLocation),
        description: schema.description,
        url: schema.url || pageUrl,
      })
    : null;
  if (schemaListing && schemaListing.text.length >= 40) return schemaListing;
  const title = schemaListing?.title || cleanTitle(metaContent(source, "og:title") || tagText(source, "title"));
  const description = metaContent(source, "og:description") || metaContent(source, "description");
  const main = source.match(/<(article|main)[^>]*>([\s\S]*?)<\/\1>/i);
  const pageText = htmlToText(main ? main[2] : source);
  const text = pageText.length >= 40 ? pageText : [description, pageText].filter(Boolean).join("\n\n");
  if (!title && text.length < 40) return null;
  return listingFromFields({
    title,
    company: schemaListing?.company || "",
    location: schemaListing?.location || "",
    description: text,
    url: schemaListing?.url || pageUrl,
  });
}

async function readResponse(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "User-Agent": BROWSER_UA,
      },
    });
    if (!response.ok) throw new Error(`Could not fetch that listing (${response.status}).`);
    const contentType = String(response.headers.get("content-type") || "");
    const body = await response.text();
    return { contentType, body, url: response.url || url };
  } finally {
    clearTimeout(timer);
  }
}

function listingFromBody(body, contentType, pageUrl) {
  const jsonLike = /json/i.test(contentType) || /^\s*[{[]/.test(body);
  if (jsonLike) {
    const listing = listingFromJson(body, pageUrl);
    if (listing?.title && listing.text.length >= 40) return listing;
  }
  if (/html/i.test(contentType) || /<html/i.test(body) || /<script/i.test(body)) {
    return extractListingFromHtml(body, pageUrl);
  }
  const text = String(body || "").trim();
  if (text.length < 40) return null;
  return listingFromFields({ title: "", company: "", location: "", description: text, url: pageUrl });
}

export async function fetchJobUrl(url) {
  const safe = assertPublicHttpUrl(url);
  try {
    const api = listingApiUrl(safe);
    if (api) {
      try {
        const apiResponse = await readResponse(api);
        const fromApi = listingFromBody(apiResponse.body, apiResponse.contentType, safe);
        if (fromApi?.text && fromApi.text.length >= 40) return fromApi;
      } catch {
        // The public board was unreachable. Read the page the user pasted.
      }
    }
    const response = await readResponse(safe);
    const listing = listingFromBody(response.body, response.contentType, response.url || safe);
    if (!listing?.text || listing.text.length < 40) {
      throw new Error("We couldn't read a job posting on that page. Paste the description in the box below and import again.");
    }
    return listing;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("Timed out fetching that listing.");
    throw error instanceof Error ? error : new Error("Could not fetch that listing.");
  }
}
