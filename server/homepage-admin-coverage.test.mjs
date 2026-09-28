import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("admin homepage editor covers every landing CMS section", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const editor = readFileSync(join(here, "..", "src", "pages", "admin", "HomepageEditor.tsx"), "utf8");
  const homepage = JSON.parse(readFileSync(join(here, "..", "shared", "homepage.json"), "utf8"));

  for (const section of [
    "hero",
    "trust",
    "stats",
    "how",
    "fit",
    "efficiency",
    "better",
    "results",
    "stories",
    "pricing",
    "cta",
    "footer",
  ]) {
    assert.ok(section in homepage, `homepage.json missing ${section}`);
    assert.match(editor, new RegExp(`id=\"home-${section}\"`), `Admin editor missing section #home-${section}`);
  }

  assert.match(editor, /Add testimonial/);
  assert.match(editor, /Floating job cards/);
  assert.match(editor, /Trust strip/);
  assert.match(editor, /Testimonials/);
});
