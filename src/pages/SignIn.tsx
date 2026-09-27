import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { GoogleG } from "../components/Icons";

export function SignInPage() {
  const { user, login, openGoogle } = useApp();
  const navigate = useNavigate();
  useEffect(() => {
    if (!user) return;
    navigate(user.role === "admin" ? "/admin" : "/dashboard", { replace: true });
  }, [user, navigate]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "google") {
      setError("Google sign-in is not configured on this server yet. Upload a resume or use your email.");
    }
    if (params.get("error") === "disabled") setError("This account is disabled.");
  }, []);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!email.trim() || !password) {
      setError("Enter the email and password for your account.");
      return;
    }
    void login(email, password).then((message) => setError(message ?? ""));
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
          <Link to="/forgot-password">Forgot password?</Link>
          <br />
          New to JobPilot? <Link to="/get-started">Upload a resume</Link>
        </p>
      </form>
    </div>
  );
}
