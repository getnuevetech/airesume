import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import fallback from "../../shared/homepage.json";
import type { JobLogo, JobStatus } from "../data";

export type HomepageContent = {
  brand: string;
  signInLabel: string;
  getStartedLabel: string;
  dashboardLabel: string;
  nav: { label: string; to: string }[];
  hero: {
    image: string;
    imageAlt: string;
    eyebrow: string;
    titleLines: string[];
    lede: string;
    dropTitle: string;
    dropHint: string;
    uploadLabel: string;
    orLabel: string;
    googleLabel: string;
    finePrint: string;
    aiCard: string;
    jobs: { id: string; title: string; company: string; logo: JobLogo; status: JobStatus; match: number }[];
  };
  stats: { icon: "briefcase" | "users" | "star" | "shield"; value: string; label: string }[];
  how: { eyebrow: string; title: string; steps: { icon: "file" | "search" | "plane"; title: string; text: string }[] };
  better: { eyebrow: string; title: string; lede: string; button: string; checks: string[]; scribble: string };
  stories: {
    eyebrow: string;
    title: string;
    linkLabel: string;
    items: { name: string; role: string; quote: string; avatar: string }[];
  };
  cta: {
    title: string;
    lede: string;
    button: string;
    scribble: string;
    items: { icon: "file" | "search" | "plane"; label: string }[];
  };
  footer: { copyright: string; links: { label: string; to: string }[] };
};

export const defaultHomepage = fallback as HomepageContent;

const SiteContext = createContext<{ content: HomepageContent; refresh: () => Promise<void> }>({
  content: defaultHomepage,
  refresh: async () => undefined,
});

export function SiteContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState(defaultHomepage);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/content/homepage");
      if (response.ok) setContent((await response.json()) as HomepageContent);
    } catch {
      setContent(defaultHomepage);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onUpdate = () => void refresh();
    window.addEventListener("homepage-updated", onUpdate);
    return () => window.removeEventListener("homepage-updated", onUpdate);
  }, [refresh]);

  return <SiteContext.Provider value={{ content, refresh }}>{children}</SiteContext.Provider>;
}

export function useSiteContent() {
  return useContext(SiteContext);
}
