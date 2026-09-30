/** Verified public job feeds that JobPilot can pull without login. */

export const EXAMPLE_FEEDS = [
  {
    name: "Remotive remote jobs",
    url: "https://remotive.com/api/remote-jobs",
    format: "json",
    employer: "",
    detail: "Public Remotive JSON API — remote roles across many employers.",
  },
  {
    name: "Arbeitnow job board",
    url: "https://www.arbeitnow.com/api/job-board-api",
    format: "json",
    employer: "",
    detail: "Public Arbeitnow JSON API — mostly EU tech roles.",
  },
  {
    name: "RemoteOK",
    url: "https://remoteok.com/api",
    format: "json",
    employer: "",
    detail: "Public RemoteOK JSON API — remote listings (link back required by their terms).",
  },
  {
    name: "Jobicy remote jobs",
    url: "https://jobicy.com/api/v2/remote-jobs?count=50",
    format: "json",
    employer: "",
    detail: "Public Jobicy JSON API — remote postings.",
  },
  {
    name: "Greenhouse · Stripe",
    url: "https://boards.greenhouse.io/stripe",
    format: "auto",
    employer: "Stripe",
    detail: "Greenhouse board page (auto-uses boards-api.greenhouse.io).",
  },
  {
    name: "Ashby · Notion",
    url: "https://jobs.ashbyhq.com/notion",
    format: "auto",
    employer: "Notion",
    detail: "Ashby careers page (auto-uses Ashby posting API).",
  },
];

export const SUPPORTED_FEED_HINTS = [
  "Public JSON APIs: remotive.com/api/remote-jobs, arbeitnow.com/api/job-board-api, remoteok.com/api, jobicy.com/api/v2/remote-jobs",
  "Employer boards: boards.greenhouse.io/{slug}, jobs.lever.co/{slug}, jobs.ashbyhq.com/{slug}",
  "Not supported: Indeed, LinkedIn, ZipRecruiter, Glassdoor search pages",
];
