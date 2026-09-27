import { Link } from "react-router-dom";

export function LegalPage({ kind }: { kind: "privacy" | "terms" }) {
  if (kind === "privacy") {
    return (
      <article className="container article">
        <p className="eyebrow">Privacy</p>
        <h1>Privacy</h1>
        <p className="role">Updated September 27, 2026</p>
        <p>
          JobPilot in this demo reads your resume in the browser. The file is not uploaded to a server. A TXT resume’s text, your account name and email, and the plan you pick are stored in local storage on this device.
        </p>
        <p>
          Passwords for email accounts are kept in that same local storage so you can sign in again on this browser. Do not use a password you use anywhere else.
        </p>
        <p>
          Continue with Google does not contact Google. It signs you in with a demo account that also stays on this device.
        </p>
        <p>
          Contact notes are stored locally and are not emailed. Clearing site data for this browser removes the profile, resume text, and notes.
        </p>
        <p>
          Questions: <Link to="/contact">contact the team</Link>.
        </p>
      </article>
    );
  }
  return (
    <article className="container article">
      <p className="eyebrow">Terms</p>
      <h1>Terms</h1>
      <p className="role">Updated September 27, 2026</p>
      <p>
        JobPilot here is a product demo. Matches, tailored resumes, and applications are simulated so you can see the flow. They are not submitted to Spotify, HubSpot, Notion, or any other employer.
      </p>
      <p>
        Plans and prices are part of the interface. Choosing a plan does not start a charge. There is no payment processor in this demo.
      </p>
      <p>
        You are responsible for the resume you upload. Do not upload someone else’s personal information. Because data stays in the browser, anyone with access to this device and browser profile can see it.
      </p>
      <p>
        The interface is provided as-is, without a promise that a preview match will lead to an interview.
      </p>
    </article>
  );
}

export function NotFoundPage() {
  return (
    <div className="container page-hero">
      <p className="eyebrow">404</p>
      <h1>That page is not on the route.</h1>
      <p className="lede">The link may be out of date. Head home and start from your resume.</p>
      <Link className="btn btn-primary btn-lg" to="/">
        Back to JobPilot
      </Link>
    </div>
  );
}
