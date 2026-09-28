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
    icon: <Sparkle />,
    title: "Tailored for each job",
    text: "The same experience is rewritten for the posting in front of you, without starting over.",
  },
  {
    icon: <Plane size={22} />,
    title: "Autopilot queue",
    text: "Matching roles land in Ready or Review required. You submit — nothing is sent on a guess.",
  },
  {
    icon: <Star size={22} />,
    title: "Keyword optimization",
    text: "Important phrases from the role are surfaced so the resume speaks the reader’s language.",
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
