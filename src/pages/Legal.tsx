import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { privacyDoc } from "../content/privacy";
import { termsDoc, type LegalDoc } from "../content/terms";

type LegalEntity = {
  legalName: string;
  mailingAddress: string;
  privacyEmail: string;
  supportEmail: string;
};

function applyEntity(text: string, entity: LegalEntity) {
  let out = text;
  if (entity.legalName) out = out.split("[COMPANY LEGAL NAME]").join(entity.legalName);
  if (entity.mailingAddress) out = out.split("[COMPANY MAILING ADDRESS]").join(entity.mailingAddress);
  if (entity.privacyEmail) out = out.split("[PRIVACY EMAIL]").join(entity.privacyEmail);
  if (entity.supportEmail) {
    out = out.split("[LEGAL / SUPPORT EMAIL]").join(entity.supportEmail);
    out = out.split("[LEGAL/SUPPORT EMAIL]").join(entity.supportEmail);
  }
  return out;
}

function applyEntityToDoc(doc: LegalDoc, entity: LegalEntity): LegalDoc {
  return {
    ...doc,
    sections: doc.sections.map((section) => ({
      ...section,
      blocks: section.blocks.map((block) =>
        block.type === "ul"
          ? { ...block, items: block.items.map((item) => applyEntity(item, entity)) }
          : { ...block, text: applyEntity(block.text, entity) },
      ),
    })),
  };
}

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
  const base = kind === "privacy" ? privacyDoc : termsDoc;
  const [doc, setDoc] = useState<LegalDoc>(base);

  useEffect(() => {
    let alive = true;
    const source = kind === "privacy" ? privacyDoc : termsDoc;
    void api<{ entity: LegalEntity }>("/api/legal-entity")
      .then((data) => {
        if (!alive) return;
        setDoc(
          applyEntityToDoc(source, data.entity || { legalName: "", mailingAddress: "", privacyEmail: "", supportEmail: "" }),
        );
      })
      .catch(() => {
        if (alive) setDoc(source);
      });
    return () => {
      alive = false;
    };
  }, [kind]);

  return <LegalArticle doc={doc} />;
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
