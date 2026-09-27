import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useSiteContent } from "../content/siteContent";
import { initials } from "../data";
import { Brand, CloseIcon, MenuIcon } from "./Icons";

export function Header() {
  const { user, signOut } = useApp();
  const { content } = useSiteContent();
  const links = content.nav;
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className={scrolled ? "site-header scrolled" : "site-header"}>
      <div className="container header-inner">
        <Brand name={content.brand} />
        <nav className="nav" aria-label="Primary">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => (isActive ? "nav-link active" : "nav-link")}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="header-actions">
          {user ? (
            <>
              <span className="user-chip" title={user.email}>
                {initials(user.name)}
              </span>
              <button className="nav-link sign-in" type="button" onClick={signOut}>
                Sign out
              </button>
              {user.role === "admin" ? (
                <NavLink to="/admin" className="nav-link">
                  Admin
                </NavLink>
              ) : null}
              <NavLink to="/account" className="btn btn-primary btn-sm">
                {content.dashboardLabel}
              </NavLink>
            </>
          ) : (
            <>
              <NavLink to="/signin" className="nav-link sign-in">
                {content.signInLabel}
              </NavLink>
              <NavLink to="/get-started" className="btn btn-primary btn-sm">
                {content.getStartedLabel}
              </NavLink>
            </>
          )}
          <button
            className="menu-btn"
            type="button"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>
      <div className={open ? "mobile-panel open" : "mobile-panel"}>
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} className="nav-link">
            {link.label}
          </NavLink>
        ))}
        {user ? (
          <>
            {user.role === "admin" ? (
              <NavLink to="/admin" className="nav-link">
                Admin
              </NavLink>
            ) : null}
            <NavLink to="/account" className="nav-link">
              {content.dashboardLabel}
            </NavLink>
          </>
        ) : (
          <NavLink to="/signin" className="nav-link">
            {content.signInLabel}
          </NavLink>
        )}
      </div>
    </header>
  );
}
