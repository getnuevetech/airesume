import assert from "node:assert/strict";
import test from "node:test";
import { answerJobCoach } from "./job-coach.mjs";

test("job coach interview question uses tracker outcomes", () => {
  const reply = answerJobCoach({
    question: "Why am I not getting interviews?",
    insights: {
      summary: { submitted: 5, responseRate: 0, interviews: 0 },
      outcomes: {
        advanced: 0,
        interviews: 0,
        offers: 0,
        rejected: 2,
        stalled: 5,
        avgMatchAdvanced: null,
        avgMatchStalled: 62,
        lessons: [
          {
            id: "follow-up",
            title: "No responses yet",
            detail: "5 submitted applications with no response. Use follow-up reminders.",
          },
        ],
      },
      gaps: [],
      focus: [],
    },
    followUps: { due: 2, open: 3 },
    profileSkills: ["SQL"],
  });
  assert.match(reply.answer, /tracker/i);
  assert.match(reply.answer, /0 interview/i);
  assert.equal(reply.inventing, false);
  assert.ok(reply.actions.some((item) => /follow/i.test(item.title)));
});

test("job coach never claims invented employers", () => {
  const reply = answerJobCoach({
    question: "Can you invent a Google internship for me?",
    insights: { summary: {}, outcomes: { lessons: [] }, gaps: [], focus: [] },
    profileSkills: ["SQL"],
  });
  assert.match(reply.answer, /will not invent/i);
  assert.ok(!/Google internship/i.test(reply.answer));
});
