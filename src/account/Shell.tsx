import { NavLink, Outlet, Link, Navigate, useLocation } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { AccountProvider, useAccount } from "./AccountContext";

const ITEMS = [
  { to: "/account", label: "Home", icon: "home", end: true },
  { to: "/account/profile", label: "Profile", icon: "user" },
  { to: "/account/resume", label: "Resume", icon: "file" },
  { to: "/account/templates", label: "Templates", icon: "layout" },
  { to: "/account/insights", label: "Insights", icon: "chart" },
  { to: "/account/jobs", label: "Jobs", icon: "briefcase" },
  { to: "/account/applications", label: "Applications", icon: "send" },
  { to: "/account/plan", label: "Plan", icon: "card" },
  { to: "/account/settings", label: "Settings", icon: "gear" },
];

export function AccountShell() {
  const { user } = useApp();
  const location = useLocation();
  if (!user) {
    return (
      <div className="container page-hero">
        <h1>Sign in to open your account.</h1>
        <Link className="btn btn-primary btn-lg" to="/signin">Sign in</Link>
      </div>
    );
  }
  if (user.mustChangePassword && location.pathname !== "/account/settings") {
    return <Navigate to="/account/settings" replace />;
  }
  return (
    <AccountProvider>
      <div className="account-shell">
        <AccountNav />
        <main className="account-main">
          <AccountNotice />
          <Outlet />
        </main>
      </div>
    </AccountProvider>
  );
}

function AccountNotice() {
  const { error, message } = useAccount();
  return (
    <>
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="role">{message}</p> : null}
    </>
  );
}

function AccountNav() {
  const { user, signOut } = useApp();
  const { data } = useAccount();
  const photo = data?.profile?.photoUrl;
  const initials = (user?.name || "?").split(" ").map((part) => part[0]).slice(0, 2).join("");
  return (
    <aside className="account-nav">
      <Link to="/" className="account-brand">JobPilot</Link>
      <nav>
        {ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? "on" : "")}>
            <NavIcon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="account-user">
        {photo ? <img src={photo} alt="" /> : <span>{initials}</span>}
        <div>
          <strong>{user?.name}</strong>
          <p>{data?.plan.name || "Account"}</p>
        </div>
        <button type="button" onClick={signOut} aria-label="Sign out">
          <NavIcon name="out" />
        </button>
      </div>
    </aside>
  );
}

function NavIcon({ name }: { name: string }) {
  const props = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  if (name === "home") return <svg {...props}><path d="M4 11 12 4l8 7" /><path d="M6 10.5V20h12v-9.5" /></svg>;
  if (name === "user") return <svg {...props}><circle cx="12" cy="8" r="3" /><path d="M5 19c1.5-3 3.8-4.5 7-4.5S17.5 16 19 19" /></svg>;
  if (name === "file") return <svg {...props}><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5" /></svg>;
  if (name === "layout") return <svg {...props}><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="16" height="7" rx="1" /></svg>;
  if (name === "briefcase") return <svg {...props}><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5h8v2" /></svg>;
  if (name === "chart") return <svg {...props}><path d="M4 19V5" /><path d="M4 19h16" /><path d="M8 16v-5" /><path d="M12 16V8" /><path d="M16 16v-3" /></svg>;
  if (name === "send") return <svg {...props}><path d="M4 12h10" /><path d="m11 6 7 6-7 6" /></svg>;
  if (name === "card") return <svg {...props}><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></svg>;
  if (name === "out") return <svg {...props}><path d="M10 7V5H5v14h5v-2" /><path d="M10 12h9" /><path d="m16 8 4 4-4 4" /></svg>;
  return <svg {...props}><circle cx="12" cy="12" r="3" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2" /></svg>;
}
