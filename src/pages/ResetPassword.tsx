import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api";

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token: params.get("token") || "", password }),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset the password.");
    }
  }

  return (
    <div className="container auth-wrap">
      <form className="auth-card" onSubmit={onSubmit}>
        <p className="eyebrow">Password</p>
        <h1>Choose a new password</h1>
        {done ? (
          <p>
            Password updated. <Link to="/signin">Sign in</Link>
          </p>
        ) : (
          <>
            {error ? <p className="form-error">{error}</p> : null}
            <label className="field">
              <span>New password</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
            </label>
            <button className="btn btn-primary btn-block" type="submit">
              Update password
            </button>
          </>
        )}
      </form>
    </div>
  );
}
