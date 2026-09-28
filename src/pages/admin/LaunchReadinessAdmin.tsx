import { useEffect, useState } from "react";
import { api } from "../../api";

type LaunchCheck = {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  severity: "required" | "recommended" | "info";
};

type LaunchReport = {
  generatedAt: number;
  nodeEnv: string;
  production: boolean;
  cookieSecure: string;
  launchReady: boolean;
  opsReady: boolean;
  checks: LaunchCheck[];
  summary: {
    requiredTotal: number;
    requiredPassing: number;
    blockingCount: number;
    recommendedFailing: number;
  };
};

export function LaunchReadinessAdmin() {
  const [report, setReport] = useState<LaunchReport | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    setError("");
    try {
      const data = await api<LaunchReport>("/api/admin/launch-readiness");
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load launch readiness.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  return (
    <div>
      <header className="admin-head">
        <div>
          <h1>Launch readiness</h1>
          <p className="role">Live ops signals for public launch. Full checklist: docs/LAUNCH_CHECKLIST.md</p>
        </div>
        <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => void load()}>
          Refresh
        </button>
      </header>
      {error ? <p className="form-error">{error}</p> : null}
      {report ? (
        <>
          <section className="admin-card">
            <div className="launch-summary">
              <article className={report.opsReady ? "launch-pill ok" : "launch-pill bad"}>
                <strong>{report.opsReady ? "Ops ready" : "Ops blocked"}</strong>
                <span>
                  {report.summary.requiredPassing}/{report.summary.requiredTotal} required checks passing
                  {report.summary.blockingCount ? ` · ${report.summary.blockingCount} still open` : ""}
                </span>
              </article>
              <article className={report.launchReady ? "launch-pill ok" : "launch-pill warn"}>
                <strong>{report.launchReady ? "Launch ready" : "Counsel / process open"}</strong>
                <span>
                  {report.nodeEnv} · cookies {report.cookieSecure.split("_").join(" ")}
                  {report.summary.recommendedFailing
                    ? ` · ${report.summary.recommendedFailing} recommended gaps`
                    : ""}
                </span>
              </article>
            </div>
          </section>
          <section className="admin-card">
            <h2>Checks</h2>
            <div className="launch-checks">
              {report.checks.map((item) => (
                <article key={item.id} className={item.ok ? "launch-check ok" : "launch-check bad"}>
                  <header>
                    <strong>{item.label}</strong>
                    <span className="launch-tag">{item.severity}</span>
                    <span className="launch-status">{item.ok ? "Pass" : "Open"}</span>
                  </header>
                  <p>{item.detail}</p>
                </article>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
