import { useEffect, useId, useState } from "react";

const STORAGE_KEY = "jp-cookie-prefs";

export type CookiePrefs = {
  essential: true;
  analytics: boolean;
  updatedAt: number;
};

export function readCookiePrefs(): CookiePrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { essential: true, analytics: false, updatedAt: 0 };
    const parsed = JSON.parse(raw) as Partial<CookiePrefs>;
    return {
      essential: true,
      analytics: Boolean(parsed.analytics),
      updatedAt: Number(parsed.updatedAt) || 0,
    };
  } catch {
    return { essential: true, analytics: false, updatedAt: 0 };
  }
}

export function writeCookiePrefs(prefs: Omit<CookiePrefs, "essential" | "updatedAt"> & { analytics: boolean }) {
  const next: CookiePrefs = {
    essential: true,
    analytics: Boolean(prefs.analytics),
    updatedAt: Date.now(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("jp-cookie-prefs", { detail: next }));
  return next;
}

export function openCookieSettings() {
  window.dispatchEvent(new Event("jp-open-cookie-settings"));
}

export function CookieSettingsHost() {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    const prefs = readCookiePrefs();
    setAnalytics(prefs.analytics);
    setSavedAt(prefs.updatedAt);
    const onOpen = () => {
      const latest = readCookiePrefs();
      setAnalytics(latest.analytics);
      setSavedAt(latest.updatedAt);
      setOpen(true);
    };
    window.addEventListener("jp-open-cookie-settings", onOpen);
    return () => window.removeEventListener("jp-open-cookie-settings", onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  return (
    <div className="cookie-overlay" role="presentation" onClick={() => setOpen(false)}>
      <div
        className="cookie-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <p className="eyebrow">Cookie Settings</p>
        <h2 id={titleId}>Choose how JobPilot uses cookies</h2>
        <p className="lede">
          Essential cookies keep you signed in and protect the service. Optional analytics cookies are off unless you turn them on.
        </p>
        <label className="check-row">
          <input type="checkbox" checked disabled />
          <span>
            <strong>Essential</strong> — always on for authentication, security, and core product features.
          </span>
        </label>
        <label className="check-row">
          <input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} />
          <span>
            <strong>Analytics</strong> — help us understand product usage. Off by default at launch.
          </span>
        </label>
        {savedAt ? (
          <p className="role">Last saved {new Date(savedAt).toLocaleString()}.</p>
        ) : (
          <p className="role">No optional cookies are stored until you save a preference.</p>
        )}
        <div className="admin-actions">
          <button
            className="btn btn-primary btn-sm"
            type="button"
            onClick={() => {
              const next = writeCookiePrefs({ analytics });
              setSavedAt(next.updatedAt);
              setOpen(false);
            }}
          >
            Save preferences
          </button>
          <button className="btn btn-ghost btn-sm" type="button" onClick={() => setOpen(false)}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
