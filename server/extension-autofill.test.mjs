import assert from "node:assert/strict";
import test from "node:test";
import { isSensitiveField, proposeFills, classifyContactField } from "./extension-autofill.mjs";
import { APPLY_KIT_EVENTS } from "./apply-kit-metrics.mjs";

test("sensitive fields are never proposed for fill", () => {
  assert.equal(isSensitiveField({ name: "password", type: "password" }), true);
  assert.equal(isSensitiveField({ label: "Work authorization" }), true);
  assert.equal(isSensitiveField({ name: "email", type: "email" }), false);
  assert.equal(classifyContactField({ name: "email", type: "email" }), "email");
});

test("proposeFills maps contact kit values and skips blanks/sensitive", () => {
  const proposals = proposeFills(
    [
      { uid: "1", name: "full_name", type: "text", label: "Full name" },
      { uid: "2", name: "email", type: "email", label: "Email" },
      { uid: "3", name: "password", type: "password", label: "Password" },
      { uid: "4", name: "work_auth", type: "text", label: "Work authorization" },
    ],
    {
      contact: [
        { key: "name", value: "Alex Morgan", ready: true },
        { key: "email", value: "alex@example.com", ready: true },
      ],
      resumeText: "",
      answers: [],
    },
  );
  const byId = Object.fromEntries(proposals.map((item) => [item.fieldId, item]));
  assert.equal(byId["1"].value, "Alex Morgan");
  assert.equal(byId["2"].value, "alex@example.com");
  assert.equal(byId["3"].skipped, true);
  assert.equal(byId["3"].value, "");
  assert.equal(byId["4"].skipped, true);
  assert.ok(APPLY_KIT_EVENTS.has("filled"));
});
