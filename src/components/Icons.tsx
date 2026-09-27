import { Link } from "react-router-dom";
import type { JobLogo } from "../data";

type IconProps = { size?: number };

export function Plane({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
    </svg>
  );
}

export function Brand({ name = "JobPilot" }: { name?: string }) {
  return (
    <Link to="/" className="brand" aria-label={`${name} home`}>
      <Plane />
      <span>{name}</span>
    </Link>
  );
}

export function Bolt({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
    </svg>
  );
}

export function Check({ size = 12 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 12.5 10 17.5 19 7.5"
      />
    </svg>
  );
}

export function Sparkle({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor" d="M12 2.2 13.7 8.4 20 10l-6.3 1.6L12 17.8 10.3 11.6 4 10l6.3-1.6L12 2.2z" />
    </svg>
  );
}

export function Briefcase({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        d="M8 7V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v1"
      />
      <rect x="3" y="7" width="18" height="13" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3 12h18" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

export function Users({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M3.5 19c.6-3 2.8-4.5 5.5-4.5S14 16 14.5 19"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="17" cy="9" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M16 14.6c2.2.3 3.8 1.6 4.4 4.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Star({ size = 16, filled = true }: IconProps & { filled?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        d="m12 3.2 2.4 5.2 5.7.7-4.2 3.9 1.1 5.6L12 16.8 6.9 18.6l1.1-5.6L3.8 9.1l5.7-.7L12 3.2z"
      />
    </svg>
  );
}

export function Shield({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        d="M12 3 5 6v6.2c0 4.2 2.8 7.2 7 8.8 4.2-1.6 7-4.6 7-8.8V6l-7-3z"
      />
      <path
        d="M9 12.2 11 14.2 15.2 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FileText({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        d="M7 3.5h7l5 5V20a1.5 1.5 0 0 1-1.5 1.5h-10.5A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5z"
      />
      <path d="M14 3.8V9h5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.5 13h7M8.5 16.5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function Search({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15.8 15.8 20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function MenuIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function CloseIcon({ size = 22 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function GoogleG({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.3 35.1 26.8 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.7 7.1l6.3 5.3C37.4 38.4 44 34 44 24c0-1.3-.1-2.7-.4-3.5z"
      />
    </svg>
  );
}

export function LogoMark({ logo }: { logo: JobLogo }) {
  if (logo === "spotify") {
    return (
      <svg className="logo-mark" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill="#1DB954" />
        <path d="M8.2 13.1c4.4-1.3 9.1-.9 13.2 1" fill="none" stroke="#0b1a10" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M9.2 16.6c3.5-1 7.2-.7 10.4.8" fill="none" stroke="#0b1a10" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M10.2 19.8c2.6-.7 5.4-.5 7.8.6" fill="none" stroke="#0b1a10" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    );
  }
  if (logo === "hubspot") {
    return (
      <svg className="logo-mark" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="16" fill="#FF7A59" />
        <circle cx="16" cy="9" r="2.1" fill="#fff" />
        <circle cx="10" cy="21" r="2.1" fill="#fff" />
        <circle cx="22" cy="21" r="2.1" fill="#fff" />
        <path d="M16 11.2v4.2M12 19.4 15 15.6M20 19.4 17 15.6" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg className="logo-mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#111" />
      <path fill="#fff" d="M10 8.5h3.1l2.7 7.2 2.8-7.2H22V23h-2.3v-7.6L16.6 23h-1.5l-3.1-7.6V23H10V8.5z" />
    </svg>
  );
}

export function Stars() {
  return (
    <span className="stars" aria-label="5 out of 5 stars">
      {Array.from({ length: 5 }, (_, index) => (
        <Star key={index} size={15} />
      ))}
    </span>
  );
}
