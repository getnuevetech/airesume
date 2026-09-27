import { NavLink } from "react-router-dom";
import { useSiteContent } from "../content/siteContent";
import { Brand } from "./Icons";

export function Footer() {
  const { content } = useSiteContent();
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top">
          <Brand />
          <nav className="footer-links" aria-label="Footer">
            {content.footer.links.map((link) => (
              <NavLink key={link.to + link.label} to={link.to}>
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <p className="copyright">{content.footer.copyright}</p>
      </div>
    </footer>
  );
}
