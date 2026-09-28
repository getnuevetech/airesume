import { Link } from "react-router-dom";
import { FileText, Plane, Search } from "../components/Icons";

const steps = [
  {
    icon: <FileText />,
    title: "1. Upload resume",
    text: "Create your profile in seconds.",
    detail:
      "Drop in a PDF, DOCX, or TXT file. JobPilot reads it in the browser and turns the summary, roles, and skills into a profile you can use right away.",
  },
  {
    icon: <Search />,
    title: "2. Get matched",
    text: "We find the best jobs for your skills.",
    detail:
      "Each role gets a match rate based on overlap with your resume. High matches rise to the top so you spend time on work that actually fits.",
  },
  {
    icon: <Plane size={22} />,
    title: "3. Review & apply",
    text: "We prepare a tailored application. You review before anything is sent.",
    detail:
      "The resume is reshaped for that posting using only facts you confirmed. Autopilot can queue Ready or Review required rows — it does not submit without your approval.",
  },
];

export function HowItWorksPage() {
  return (
    <div className="container narrow-page">
      <header className="page-hero center">
        <p className="eyebrow">How it works</p>
        <h1>
          Find the right job.
          <br />
          On autopilot.
        </h1>
        <p className="lede">
          Three steps from a resume file to a search that keeps moving while you prepare for conversations.
        </p>
      </header>
      <ol className="timeline">
        {steps.map((step) => (
          <li key={step.title}>
            <span className="step-icon">{step.icon}</span>
            <div>
              <h2>{step.title}</h2>
              <p className="role">{step.text}</p>
              <p>{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="band">
        <h2>Ready when your resume is.</h2>
        <p>Upload once. We build the profile and line up the first matches.</p>
        <Link className="btn btn-primary btn-lg" to="/get-started">
          Get Started Free →
        </Link>
      </div>
    </div>
  );
}
