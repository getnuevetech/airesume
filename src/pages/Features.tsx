import { Link } from "react-router-dom";
import { FileText, Plane, Search, Shield, Sparkle, Star } from "../components/Icons";

const features = [
  {
    icon: <FileText />,
    title: "Profile in seconds",
    text: "Upload a resume and we turn it into a profile with a summary and the skills we can read from the file.",
  },
  {
    icon: <Search />,
    title: "Smart matching",
    text: "Roles are scored against your skills so the strongest overlaps show up first.",
  },
  {
    icon: <Star size={22} />,
    title: "Career insights",
    text: "See which skills open roles demand, where your resume already wins, and what to focus on next — without inventing experience.",
  },
  {
    icon: <Sparkle />,
    title: "Tailored for each job",
    text: "The same experience is rewritten for the posting in front of you, without starting over.",
  },
  {
    icon: <Plane size={22} />,
    title: "Browser apply assistant",
    text: "Copy contact, tailored resume, and answers beside the employer form. Mark Applied when you finish — nothing is sent on a guess.",
  },
  {
    icon: <FileText />,
    title: "Interview prep",
    text: "Practice prompts and STAR drafts built from resume bullets. Gaps stay honest — no invented metrics.",
  },
  {
    icon: <Sparkle />,
    title: "Voice practice",
    text: "Hear interview prompts, answer by mic or keyboard, and get coaching that only trusts facts already on your resume.",
  },
  {
    icon: <Search />,
    title: "Employer search",
    text: "Hiring teams can search members who published a public resume link — contact stays private unless shared.",
  },
  {
    icon: <Plane size={22} />,
    title: "Hiring pipeline",
    text: "Save public candidates, tag a role, add notes, and move them through Saved → Interviewing → Offer → Hired.",
  },
  {
    icon: <Sparkle />,
    title: "Live employer interviews",
    text: "Share a join code, capture spoken or typed answers, and score them only against the candidate’s public resume facts.",
  },
  {
    icon: <Plane size={22} />,
    title: "Postings and invites",
    text: "Employers publish open roles to the catalog and invite public candidates. Accepting an invite adds the role to your tracker.",
  },
  {
    icon: <Sparkle />,
    title: "Interview rooms",
    text: "Host, interviewer, and candidate join the same room with a shared transcript. Candidate answers are scored only against public resume facts.",
  },
  {
    icon: <Search />,
    title: "Hiring analytics",
    text: "Track funnel health, invite and hire rates, and SLA breaches for review, invites, and interviews.",
  },
  {
    icon: <Shield />,
    title: "Private by design",
    text: "Your file is read in this browser. It is not uploaded to a server.",
  },
];

export function FeaturesPage() {
  return (
    <div className="container narrow-page">
      <header className="page-hero">
        <p className="eyebrow">Features</p>
        <h1>Everything between the resume and the interview.</h1>
        <p className="lede">
          JobPilot keeps the repetitive parts of a search moving, and leaves the decisions with you.
        </p>
      </header>
      <div className="feature-grid">
        {features.map((feature) => (
          <article className="feature-card" key={feature.title}>
            <span className="step-icon">{feature.icon}</span>
            <h2>{feature.title}</h2>
            <p>{feature.text}</p>
          </article>
        ))}
      </div>
      <div className="band">
        <h2>A stronger resume opens more doors.</h2>
        <p>Start with the file you already have.</p>
        <Link className="btn btn-primary btn-lg" to="/get-started">
          Upscale My Resume →
        </Link>
      </div>
    </div>
  );
}
