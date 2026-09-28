import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../api";
import { useApp } from "../context/AppContext";
import type { AccountData } from "./types";

type AccountContextValue = {
  data: AccountData | null;
  error: string;
  message: string;
  setError: (value: string) => void;
  setMessage: (value: string) => void;
  reload: () => Promise<void>;
};

const AccountContext = createContext<AccountContextValue | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const { user } = useApp();
  const [data, setData] = useState<AccountData | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function reload() {
    if (user?.mustChangePassword) {
      setData(null);
      return;
    }
    const next = await api<AccountData>("/api/dashboard");
    setData(next);
  }

  useEffect(() => {
    if (!user) return;
    if (user.mustChangePassword) {
      setError("");
      setData(null);
      return;
    }
    void reload().catch((err: Error) => setError(err.message));
  }, [user]);

  return (
    <AccountContext.Provider value={{ data, error, message, setError, setMessage, reload }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const value = useContext(AccountContext);
  if (!value) throw new Error("useAccount must be used inside the account");
  return value;
}
