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
    continueLabel: string;
    changeFileLabel: string;
    continueSelectedLabel: string;
    orLabel: string;
    googleLabel: string;
    finePrint: string;
    secondaryCta?: string;
    secondaryCtaTo?: string;
    aiCard: string;
    jobs: { id: string; title: string; company: string; logo: JobLogo; status: JobStatus; match: number }[];
  };
  trust: {
    items: { icon: "shield" | "check" | "lock" | "eye"; title: string; text: string }[];
  };
  stats: { icon: "briefcase" | "users" | "star" | "shield"; value: string; label: string }[];
  how: {
    eyebrow: string;
    title: string;
    steps: { icon: "file" | "search" | "plane" | "spark"; title: string; text: string }[];
  };
  fit: {
    eyebrow: string;
    title: string;
    lede: string;
    demo: {
      title: string;
      company: string;
      score: number;
      label: string;
      why: string[];
      gaps: string[];
      meta: string[];
    };
  };
  efficiency: {
    eyebrow: string;
    title: string;
    lede: string;
    stages: string[];
  };
  better: {
    eyebrow: string;
    title: string;
    lede: string;
    button: string;
    beforeLabel?: string;
    afterLabel?: string;
    before?: string;
    after?: string;
    checks: string[];
    scribble: string;
  };
  results: {
    eyebrow: string;
    title: string;
    lede: string;
    metrics: { value: string; label: string }[];
  };
  stories: {
    eyebrow: string;
    title: string;
    linkLabel: string;
    items: { name: string; role: string; quote: string; avatar: string }[];
  };
  pricing: {
    eyebrow: string;
    title: string;
    lede: string;
    button: string;
    buttonTo: string;
    plans: { name: string; price: string; blurb: string }[];
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

export function mergeHomepage(incoming: Partial<HomepageContent> | null | undefined): HomepageContent {
  const base = defaultHomepage;
  if (!incoming || typeof incoming !== "object") return base;
  return {
    ...base,
    ...incoming,
    hero: { ...base.hero, ...(incoming.hero || {}) },
    trust: { ...base.trust, ...(incoming.trust || {}), items: incoming.trust?.items?.length ? incoming.trust.items : base.trust.items },
    stats: incoming.stats?.length ? incoming.stats : base.stats,
    how: {
      ...base.how,
      ...(incoming.how || {}),
      steps: incoming.how?.steps?.length ? incoming.how.steps : base.how.steps,
    },
    fit: {
      ...base.fit,
      ...(incoming.fit || {}),
      demo: { ...base.fit.demo, ...(incoming.fit?.demo || {}) },
    },
    efficiency: {
      ...base.efficiency,
      ...(incoming.efficiency || {}),
      stages: incoming.efficiency?.stages?.length ? incoming.efficiency.stages : base.efficiency.stages,
    },
    better: { ...base.better, ...(incoming.better || {}) },
    results: {
      ...base.results,
      ...(incoming.results || {}),
      metrics: incoming.results?.metrics?.length ? incoming.results.metrics : base.results.metrics,
    },
    stories: {
      ...base.stories,
      ...(incoming.stories || {}),
      items: incoming.stories?.items?.length ? incoming.stories.items : base.stories.items,
    },
    pricing: {
      ...base.pricing,
      ...(incoming.pricing || {}),
      plans: incoming.pricing?.plans?.length ? incoming.pricing.plans : base.pricing.plans,
    },
    cta: {
      ...base.cta,
      ...(incoming.cta || {}),
      items: incoming.cta?.items?.length ? incoming.cta.items : base.cta.items,
    },
    footer: {
      ...base.footer,
      ...(incoming.footer || {}),
      links: incoming.footer?.links?.length ? incoming.footer.links : base.footer.links,
    },
    nav: incoming.nav?.length ? incoming.nav : base.nav,
  };
}

const SiteContext = createContext<{ content: HomepageContent; refresh: () => Promise<void> }>({
  content: defaultHomepage,
  refresh: async () => undefined,
});

export function SiteContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState(defaultHomepage);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/content/homepage");
      if (response.ok) setContent(mergeHomepage((await response.json()) as Partial<HomepageContent>));
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
