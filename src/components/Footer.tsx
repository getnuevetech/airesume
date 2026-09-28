import { NavLink } from "react-router-dom";
import { openCookieSettings } from "./CookieSettings";
import { Brand } from "./Icons";

const LEGAL_LINKS = [
  { label: "Terms", to: "/terms" },
  { label: "Privacy", to: "/privacy" },
];

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top">
          <Brand />
          <nav className="footer-links" aria-label="Legal">
            {LEGAL_LINKS.map((link) => (
              <NavLink key={link.to} to={link.to}>
                {link.label}
              </NavLink>
            ))}
            <button className="footer-cookie-btn" type="button" onClick={() => openCookieSettings()}>
              Cookie Settings
            </button>
          </nav>
        </div>
        <p className="copyright">© 2026 JobPilot. All rights reserved.</p>
      </div>
    </footer>
  );
}
