import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { GoogleG } from "../components/Icons";

export function SignInPage() {
  const { user, resume, login, openGoogle } = useApp();
  const navigate = useNavigate();
  useEffect(() => {
    if (user) navigate(resume ? "/dashboard" : "/get-started", { replace: true });
  }, [user, resume, navigate]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter the email and password for your account.");
      return;
    }
    const message = login(email, password);
    setError(message ?? "");
  }

  return (
    <div className="container auth-wrap">
      <form className="auth-card" onSubmit={onSubmit}>
        <p className="eyebrow">Welcome back</p>
        <h1>Sign in</h1>
        <p className="lede">Pick up your profile and the roles already in motion.</p>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Password</span>
          <span className="password-row">
            <input
              type={show ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button type="button" className="text-btn" onClick={() => setShow((value) => !value)}>
              {show ? "Hide" : "Show"}
            </button>
          </span>
        </label>
        <button className="btn btn-primary btn-block" type="submit">
          Sign in
        </button>
        <p className="or-text">or</p>
        <button className="btn btn-google btn-block" type="button" onClick={openGoogle}>
          <GoogleG />
          Continue with Google
        </button>
        <p className="fine-print">
          New to JobPilot? <Link to="/get-started">Get started</Link>
        </p>
      </form>
    </div>
  );
}
