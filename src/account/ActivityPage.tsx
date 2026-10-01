import { useEffect, useState } from "react";
import { api } from "../api";
import { useAccount } from "./AccountContext";

type ActivityRow = { id: string; summary: string; createdAt: number };

export function ActivityPage() {
  const { setError } = useAccount();
  const [rows, setRows] = useState<ActivityRow[] | null>(null);

  useEffect(() => {
    void api<{ activity: ActivityRow[] }>("/api/account/activity")
      .then((data) => setRows(data.activity || []))
      .catch((err: Error) => setError(err.message));
  }, [setError]);

  return (
    <div className="account-page">
      <header className="account-head">
        <div>
          <p className="eyebrow">Account</p>
          <h1>Activity</h1>
          <p className="lede">What you have done in this account. Support can read this same list.</p>
        </div>
      </header>
      <section className="account-card">
        <h2>Your activity</h2>
        {rows === null ? null : rows.length ? (
          <ol className="activity-list">
            {rows.map((row) => (
              <li key={row.id}>
                <strong>{row.summary}</strong>
                <time dateTime={new Date(row.createdAt).toISOString()}>{new Date(row.createdAt).toLocaleString()}</time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="role">Nothing is recorded yet.</p>
        )}
      </section>
    </div>
  );
}
