import assert from "node:assert/strict";
import { cleanResumeText, deterministicExtract, looksCorrupt, reviewExtraction } from "./extract.mjs";
import { listingsFromHtml, parseFeedDocument } from "./feeds.mjs";

const garbled = "£k·û≡ëmWfdv°MÞ≡¼÷]úDÓ`û";
assert.equal(looksCorrupt(garbled), true);
assert.equal(looksCorrupt("Rasheed O. Kareem"), false);

const messy = `${garbled}
US Address
Email: oolomola@gmail.com
Phone: +1 832 362 8238
1550 Katy Gap Road, Apt 2907
Katy, TX

Summary
An experienced Information Systems Management Technology professional with over 10 years of industry-tested experience.

Skills
AWS, Cisco, React

Experience
IT Manager, Thorpe Technologies
Managed call centre deployment
`;

const cleaned = cleanResumeText(messy);
assert.ok(!cleaned.includes("≡"));
assert.ok(cleaned.includes("oolomola@gmail.com"));

const reviewed = reviewExtraction(
  {
    name: "凶ðï¾4×5½òï⋊≡5ΞΕΞΞäΞοH",
    email: "oolomola@gmail.com",
    phone: "+1 832 362 8238, 08027759386",
    address: "Ø⋇:Ξñ⬠¦☒W@·☒ãF¡Z9☒Đ☒",
    city: "US Address",
    summary: "An experienced Information Systems Management Technology professional with over 10 years of industry-tested experience.",
    skills: ["AWS", "Cisco"],
    employment: [{ title: "IT Manager", employer: "Thorpe Technologies", dates: "Jan 2 at 2015 – Date", bullets: ["Managed call centre deployment"] }],
    education: [],
    facts: [],
  },
  messy,
);

assert.equal(reviewed.email, "oolomola@gmail.com");
assert.equal(reviewed.phone, "+1 832 362 8238");
assert.equal(reviewed.city, "Katy, TX");
assert.equal(reviewed.address, "1550 Katy Gap Road, Apt 2907");
assert.notEqual(reviewed.name, "US Address");
assert.ok(!looksCorrupt(reviewed.name || "ok"));
assert.ok(reviewed.facts.every((fact) => !looksCorrupt(fact.statement)));
assert.ok(reviewed.warnings.some((warning) => /email|name|removed/i.test(warning)) || reviewed.email);

const named = reviewExtraction(
  {
    name: "Rasheed O. Kareem",
    email: "jenkskareem@gmail.com",
    phone: "8323618238",
    address: "1550 Katy Gap Road, Apt 2907",
    city: "Katy",
    summary: "To join an Organization with aligned focus.",
    skills: ["AWS"],
    employment: [{ title: "IT Manager", employer: "Magnetic Autos", dates: "", bullets: [] }],
    education: [],
    facts: [],
  },
  `Rasheed O. Kareem
jenkskareem@gmail.com
8323618238
1550 Katy Gap Road, Apt 2907
Katy, TX
Summary
To join an Organization with aligned focus.
Skills
AWS
Experience
IT Manager, Magnetic Autos
`,
);
assert.equal(named.name, "Rasheed O. Kareem");
assert.equal(named.email, "jenkskareem@gmail.com");

const det = deterministicExtract(cleanResumeText(`Alex Rivera
alex@example.com
(555) 111-2222
Austin, TX
Summary
Product manager with SQL experience.
Skills
SQL, React
Experience
Product Manager, Acme
Shipped roadmap items
`));
assert.equal(det.name, "Alex Rivera");
assert.equal(det.email, "alex@example.com");

const html = `
<html><body>
<script type="application/ld+json">{"@type":"JobPosting","title":"Network Engineer","url":"https://example.com/jobs/1","hiringOrganization":{"name":"Acme"},"description":"Cisco routing"}</script>
<a href="/jobs/2">Platform Engineer</a>
</body></html>`;
const htmlJobs = listingsFromHtml(html, "Acme", "https://example.com/careers");
assert.ok(htmlJobs.some((job) => job.title === "Network Engineer"));
assert.ok(htmlJobs.some((job) => job.title === "Platform Engineer"));
assert.ok(parseFeedDocument(html, "text/html", "Acme", "html", "https://example.com").length >= 1);

console.log("extract-and-feeds checks passed");
