import test from "node:test";
import assert from "node:assert/strict";
import { describeTailoring, tailoredDocument, tailoringPreview } from "./resume-guard.mjs";

const original = {
  skills: ["Excel", "Product management", "SQL"],
  employment: [
    { title: "Analyst", employer: "DataCo", bullets: ["Built Excel models"] },
    { title: "Product Manager", employer: "Acme", bullets: ["Owned roadmap", "Shipped SQL dashboards"] },
  ],
};

test("describeTailoring reports reorders and refuses a new skill", () => {
  const match = { matched: ["Product management", "SQL"], preferredMatched: [], label: "good" };
  const facts = [{ statement: "Product management" }, { statement: "SQL" }, { statement: "Acme" }];
  const next = tailoredDocument(original, { title: "Product Manager", company: "Northstar" }, match, facts);
  const described = describeTailoring(original, next);
  assert.match(described.summary, /Reordered your resume for Product Manager at Northstar/);
  assert.match(described.summary, /No new employers, dates, or skills were added/);
  assert.ok(described.changes.some((change) => change.kind === "skills" && change.detail.includes("Product management")));
  assert.ok(described.changes.some((change) => change.kind === "role" && change.after === "Product Manager at Acme"));
  assert.ok(described.changes.some((change) => change.kind === "bullet" && change.after === "Shipped SQL dashboards"));
  const invented = {
    ...next,
    skills: ["Kubernetes", ...next.skills],
  };
  const rejected = describeTailoring(original, invented);
  assert.equal(rejected.changes.some((change) => change.kind === "skills"), false);
  assert.equal(rejected.changes.some((change) => /Kubernetes/.test(change.detail)), false);
});

test("describeTailoring stays quiet when the resume already leads with the match", () => {
  const same = {
    ...original,
    target: { company: "Northstar", title: "Product Manager" },
  };
  const described = describeTailoring(original, same);
  assert.equal(described.changes.length, 0);
  assert.match(described.summary, /already leads/);
  assert.match(described.summary, /Nothing new was added/);
});

test("tailoringPreview reads the parent resume and skips other kinds", () => {
  const parent = { id: "ver_parent", kind: "upload", document: JSON.stringify(original) };
  const tailored = tailoredDocument(
    original,
    { title: "Product Manager", company: "Northstar" },
    { matched: ["SQL"], preferredMatched: [], label: "good" },
    [{ statement: "SQL" }, { statement: "Acme" }],
  );
  const version = {
    id: "ver_job",
    kind: "application",
    label: "For Northstar — Product Manager",
    parent_id: "ver_parent",
    document: JSON.stringify(tailored),
    rendered: "Product Manager\n\nSkills\nSQL, Product management, Excel",
  };
  const preview = tailoringPreview(version, [parent, version]);
  assert.equal(preview.label, "For Northstar — Product Manager");
  assert.match(preview.rendered, /SQL/);
  assert.ok(preview.changes.length > 0);
  assert.equal(tailoringPreview({ ...version, kind: "upscale" }, [parent, version]), null);
});
