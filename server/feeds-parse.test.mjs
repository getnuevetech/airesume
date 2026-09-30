import assert from "node:assert/strict";
import test from "node:test";
import { EXAMPLE_FEEDS, SUPPORTED_FEED_HINTS } from "./example-feeds.mjs";
import {
  feedFetchPlan,
  listingsFromJson,
  normalizeFeedUrl,
  parseFeedDocument,
  publicBoardApiUrl,
  unsupportedJobSiteMessage,
} from "./feeds.mjs";

test("listingsFromJson accepts Greenhouse-style jobs without company when fallback is set", () => {
  const rows = listingsFromJson(
    {
      jobs: [
        { id: 11, title: "Platform Engineer", absolute_url: "https://boards.greenhouse.io/acme/jobs/11", location: { name: "Remote" } },
        { id: 12, title: "", absolute_url: "https://boards.greenhouse.io/acme/jobs/12" },
      ],
    },
    "Acme",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].company, "Acme");
  assert.equal(rows[0].title, "Platform Engineer");
  assert.equal(rows[0].sourceUrl, "https://boards.greenhouse.io/acme/jobs/11");
});

test("listingsFromJson reads Remotive, Arbeitnow, RemoteOK, and Jobicy shapes", () => {
  const remotive = listingsFromJson(
    {
      jobs: [
        {
          id: 1,
          title: "Remote Nurse",
          company_name: "CareCo",
          url: "https://remotive.com/jobs/1",
          candidate_required_location: "USA",
          tags: ["nursing"],
        },
      ],
    },
    "",
  );
  assert.equal(remotive[0].company, "CareCo");
  assert.equal(remotive[0].location, "USA");

  const arbeitnow = listingsFromJson(
    {
      data: [
        {
          slug: "eng-berlin",
          title: "Backend Engineer",
          company_name: "Preiswecker",
          url: "https://example.com/jobs/1",
          location: "Berlin",
          remote: true,
          tags: ["Software"],
        },
      ],
    },
    "",
  );
  assert.equal(arbeitnow[0].company, "Preiswecker");
  assert.equal(arbeitnow[0].remoteType, "remote");

  const remoteok = listingsFromJson(
    [
      { legal: "notice" },
      {
        id: "99",
        position: "Director Payment Integrity",
        company: "SIHO",
        url: "https://remoteok.com/remote-jobs/99",
        location: "Remote",
        tags: ["exec"],
      },
    ],
    "",
  );
  assert.equal(remoteok.length, 1);
  assert.equal(remoteok[0].title, "Director Payment Integrity");
  assert.equal(remoteok[0].company, "SIHO");

  const jobicy = listingsFromJson(
    {
      jobs: [
        {
          id: "154",
          jobTitle: "Director of People Operations",
          companyName: "Tekmetric",
          url: "https://jobicy.com/jobs/154",
          jobGeo: "USA",
          jobIndustry: ["HR"],
        },
      ],
    },
    "",
  );
  assert.equal(jobicy[0].title, "Director of People Operations");
  assert.equal(jobicy[0].company, "Tekmetric");
  assert.equal(jobicy[0].location, "USA");
});

test("listingsFromJson reads Ashby postings with default employer", () => {
  const rows = listingsFromJson(
    {
      jobs: [
        {
          id: "abc",
          title: "Software Engineer",
          jobUrl: "https://jobs.ashbyhq.com/notion/abc",
          location: "San Francisco",
          workplaceType: "Remote",
          descriptionPlain: "Build products",
        },
      ],
    },
    "Notion",
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].company, "Notion");
  assert.equal(rows[0].sourceUrl, "https://jobs.ashbyhq.com/notion/abc");
  assert.equal(rows[0].remoteType, "Remote");
});

test("parseFeedDocument auto mode reads JSON job lists", () => {
  const body = JSON.stringify({
    results: [{ title: "Data Analyst", company: "Northwind", url: "https://example.com/jobs/1" }],
  });
  const rows = parseFeedDocument(body, "application/json", "Fallback", "auto", "https://example.com/feed.json");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, "Data Analyst");
});

test("parseFeedDocument html format surfaces a clear empty error", () => {
  assert.throws(
    () => parseFeedDocument("<html><body><p>No openings</p></body></html>", "text/html", "Acme", "html", "https://example.com"),
    /No public job listings/,
  );
});

test("publicBoardApiUrl maps Greenhouse, Lever, and Ashby careers pages", () => {
  assert.equal(
    publicBoardApiUrl("https://boards.greenhouse.io/stripe"),
    "https://boards-api.greenhouse.io/v1/boards/stripe/jobs?content=true",
  );
  assert.equal(
    publicBoardApiUrl("https://boards.greenhouse.io/embed/job_board?for=acme"),
    "https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true",
  );
  assert.equal(
    publicBoardApiUrl("https://jobs.lever.co/netflix"),
    "https://api.lever.co/v0/postings/netflix?mode=json",
  );
  assert.equal(
    publicBoardApiUrl("https://jobs.ashbyhq.com/openai"),
    "https://api.ashbyhq.com/posting-api/job-board/openai",
  );
  assert.equal(publicBoardApiUrl("https://boards-api.greenhouse.io/v1/boards/stripe/jobs"), null);
  assert.equal(publicBoardApiUrl("https://example.com/careers"), null);
});

test("feedFetchPlan prefers public board API before the HTML careers URL", () => {
  const plan = feedFetchPlan("https://boards.greenhouse.io/acme/");
  assert.equal(plan[0].url, "https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true");
  assert.equal(plan[0].formatHint, "json");
  assert.ok(plan.some((item) => item.url.includes("boards.greenhouse.io/acme")));
});

test("unsupported aggregators are rejected with a clear message", () => {
  assert.match(unsupportedJobSiteMessage("https://www.indeed.com/jobs?q=nurse"), /Indeed/);
  assert.match(unsupportedJobSiteMessage("https://www.linkedin.com/jobs/"), /LinkedIn/);
  assert.equal(unsupportedJobSiteMessage("https://remotive.com/api/remote-jobs"), "");
  assert.throws(() => normalizeFeedUrl("https://www.indeed.com/jobs?q=x"), /Indeed/);
  assert.equal(normalizeFeedUrl("https://remotive.com/api/remote-jobs"), "https://remotive.com/api/remote-jobs");
});

test("example feeds cover verified public sources", () => {
  assert.ok(EXAMPLE_FEEDS.length >= 4);
  const urls = EXAMPLE_FEEDS.map((item) => item.url);
  assert.ok(urls.some((url) => /remotive\.com/.test(url)));
  assert.ok(urls.some((url) => /arbeitnow\.com/.test(url)));
  assert.ok(urls.some((url) => /remoteok\.com/.test(url)));
  assert.ok(urls.some((url) => /jobicy\.com/.test(url)));
  assert.ok(urls.some((url) => /greenhouse\.io/.test(url)));
  assert.ok(urls.some((url) => /ashbyhq\.com/.test(url)));
  for (const feed of EXAMPLE_FEEDS) {
    assert.equal(normalizeFeedUrl(feed.url), normalizeFeedUrl(feed.url));
  }
  assert.ok(SUPPORTED_FEED_HINTS.some((hint) => /Indeed/i.test(hint)));
});
