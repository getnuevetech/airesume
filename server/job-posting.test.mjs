import test from "node:test";
import assert from "node:assert/strict";
import { compareJobRank, presentJobPosting } from "./job-posting.mjs";
import { extractListingFromHtml, listingApiUrl, listingFromJson, parseJobPaste } from "./job-import.mjs";

const wall = "Die steigenden Energiekosten treffen jeden Haushalt. Wir senken, was gerade am meisten wehtut. Die Fakten. Start: 15.10. Gehalt: €40.000–50.000 brutto pro Jahr Arbeitszeit: Vollzeit (40h/w) und flexible Arbeitszeiten Standort: Büro an der Spree, Berlin Benefits: Learning-Budget; Jobticket; Kita-Zuschuss Du gestaltest mit unserem People Lead das Wachstum unseres Sales Teams. End-to-End Recruiting mit Fokus auf Sales-Positionen. Was Du mitbringen solltest: Mind. 1 Jahr Erfahrung im Recruiting und Praxis im Active Sourcing.";

test("a one-line posting splits into a summary, facts, and sections", () => {
  const posting = presentJobPosting(wall, { location: "Berlin" });
  assert.match(posting.summary, /Energiekosten/);
  assert.ok(posting.summary.length < wall.length / 2);
  assert.ok(posting.facts.some((fact) => fact.label === "Pay" && fact.value.includes("40.000")));
  assert.ok(posting.facts.some((fact) => fact.label === "Schedule" && /Vollzeit/.test(fact.value)));
  assert.equal(posting.facts.some((fact) => fact.label === "Location"), false);
  assert.ok(posting.sections.some((section) => section.heading === "Benefits" && section.items.includes("Jobticket")));
  assert.ok(posting.sections.some((section) => section.heading === "What you bring"));
  const rendered = [posting.summary, ...posting.sections.flatMap((section) => [...section.paragraphs, ...section.items])].join(" ");
  assert.equal(rendered.includes(wall), false);
  assert.ok(posting.sections.every((section) => section.paragraphs.every((paragraph) => paragraph.length < 500)));
});

test("section headings and bullets stay separate", () => {
  const posting = presentJobPosting(`GitLab builds software. Teams ship faster.\n\nWhat you'll do\n- Diagnose the real problem before writing code.\n- Ship a working prototype in days.\n\nWhat you'll bring\n- Python and REST APIs.`);
  const role = posting.sections.find((section) => section.heading === "The role");
  const bring = posting.sections.find((section) => section.heading === "What you bring");
  assert.ok(role?.items.some((item) => /Diagnose/.test(item)));
  assert.ok(bring?.items.some((item) => /Python/.test(item)));
  assert.match(posting.summary, /GitLab builds/);
});

test("imported jobs sort ahead of a stronger catalog match", () => {
  const userId = "usr_abc";
  const ranked = [
    { title: "Catalog", external_key: "gh-1", score: 99 },
    { title: "Older import", external_key: `paste-${userId}-1000`, score: 10 },
    { title: "Newer import", external_key: `paste-${userId}-2000`, score: 10 },
    { title: "Someone else", external_key: "paste-usr_other-3000", score: 95 },
  ].sort((a, b) => compareJobRank(a, b, userId));
  assert.deepEqual(ranked.map((job) => job.title), ["Newer import", "Older import", "Catalog", "Someone else"]);
});

test("a normal job page is read from structured data, not the navigation", () => {
  const html = `<html><head><title>Jobs | Baupal</title>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Recruiter / Talent Acquisition","description":"<p>Die steigenden Energiekosten treffen jeden Haushalt. Wir suchen einen Recruiter für Sales.</p>","hiringOrganization":{"@type":"Organization","name":"Baupal GmbH"},"jobLocation":{"address":{"addressLocality":"Berlin","addressCountry":"DE"}}}
    </script></head>
    <body><nav>Skip to content Cookie settings Sign in</nav></body></html>`;
  const listing = extractListingFromHtml(html, "https://example.com/jobs/recruiter");
  assert.equal(listing.title, "Recruiter / Talent Acquisition");
  assert.equal(listing.company, "Baupal GmbH");
  assert.match(listing.location, /Berlin/);
  assert.match(listing.text, /Recruiter für Sales/);
  assert.equal(listing.title.includes("Skip to content"), false);
});

test("an ordinary careers page still yields a title and the article text", () => {
  const html = `<html><head>
    <meta property="og:title" content="Account Executive - Northstar" />
    <meta name="description" content="Own the pipeline." />
    </head><body><header>Menu Pricing Login</header>
    <article><h1>Account Executive</h1><p>Own the full sales cycle for mid-market teams and write a weekly forecast.</p></article>
    </body></html>`;
  const listing = extractListingFromHtml(html, "https://northstar.example/careers/ae");
  assert.equal(listing.title, "Account Executive");
  assert.match(listing.text, /weekly forecast/);
  assert.equal(/Menu Pricing Login/.test(listing.text), false);
});

test("escaped job HTML becomes readable text and field labels stay out of the description", () => {
  const listing = listingFromJson(
    {
      title: "AI Engineer",
      company_name: "GitLab",
      location: { name: "Remote" },
      content: "&lt;div class=&quot;content-intro&quot;&gt;&lt;p&gt;GitLab enables organizations to increase developer productivity.&lt;/p&gt;&lt;h2&gt;Requirements&lt;/h2&gt;&lt;ul&gt;&lt;li&gt;Python&lt;/li&gt;&lt;/ul&gt;&lt;/div&gt;",
    },
    "https://job-boards.greenhouse.io/gitlab/jobs/1",
  );
  assert.equal(listing.text.includes("<div"), false);
  assert.equal(listing.text.includes("&lt;"), false);
  assert.match(listing.text, /developer productivity/);
  assert.match(listing.text, /Python/);
  const draft = parseJobPaste({
    text: `Title: AI Engineer\nCompany: GitLab\n${listing.text}`,
    title: "AI Engineer",
    company: "GitLab",
  });
  assert.equal(draft.description.includes("Title:"), false);
  assert.equal(draft.skills.includes("Title: AI Engineer"), false);
});

test("employer board links map to the public job document", () => {
  assert.equal(
    listingApiUrl("https://boards.greenhouse.io/baupal/jobs/4455"),
    "https://boards-api.greenhouse.io/v1/boards/baupal/jobs/4455",
  );
  assert.equal(
    listingApiUrl("https://jobs.lever.co/northstar/abc-123"),
    "https://api.lever.co/v0/postings/northstar/abc-123",
  );
  assert.equal(listingApiUrl("https://example.com/careers/recruiter"), null);
  const listing = listingFromJson(
    JSON.stringify({ title: "Recruiter", content: "<p>Run sourcing for the sales team and keep a clean pipeline.</p>", location: { name: "Berlin" } }),
    "https://boards.greenhouse.io/baupal/jobs/4455",
  );
  assert.equal(listing.title, "Recruiter");
  assert.match(listing.text, /clean pipeline/);
  assert.equal(listing.location, "Berlin");
});
