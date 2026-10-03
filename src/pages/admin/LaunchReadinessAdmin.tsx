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

type LegalEntity = {
  legalName: string;
  mailingAddress: string;
  privacyEmail: string;
  supportEmail: string;
};

type AttestationState = {
  attested: boolean;
  at: number | null;
};

type LaunchAttestations = {
  audience: { ok: boolean; detail: string; attestation: AttestationState; scan: { ok: boolean; detail: string } };
  adsCookies: { ok: boolean; detail: string; attestation: AttestationState; scan: { ok: boolean; detail: string } };
};

const emptyEntity: LegalEntity = {
  legalName: "",
  mailingAddress: "",
  privacyEmail: "",
  supportEmail: "",
};

export function LaunchReadinessAdmin() {
  const [report, setReport] = useState<LaunchReport | null>(null);
  const [entity, setEntity] = useState<LegalEntity>(emptyEntity);
  const [attestations, setAttestations] = useState<LaunchAttestations | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    setError("");
    try {
      const [data, legal, attest] = await Promise.all([
        api<LaunchReport>("/api/admin/launch-readiness"),
        api<{ entity: LegalEntity }>("/api/admin/legal-entity"),
        api<LaunchAttestations>("/api/admin/launch-attestations"),
      ]);
      setReport(data);
      setEntity(legal.entity || emptyEntity);
      setAttestations(attest);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load launch readiness.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveEntity(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{ entity: LegalEntity; launch: LaunchReport }>("/api/admin/legal-entity", {
        method: "PUT",
        body: JSON.stringify(entity),
      });
      setEntity(result.entity);
      setReport(result.launch);
      setMessage("Legal entity saved. Terms and Privacy use these fields on the public pages.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save legal entity.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAttestation(patch: { audienceAttested?: boolean; adsCookiesAttested?: boolean }) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await api<{
        attestations: LaunchAttestations;
        launch: LaunchReport;
      }>("/api/admin/launch-attestations", {
        method: "PUT",
        body: JSON.stringify(patch),
      });
      setAttestations(result.attestations);
      setReport(result.launch);
      setMessage(
        patch.audienceAttested !== undefined
          ? patch.audienceAttested
            ? "U.S.-first / 18+ positioning attested."
            : "U.S.-first / 18+ attestation cleared."
          : patch.adsCookiesAttested
            ? "No advertising cookies attested."
            : "Advertising cookies attestation cleared.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save launch attestation.");
    } finally {
      setBusy(false);
    }
  }

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
      {message ? <p className="form-success">{message}</p> : null}
      <section className="admin-card">
        <h2>Legal entity</h2>
        <p className="role">
          Fills company brackets on Terms and Privacy. Draft and arbitration markers still need counsel before public launch.
        </p>
        <form className="admin-form" onSubmit={(event) => void saveEntity(event)}>
          <label className="field">
            <span>Company legal name</span>
            <input
              value={entity.legalName}
              onChange={(event) => setEntity({ ...entity, legalName: event.target.value })}
              required
            />
          </label>
          <label className="field">
            <span>Mailing address</span>
            <textarea
              rows={2}
              value={entity.mailingAddress}
              onChange={(event) => setEntity({ ...entity, mailingAddress: event.target.value })}
              required
            />
          </label>
          <label className="field">
            <span>Privacy email</span>
            <input
              type="email"
              value={entity.privacyEmail}
              onChange={(event) => setEntity({ ...entity, privacyEmail: event.target.value })}
              required
            />
          </label>
          <label className="field">
            <span>Legal / support email</span>
            <input
              type="email"
              value={entity.supportEmail}
              onChange={(event) => setEntity({ ...entity, supportEmail: event.target.value })}
              required
            />
          </label>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            Save legal entity
          </button>
        </form>
      </section>
      <section className="admin-card">
        <h2>Audience and cookies</h2>
        <p className="role">
          Required for opsReady. Privacy must still state U.S.-first / 18+ positioning and that advertising cookies are off.
          Attest only after you re-read the live copy.
        </p>
        <label className="check-row">
          <input
            type="checkbox"
            checked={Boolean(attestations?.audience.attestation.attested)}
            disabled={busy || !attestations?.audience.scan.ok}
            onChange={(event) => {
              void saveAttestation({ audienceAttested: event.target.checked });
            }}
          />
          U.S.-first / 18+ positioning in Privacy is still accurate
        </label>
        <p className="role">
          {attestations?.audience.attestation.attested && attestations.audience.attestation.at
            ? `Attested ${new Date(attestations.audience.attestation.at).toLocaleString()}.`
            : attestations?.audience.scan.ok
              ? "Scan found the audience markers. Confirm accuracy, then check the box."
              : attestations?.audience.scan.detail || "Loading audience scan…"}
        </p>
        <label className="check-row">
          <input
            type="checkbox"
            checked={Boolean(attestations?.adsCookies.attestation.attested)}
            disabled={busy || !attestations?.adsCookies.scan.ok}
            onChange={(event) => {
              void saveAttestation({ adsCookiesAttested: event.target.checked });
            }}
          />
          No advertising / cross-site tracking cookies without a Privacy update
        </label>
        <p className="role">
          {attestations?.adsCookies.attestation.attested && attestations.adsCookies.attestation.at
            ? `Attested ${new Date(attestations.adsCookies.attestation.at).toLocaleString()}.`
            : attestations?.adsCookies.scan.ok
              ? "Scan found the no-ads cookies language and no ad scripts in the app shell."
              : attestations?.adsCookies.scan.detail || "Loading ads cookie scan…"}
        </p>
      </section>
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
