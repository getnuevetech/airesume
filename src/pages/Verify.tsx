import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";
import { useApp } from "../context/AppContext";

export function VerifyPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refresh, notify } = useApp();
  const [email, setEmail] = useState(params.get("email") || "");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const token = params.get("token");
    if (!token) return;
    setBusy(true);
    void api("/api/onboarding/verify", { method: "POST", body: JSON.stringify({ token }) })
      .then(async () => {
        sessionStorage.removeItem("jp-draft");
        await refresh();
        notify("Account activated.");
        navigate("/account");
      })
      .catch((err: Error) => {
        setError(err.message || "Could not activate the account.");
        setBusy(false);
      });
  }, [params, navigate, notify, refresh]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await api("/api/onboarding/verify", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });
      sessionStorage.removeItem("jp-draft");
      await refresh();
      notify("Account activated.");
      navigate("/account");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not activate the account.");
      setBusy(false);
    }
  }

  return (
    <div className="container auth-wrap">
      <form className="auth-card" onSubmit={onSubmit}>
        <p className="eyebrow">Activate</p>
        <h1>Confirm your email</h1>
        <p className="lede">Open the link from your inbox, or enter the six-digit code here.</p>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <label className="field">
          <span>Email</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label className="field">
          <span>Activation code</span>
          <input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" pattern="[0-9]{6}" minLength={6} maxLength={6} required />
        </label>
        <button className="btn btn-primary btn-block" type="submit" disabled={busy}>
          {busy ? "Activating..." : "Activate account"}
        </button>
        <p className="fine-print">
          Need to start over? <Link to="/get-started">Upload again</Link>
        </p>
      </form>
    </div>
  );
}
