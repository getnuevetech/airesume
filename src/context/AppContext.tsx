import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import type { Billing, PlanId, ResumeFile, User } from "../data";

type Account = User & { password: string };

type AppContextValue = {
  user: User | null;
  resume: ResumeFile | null;
  plan: PlanId;
  billing: Billing;
  toast: string | null;
  googleOpen: boolean;
  openGoogle: () => void;
  closeGoogle: () => void;
  login: (email: string, password: string) => string | null;
  register: (name: string, email: string, password: string) => string | null;
  loginGoogle: (name: string, email: string) => void;
  signOut: () => void;
  setResume: (resume: ResumeFile) => void;
  clearResume: () => void;
  setPlan: (plan: PlanId, billing: Billing) => void;
  notify: (message: string) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

const SESSION_KEY = "jobpilot-session";
const ACCOUNTS_KEY = "jobpilot-accounts";

type Session = {
  user: User | null;
  resume: ResumeFile | null;
  plan: PlanId;
  billing: Billing;
};

const emptySession: Session = {
  user: null,
  resume: null,
  plan: "free",
  billing: "monthly",
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session>(() =>
    readJson<Session>(SESSION_KEY, emptySession),
  );
  const [toast, setToast] = useState<string | null>(null);
  const [googleOpen, setGoogleOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const value = useMemo<AppContextValue>(() => {
    const notify = (message: string) => setToast(message);

    const goNext = (hasResume: boolean) => {
      navigate(hasResume ? "/dashboard" : "/get-started");
    };

    return {
      user: session.user,
      resume: session.resume,
      plan: session.plan,
      billing: session.billing,
      toast,
      googleOpen,
      openGoogle: () => setGoogleOpen(true),
      closeGoogle: () => setGoogleOpen(false),
      notify,
      login(email, password) {
        const accounts = readJson<Account[]>(ACCOUNTS_KEY, []);
        const account = accounts.find(
          (item) => item.email.toLowerCase() === email.trim().toLowerCase(),
        );
        if (!account) return "No account uses that email. Create one to get started.";
        if (account.provider === "google") {
          return "That email uses Continue with Google.";
        }
        if (account.password !== password) return "That password does not match.";
        setSession((current) => ({
          ...current,
          user: { name: account.name, email: account.email, provider: "email" },
        }));
        notify(`Welcome back, ${account.name.split(" ")[0]}.`);
        goNext(Boolean(session.resume));
        return null;
      },
      register(name, email, password) {
        const accounts = readJson<Account[]>(ACCOUNTS_KEY, []);
        const exists = accounts.some(
          (item) => item.email.toLowerCase() === email.trim().toLowerCase(),
        );
        if (exists) return "An account with this email already exists. Sign in instead.";
        const account: Account = {
          name: name.trim(),
          email: email.trim(),
          password,
          provider: "email",
        };
        localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([...accounts, account]));
        setSession((current) => ({
          ...current,
          user: { name: account.name, email: account.email, provider: "email" },
        }));
        notify("Account created. Your search is ready.");
        navigate("/dashboard");
        return null;
      },
      loginGoogle(name, email) {
        const accounts = readJson<Account[]>(ACCOUNTS_KEY, []);
        if (!accounts.some((item) => item.email.toLowerCase() === email.toLowerCase())) {
          localStorage.setItem(
            ACCOUNTS_KEY,
            JSON.stringify([
              ...accounts,
              { name, email, password: "", provider: "google" as const },
            ]),
          );
        }
        setSession((current) => ({
          ...current,
          user: { name, email, provider: "google" },
        }));
        setGoogleOpen(false);
        notify(`Signed in as ${name}.`);
        goNext(Boolean(session.resume));
      },
      signOut() {
        setSession((current) => ({ ...current, user: null }));
        notify("Signed out.");
        navigate("/");
      },
      setResume(resume) {
        setSession((current) => ({ ...current, resume }));
      },
      clearResume() {
        setSession((current) => ({ ...current, resume: null }));
      },
      setPlan(plan, billing) {
        setSession((current) => ({ ...current, plan, billing }));
        notify(
          plan === "free"
            ? "You are on the Free plan."
            : `${plan === "pro" ? "Pro" : "Autopilot"} selected.`,
        );
      },
    };
  }, [session, toast, googleOpen, navigate]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
}
