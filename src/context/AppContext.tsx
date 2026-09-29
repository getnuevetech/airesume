import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { Billing, PlanId, ResumeFile, User } from "../data";

type AppContextValue = {
  user: User | null;
  ready: boolean;
  resume: ResumeFile | null;
  plan: PlanId;
  billing: Billing;
  toast: string | null;
  openGoogle: () => void;
  closeGoogle: () => void;
  googleOpen: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  register: (name: string, email: string, password: string) => Promise<string | null>;
  loginGoogle: (name: string, email: string) => void;
  signOut: () => void;
  setResume: (resume: ResumeFile) => void;
  clearResume: () => void;
  setPlan: (plan: PlanId, billing: Billing) => void;
  notify: (message: string) => void;
  refresh: () => Promise<void>;
};

const AppContext = createContext<AppContextValue | null>(null);
const SESSION_KEY = "jobpilot-session";

type Session = { resume: ResumeFile | null; plan: PlanId; billing: Billing };

function readSession(): Session {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return { resume: null, plan: "free", billing: "monthly" };
    const parsed = JSON.parse(raw) as Partial<Session>;
    return {
      resume: parsed.resume ?? null,
      plan: parsed.plan ?? "free",
      billing: parsed.billing ?? "monthly",
    };
  } catch {
    return { resume: null, plan: "free", billing: "monthly" };
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [local, setLocal] = useState<Session>(readSession);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(local));
  }, [local]);

  const refresh = async () => {
    try {
      const data = await api<{ user: User | null }>("/api/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setReady(true);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const value = useMemo<AppContextValue>(() => {
    const notify = (message: string) => setToast(message);
    return {
      user,
      ready,
      resume: local.resume,
      plan: local.plan,
      billing: local.billing,
      toast,
      googleOpen: false,
      openGoogle: () => {
        window.location.href = "/api/auth/google";
      },
      closeGoogle: () => undefined,
      notify,
      refresh,
      async login(email, password) {
        try {
          const data = await api<{ user: User }>("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
          });
          setUser(data.user);
          notify(`Welcome back, ${data.user.name.split(" ")[0]}.`);
          if (data.user.mustChangePassword) {
            navigate(data.user.role === "admin" ? "/admin" : "/account/settings");
          } else if (data.user.role === "admin") {
            navigate("/admin");
          } else if (data.user.role === "employer") {
            navigate("/employer");
          } else {
            navigate("/account");
          }
          return null;
        } catch (error) {
          return error instanceof Error ? error.message : "Sign in failed.";
        }
      },
      async register() {
        return "Upload a resume to create your account.";
      },
      loginGoogle() {
        window.location.href = "/api/auth/google";
      },
      signOut() {
        void api("/api/auth/logout", { method: "POST" }).finally(() => {
          setUser(null);
          notify("Signed out.");
          navigate("/");
        });
      },
      setResume(resume) {
        setLocal((current) => ({ ...current, resume }));
      },
      clearResume() {
        setLocal((current) => ({ ...current, resume: null }));
      },
      setPlan(plan, billing) {
        setLocal((current) => ({ ...current, plan, billing }));
        notify(plan === "free" ? "You are on the Free plan." : `${plan === "pro" ? "Pro" : "Autopilot"} selected.`);
      },
    };
  }, [user, ready, local, toast, navigate]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
}
