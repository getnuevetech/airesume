import { Link } from "react-router-dom";

export function LegalPage({ kind }: { kind: "privacy" | "terms" }) {
  if (kind === "privacy") {
    return (
      <article className="container article">
        <p className="eyebrow">Privacy</p>
        <h1>Privacy</h1>
        <p className="role">Updated September 27, 2026</p>
        <p>
          JobPilot stores the account you create and the resume you upload so you can review and use that profile.
        </p>
        <p>
          If you upload a resume, that file is read to fill your name, contact details, experience, and skills. You confirm those details before the account is activated.
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
          By creating a JobPilot account you agree to these terms. You can create an account by entering your details or by uploading a resume.
        </p>
        <p>
          Uploading a resume lets JobPilot read that file to fill the account. You can correct the details before the account is activated. You confirm that the resume and the details you submit are yours to share.
        </p>
        <p>The full terms text can be updated on this page.</p>
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
