import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { UploadPanel } from "../components/UploadPanel";
import { useApp } from "../context/AppContext";

type Draft = {
  draftId: string;
  profile: {
    name: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    summary: string;
    skills: string[];
    employment: { title: string; employer: string; bullets: string[] }[];
    education: string[];
  };
  facts: { fact_id: string; statement: string; confidence: number }[];
  questions: string[];
  warnings: string[];
  provider: string;
  model: string;
};

export function GetStartedPage() {
  const { user, refresh, notify } = useApp();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [summary, setSummary] = useState("");
  const [password, setPassword] = useState("");
  const [salary, setSalary] = useState("");
  const [workArrangement, setWorkArrangement] = useState("");
  const [locations, setLocations] = useState("");
  const [workAuthorization, setWorkAuthorization] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const apply = () => {
      const raw = sessionStorage.getItem("jp-draft");
      if (!raw) return;
      const parsed = JSON.parse(raw) as Draft;
      setDraft(parsed);
      setName(parsed.profile.name || "");
      setEmail(parsed.profile.email || "");
      setPhone(parsed.profile.phone || "");
      setAddress(parsed.profile.address || "");
      setCity(parsed.profile.city || "");
      setSummary(parsed.profile.summary || "");
    };
    apply();
    window.addEventListener("jp-draft", apply);
    return () => window.removeEventListener("jp-draft", apply);
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setError("");
    try {
      await api("/api/onboarding/activate", {
        method: "POST",
        body: JSON.stringify({
          draftId: draft.draftId,
          name,
          email,
          phone,
          address,
          city,
          summary,
          password,
          salary,
          workArrangement,
          locations,
          workAuthorization,
          consent,
        }),
      });
      sessionStorage.removeItem("jp-draft");
      await refresh();
      notify("Account created from your resume.");
      navigate("/account");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the account.");
    }
  }

  if (!draft) {
    return (
      <div className="container start-grid">
        <div className="page-hero">
          <p className="eyebrow">Get started</p>
          <h1>Upload your resume to create your account.</h1>
          <p className="lede">
            The career extractor reads your name, email, phone, location, experience, and skills, then asks you to confirm them before the account is activated.
          </p>
        </div>
        <UploadPanel showSample />
      </div>
    );
  }

  return (
    <div className="container start-grid">
      <div className="page-hero">
        <p className="eyebrow">Confirm your profile</p>
        <h1>We drafted your account from the resume.</h1>
        <p className="lede">
          Extracted with {draft.provider} ({draft.model}). Nothing here is invented. Correct anything that is outdated, then activate the account.
        </p>
        {draft.warnings.map((warning) => (
          <p className="form-error" key={warning}>
            {warning}
          </p>
        ))}
        <div className="chips">
          {draft.profile.skills.map((skill) => (
            <span className="chip" key={skill}>
              {skill}
            </span>
          ))}
        </div>
        <ul className="fact-list">
          {draft.facts.slice(0, 8).map((fact) => (
            <li key={fact.fact_id}>{fact.statement}</li>
          ))}
        </ul>
        {user ? (
          <p>
            You are already signed in as {user.email}. <Link to="/account">Open your account</Link> or sign out to create another account.
          </p>
        ) : null}
      </div>
      <form className="auth-card" onSubmit={onSubmit}>
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
        <label className="field">
          <span>Full name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="field">
          <span>Email</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label className="field">
          <span>Mobile</span>
          <input value={phone} onChange={(event) => setPhone(event.target.value)} />
        </label>
        <label className="field">
          <span>Address</span>
          <input value={address} onChange={(event) => setAddress(event.target.value)} />
        </label>
        <label className="field">
          <span>City</span>
          <input value={city} onChange={(event) => setCity(event.target.value)} />
        </label>
        <label className="field">
          <span>Summary</span>
          <textarea rows={4} value={summary} onChange={(event) => setSummary(event.target.value)} />
        </label>
        <label className="field">
          <span>Target salary</span>
          <input value={salary} onChange={(event) => setSalary(event.target.value)} placeholder="Optional" />
        </label>
        <label className="field">
          <span>Work arrangement</span>
          <input value={workArrangement} onChange={(event) => setWorkArrangement(event.target.value)} placeholder="Remote, hybrid, or on-site" />
        </label>
        <label className="field">
          <span>Locations</span>
          <input value={locations} onChange={(event) => setLocations(event.target.value)} placeholder="Optional" />
        </label>
        <label className="field">
          <span>Work authorization</span>
          <input value={workAuthorization} onChange={(event) => setWorkAuthorization(event.target.value)} placeholder="You confirm this. We do not guess it." />
        </label>
        <label className="field">
          <span>Password</span>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
        </label>
        <label className="check-row">
          <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} required />
          I confirm these details and agree to the terms, privacy policy, and AI processing of this resume.
        </label>
        {draft.questions.length ? <p className="role">{draft.questions.join(" ")}</p> : null}
        <button className="btn btn-primary btn-block" type="submit" disabled={Boolean(user)}>
          Create account
        </button>
        <p className="fine-print">
          Already have an account? <Link to="/signin">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
