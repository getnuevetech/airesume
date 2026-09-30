import test from "node:test";
import assert from "node:assert/strict";
import { decideIntake, localJobUsefulness } from "./job-intake.mjs";

const linkedInLogin = {
  title: "LinkedIn Login, Sign in | LinkedIn",
  company: "LinkedIn",
  description: `LinkedIn Login, Sign in | LinkedIn Sign in Sign in with Apple Sign in with a passkey By clicking Continue, you agree to LinkedIn’s User Agreement, Privacy Policy, and Cookie Policy. Forgot password?
Keep me logged in Sign in We've emailed a one-time link to your primary email address.
User Agreement Privacy Policy Cookie Policy Language العربية Español Français Deutsch Português 中文 日本語 हिंदी`,
};

test("a LinkedIn sign-in page is not stored as a job", () => {
  const decision = localJobUsefulness(linkedInLogin);
  assert.equal(decision.useful, false);
  assert.match(decision.reasons.join(" "), /sign-in page|login or legal page/);
});

test("a real role with duties is useful", () => {
  const decision = localJobUsefulness({
    title: "Senior Product Manager",
    company: "Northstar",
    description: "Own the activation roadmap. Requirements: SQL and experiment design. Full-time. See our Privacy Policy.",
  });
  assert.equal(decision.useful, true);
  assert.equal(decision.reasons.length, 0);
});

test("a short catalog blurb without login language stays useful", () => {
  const decision = localJobUsefulness({
    title: "Software Engineer",
    company: "Relay",
    description: "Ship the web app used by operations teams.",
  });
  assert.equal(decision.useful, true);
});

test("a login page that mentions full-time is still not a job", () => {
  const decision = localJobUsefulness({
    ...linkedInLogin,
    description: `${linkedInLogin.description}\nSchedule: full-time`,
  });
  assert.equal(decision.useful, false);
});

test("a search results title is not one job", () => {
  const decision = localJobUsefulness({
    title: "1,000+ Product Manager jobs in United States",
    company: "LinkedIn",
    description: "Product Manager jobs. See all jobs. Sign in to view more.",
  });
  assert.equal(decision.useful, false);
  assert.match(decision.reasons.join(" "), /list of openings|login or legal/);
});

test("a model cannot approve a login wall, and can hold a page the rules allowed", () => {
  const blocked = decideIntake(localJobUsefulness(linkedInLogin), { useful: true, reason: "Looks fine." });
  assert.equal(blocked.useful, false);
  const held = decideIntake(
    { useful: true, reasons: [] },
    { useful: false, reason: "This is a company homepage, not an open role." },
  );
  assert.equal(held.useful, false);
  assert.match(held.reasons.join(" "), /homepage/);
});
