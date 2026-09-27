export type User = {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  provider: "email" | "google";
  role?: "user" | "admin";
  status?: string;
  planId?: string;
};

export type ResumeFile = {
  name: string;
  size: number;
  text: string | null;
  uploadedAt: number;
};

export type PlanId = "free" | "pro" | "autopilot";
export type Billing = "monthly" | "yearly";
export type JobLogo = "spotify" | "hubspot" | "notion";
export type JobStatus = "applied" | "applying" | "match";

export type Job = {
  id: string;
  title: string;
  company: string;
  logo: JobLogo;
  status: JobStatus;
  match: number;
};

export type Story = {
  id: string;
  name: string;
  role: string;
  quote: string;
  detail: string;
  avatar: string;
};

export const stories: Story[] = [
  {
    id: "priya",
    name: "Priya S.",
    role: "Product Designer",
    quote:
      "JobPilot made my job search so much easier. I got 4 interviews in 3 weeks!",
    detail:
      "Priya uploaded a single portfolio resume on a Sunday. JobPilot tailored the summary for product design roles and kept a short list of teams that matched her systems and research work. Four interviews followed in three weeks.",
    avatar: "/images/avatar-priya.png",
  },
  {
    id: "marcus",
    name: "Marcus T.",
    role: "Software Engineer",
    quote:
      "The tailored resumes and auto-applying saved me hours. I landed a great role!",
    detail:
      "Marcus was applying after work and losing evenings to form fields. Tailored resumes and autopilot applications gave him that time back, and he accepted a role that matched his stack.",
    avatar: "/images/avatar-marcus.png",
  },
  {
    id: "elena",
    name: "Elena R.",
    role: "Marketing Specialist",
    quote: "Simple to use and actually works. I finally have a job I love.",
    detail:
      "Elena wanted a search that felt straightforward. She dropped in her resume, reviewed the matches, and let JobPilot handle the repetitive applications. She now leads campaigns on a team she enjoys.",
    avatar: "/images/avatar-elena.png",
  },
];

export const previewJobs: Job[] = [
  {
    id: "pm",
    title: "Product Manager",
    company: "Spotify",
    logo: "spotify",
    status: "applied",
    match: 96,
  },
  {
    id: "se",
    title: "Software Engineer",
    company: "HubSpot",
    logo: "hubspot",
    status: "applying",
    match: 91,
  },
  {
    id: "da",
    title: "Data Analyst",
    company: "Notion",
    logo: "notion",
    status: "match",
    match: 92,
  },
];

export const plans: {
  id: PlanId;
  name: string;
  monthly: number;
  yearly: number;
  blurb: string;
  features: string[];
  cta: string;
  popular?: boolean;
}[] = [
  {
    id: "free",
    name: "Free",
    monthly: 0,
    yearly: 0,
    blurb: "See how your resume matches before you commit.",
    features: [
      "1 resume upload",
      "Profile built in the browser",
      "3 preview matches",
      "Basic keyword notes",
    ],
    cta: "Get started",
  },
  {
    id: "pro",
    name: "Pro",
    monthly: 19,
    yearly: 15,
    blurb: "A stronger resume for every role you care about.",
    features: [
      "Unlimited tailored resumes",
      "Keyword optimization",
      "Higher-match suggestions",
      "Application tracker",
    ],
    cta: "Choose Pro",
    popular: true,
  },
  {
    id: "autopilot",
    name: "Autopilot",
    monthly: 49,
    yearly: 39,
    blurb: "We prepare the application and run the search for you.",
    features: [
      "Everything in Pro",
      "Auto-apply preview",
      "Role-by-role tailoring",
      "Weekly search summary",
    ],
    cta: "Start Autopilot",
  },
];

