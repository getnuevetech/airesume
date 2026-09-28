import { Link } from "react-router-dom";
import { privacyDoc } from "../content/privacy";
import { termsDoc, type LegalDoc } from "../content/terms";

function LegalArticle({ doc }: { doc: LegalDoc }) {
  return (
    <article className="container article legal-doc">
      <p className="eyebrow">{doc.title}</p>
      <h1>{doc.title}</h1>
      <p className="role">
        Updated {doc.updated}
        {doc.draft ? " · Draft for counsel review" : ""}
      </p>
      <p className="lede">
        <a href={doc.pdfPath} target="_blank" rel="noreferrer">
          Download PDF
        </a>
      </p>
      {doc.sections.map((section) => (
        <section key={section.heading} className="legal-section">
          <h2>{section.heading}</h2>
          {section.blocks.map((block, index) =>
            block.type === "ul" ? (
              <ul key={`${section.heading}-${index}`}>
                {block.items.map((item) => (
                  <li key={item.slice(0, 48)}>{item}</li>
                ))}
              </ul>
            ) : (
              <p key={`${section.heading}-${index}`}>{block.text}</p>
            ),
          )}
        </section>
      ))}
      <p className="fine-print">
        Questions: <Link to="/contact">contact the team</Link>.
      </p>
    </article>
  );
}

export function LegalPage({ kind }: { kind: "privacy" | "terms" }) {
  return <LegalArticle doc={kind === "privacy" ? privacyDoc : termsDoc} />;
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
