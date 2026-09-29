import { useEffect, useState, type FormEvent } from "react";
import { api } from "../../api";

type MfaRolePolicy = {
  role: "admin" | "employer" | "user";
  label: string;
  enabled: boolean;
  when: "login" | "session";
  envOverride: "forced_on" | "forced_off" | null;
};

type MfaWhenOption = { id: "login" | "session"; label: string; detail: string };

type MfaPolicyPayload = {
  roles: MfaRolePolicy[];
  whenOptions: MfaWhenOption[];
};

export function MfaPolicyAdmin() {
  const [data, setData] = useState<MfaPolicyPayload | null>(null);
  const [draft, setDraft] = useState<MfaRolePolicy[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const payload = await api<MfaPolicyPayload>("/api/admin/mfa-policy");
    setData(payload);
    setDraft(
      payload.roles.map((role) => ({
        ...role,
        enabled: role.envOverride === "forced_on" ? true : role.envOverride === "forced_off" ? false : role.enabled,
      })),
    );
  }

  useEffect(() => {
    void load().catch((err: Error) => setError(err.message));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const result = await api<MfaPolicyPayload & { ok: boolean }>("/api/admin/mfa-policy", {
        method: "PUT",
        body: JSON.stringify({
          roles: draft.map((role) => ({
            role: role.role,
            enabled: role.enabled,
            when: role.when,
          })),
        }),
      });
      setData(result);
      setDraft(
        result.roles.map((role) => ({
          ...role,
          enabled: role.envOverride === "forced_on" ? true : role.envOverride === "forced_off" ? false : role.enabled,
        })),
      );
      setMessage("MFA policy saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save MFA policy.");
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <p>{error || "Loading MFA policy…"}</p>;

  return (
    <div>
      <header className="admin-head">
        <div>
          <h1>Security · MFA</h1>
          <p className="role">
            Choose which account types must use an authenticator app, and whether they verify at sign-in or every 12 hours.
          </p>
        </div>
      </header>
      {error ? <p className="form-error">{error}</p> : null}
      {message ? <p className="role">{message}</p> : null}
      <form className="admin-card" onSubmit={(event) => void save(event)}>
        <h2>Account type requirements</h2>
        <div className="admin-table">
          {draft.map((role, index) => {
            const locked = Boolean(role.envOverride);
            return (
              <article key={role.role}>
                <div>
                  <strong>{role.label}</strong>
                  <p className="role">
                    {role.role === "admin"
                      ? "Site Admin console"
                      : role.role === "employer"
                        ? "Employer dashboard"
                        : "Candidate account"}
                    {role.envOverride === "forced_on" ? " · REQUIRE_ADMIN_MFA=1 overrides settings" : ""}
                    {role.envOverride === "forced_off" ? " · REQUIRE_ADMIN_MFA=0 overrides settings" : ""}
                  </p>
                </div>
                <div className="admin-actions" style={{ flexWrap: "wrap", gap: 12 }}>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={role.enabled}
                      disabled={locked}
                      onChange={(event) => {
                        const next = [...draft];
                        next[index] = { ...role, enabled: event.target.checked };
                        setDraft(next);
                      }}
                    />
                    Require MFA
                  </label>
                  <label className="field" style={{ margin: 0, minWidth: 200 }}>
                    <span>When</span>
                    <select
                      value={role.when}
                      disabled={locked || !role.enabled}
                      onChange={(event) => {
                        const next = [...draft];
                        next[index] = { ...role, when: event.target.value as "login" | "session" };
                        setDraft(next);
                      }}
                    >
                      {(data.whenOptions || []).map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </article>
            );
          })}
        </div>
        <p className="role" style={{ marginTop: 12 }}>
          At every sign-in: code once per session. Every 12 hours: re-prompt during long sessions (recommended for admins).
        </p>
        <button className="btn btn-primary" type="submit" disabled={busy} style={{ marginTop: 12 }}>
          {busy ? "Saving…" : "Save MFA policy"}
        </button>
      </form>
    </div>
  );
}
