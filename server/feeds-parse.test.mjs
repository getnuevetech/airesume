import assert from "node:assert/strict";
import test from "node:test";
import { listingsFromJson, parseFeedDocument } from "./feeds.mjs";

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
