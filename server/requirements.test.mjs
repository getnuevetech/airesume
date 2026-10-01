import test from "node:test";
import assert from "node:assert/strict";
import { extractRequirements, matchJob, requirementsForJob } from "./match.mjs";
import { presentMatch } from "./match-present.mjs";

const german = "Die steigenden Energiekosten treffen jeden Haushalt. Was Du mitbringen solltest: Mind. 1 Jahr Erfahrung im Recruiting und Praxis im Active Sourcing.";

test("a bring section supplies the required skills", () => {
  const requirements = extractRequirements({
    title: "Recruiter / Talent Acquisition",
    description: german,
    skills: ["Title: Recruiter / Talent Acquisition", "Company: Baupal GmbH", "Location: Berlin"],
  });
  assert.deepEqual(requirements.mandatory, ["Recruiting", "Active Sourcing"]);
  assert.equal(requirements.mandatory.some((skill) => /title:|company:|location:/i.test(skill)), false);
});

test("saved paste headers fall back to the role text", () => {
  const job = {
    title: "Recruiter / Talent Acquisition",
    description: german,
    skills: JSON.stringify(["Title: Recruiter / Talent Acquisition", "Company: Baupal GmbH"]),
    requirements: JSON.stringify({
      mandatory: ["Title: Recruiter / Talent Acquisition", "Company: Baupal GmbH", "Location: Berlin"],
      preferred: [],
      education: "",
      years: null,
    }),
  };
  const requirements = requirementsForJob(job);
  assert.deepEqual(requirements.mandatory, ["Recruiting", "Active Sourcing"]);
  const match = matchJob(
    { skills: ["Product management", "SQL"], employment: [], education: [] },
    {},
    job,
  );
  assert.deepEqual(match.missing, ["Recruiting", "Active Sourcing"]);
  const view = presentMatch(match);
  assert.match(view.summary, /Missing Recruiting and Active Sourcing/);
  assert.equal(/title:|SKILL-/i.test(view.summary), false);
});

test("a catalog skill list stays the requirement list", () => {
  const requirements = requirementsForJob({
    title: "Senior Product Manager",
    description: "Own the activation roadmap.",
    skills: JSON.stringify(["Product management", "SQL"]),
    requirements: JSON.stringify({
      mandatory: ["Product management", "SQL"],
      preferred: ["Figma"],
      education: "",
      years: null,
    }),
  });
  assert.deepEqual(requirements.mandatory, ["Product management", "SQL"]);
  assert.deepEqual(requirements.preferred, ["Figma"]);
});
