import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const data = await api<{ message: string; devLink: string }>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setMessage(data.message);
      setLink(data.devLink || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create a reset link.");
    }
  }

  return (
    <div className="container auth-wrap">
      <form className="auth-card" onSubmit={onSubmit}>
        <p className="eyebrow">Password</p>
        <h1>Reset your password</h1>
        <p className="lede">We will create a one-hour link for this email account.</p>
        {error ? <p className="form-error">{error}</p> : null}
        {message ? <p>{message}</p> : null}
        {link ? (
          <p>
            <Link to={link.replace(/^https?:\/\/[^/]+/, "")}>Open reset link</Link>
          </p>
        ) : null}
        <label className="field">
          <span>Email</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <button className="btn btn-primary btn-block" type="submit">
          Send reset link
        </button>
      </form>
    </div>
  );
}
