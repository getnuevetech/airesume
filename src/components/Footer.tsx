import { NavLink } from "react-router-dom";
import { Brand } from "./Icons";

const links = [
  { to: "/how-it-works", label: "How it Works" },
  { to: "/features", label: "Features" },
  { to: "/pricing", label: "Pricing" },
  { to: "/blog", label: "Blog" },
  { to: "/privacy", label: "Privacy" },
  { to: "/terms", label: "Terms" },
  { to: "/contact", label: "Contact" },
];

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top">
          <Brand />
          <nav className="footer-links" aria-label="Footer">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to}>
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <p className="copyright">© 2026 JobPilot. All rights reserved.</p>
      </div>
    </footer>
  );
}