export const posts = [
  {
    slug: "tailor-a-resume-in-ten-minutes",
    title: "How to tailor a resume in 10 minutes",
    date: "September 12, 2026",
    excerpt:
      "A repeatable pass that keeps your story intact and lines the wording up with the role.",
    minutes: 4,
    body: [
      "Start with the role, not a blank page. Read the first screen of the posting and underline the outcomes they repeat: shipping, analysis, research, pipeline, or whatever the team actually does.",
      "Keep your experience in the same order. Change the summary and the first bullet under each recent role so a stranger can see the overlap in one glance. You are translating, not inventing.",
      "Mirror a few exact phrases when they are true for you. If the posting says “experiment design” and you ran A/B tests, use their words once, then your evidence.",
      "Cut anything that does not help this reader. A ten-minute pass is mostly deletion plus a sharper first paragraph. JobPilot does that pass for each match so you are not rewriting from scratch at midnight.",
    ],
  },
  {
    slug: "what-match-rate-means",
    title: "What a match rate actually tells you",
    date: "August 28, 2026",
    excerpt:
      "A percentage is a hint about overlap, not a promise that you will get the job.",
    minutes: 3,
    body: [
      "Match rate compares words and themes in your resume with the role. A 92% match means the skills, tools, and responsibilities line up closely. It does not know how much the team liked your portfolio.",
      "Use it to sort, not to spiral. High matches are worth a tailored resume. Mid matches are worth a look if the work is interesting. Very low matches are usually a different craft.",
      "Raise the rate by being specific. “Improved activation” is weaker than “launched a matching feature that increased activation by 18%.” Numbers and tool names are what the comparison can see.",
    ],
  },
  {
    slug: "prepare-while-applications-run",
    title: "Prepare for interviews while applications run",
    date: "August 4, 2026",
    excerpt:
      "The search should not take the hours you need for stories, references, and rest.",
    minutes: 4,
    body: [
      "The slow part of a search is rarely the click. It is remembering a project well enough to talk about it, lining up references, and deciding what you want next.",
      "Once your resume is in, block one short session for stories. Pick three projects and write the situation, what you did, and what changed. Those notes beat another hour of forms.",
      "Autopilot is there so the repetitive applications continue while you do that work. Review the list when you want to, and spend the saved time on the conversations.",
    ],
  },
];

export const demoGoogleAccounts = [
  { name: "Priya Shah", email: "priya.shah@gmail.com" },
  { name: "Alex Morgan", email: "alex.morgan@gmail.com" },
];

const SKILLS: { label: string; pattern: RegExp }[] = [
  { label: "Product management", pattern: /product manage/i },
  { label: "SQL", pattern: /\bSQL\b/ },
  { label: "Figma", pattern: /figma/i },
  { label: "User research", pattern: /user research/i },
  { label: "Data analysis", pattern: /data analy/i },
  { label: "JavaScript", pattern: /javascript/i },
  { label: "TypeScript", pattern: /typescript/i },
  { label: "React", pattern: /\breact\b/i },
  { label: "Python", pattern: /python/i },
  { label: "Communication", pattern: /communication/i },
  { label: "Marketing", pattern: /marketing/i },
  { label: "Excel", pattern: /excel/i },
  { label: "Leadership", pattern: /leadership|\bled\b/i },
  { label: "A/B testing", pattern: /a\/b testing/i },
  { label: "Roadmapping", pattern: /roadmap/i },
];

export function profileFromResume(text: string | null, filename: string) {
  const fallbackName = filename
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!text) {
    return {
      name: /resume|cv\b/i.test(fallbackName) ? "Your profile" : fallbackName || "Your profile",
      summary:
        "Profile created from your file name. Upload a TXT resume to pull a summary and skills from the document itself.",
      skills: ["Communication", "Collaboration", "Problem solving"],
      fromFile: false,
    };
  }
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const first = lines[0] ?? "";
  const name =
    first.length > 0 && first.length < 42 && !/resume|curriculum|^cv\b/i.test(first)
      ? first
      : "Your profile";
  const skills = SKILLS.filter((skill) => skill.pattern.test(text)).map((skill) => skill.label);
  const summary =
    lines.find((line) => line.length > 70) ??
    lines.slice(1, 3).join(" ") ??
    "Resume imported.";
  return {
    name,
    summary: summary.slice(0, 240),
    skills: skills.length > 0 ? skills.slice(0, 8) : ["Communication", "Collaboration"],
    fromFile: true,
  };
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function statusLabel(status: JobStatus, match: number) {
  if (status === "applied") return "Applied";
  if (status === "applying") return "Applying...";
  return `Match ${match}%`;
}
