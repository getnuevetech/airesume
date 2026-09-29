import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { TermsAgreement } from "../components/TermsAgreement";
import { UploadPanel } from "../components/UploadPanel";
import { useApp } from "../context/AppContext";
import { optionsForPreferenceKey, type PreferenceOption } from "../preferenceOptions";

type PrefField = {
  key: string;
  label: string;
  placeholder: string;
  question: string;
  inputType?: string;
  options?: PreferenceOption[];
};

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
  warnings?: string[];
  missingPreferences?: PrefField[];
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
  const [usePassword, setUsePassword] = useState(false);
  const [salary, setSalary] = useState("");
  const [workArrangement, setWorkArrangement] = useState("");
  const [locations, setLocations] = useState("");
  const [workAuthorization, setWorkAuthorization] = useState("");
  const [consent, setConsent] = useState(false);
  const [directConsent, setDirectConsent] = useState(false);
  const [directName, setDirectName] = useState("");
  const [directEmail, setDirectEmail] = useState("");
  const [directPassword, setDirectPassword] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [devLink, setDevLink] = useState("");
  const [devCode, setDevCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "terms") {
      setError("Agree to the terms before creating an account.");
    }
  }, []);

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

  const prefValues = useMemo(
    () => ({ salary, workArrangement, locations, workAuthorization }),
    [salary, workArrangement, locations, workAuthorization],
  );

  const missingPrefs = useMemo(() => {
    const listed = draft?.missingPreferences;
    if (listed?.length) {
      return listed.filter((field) => !String(prefValues[field.key as keyof typeof prefValues] || "").trim());
    }
    const fields: PrefField[] = [
      {
        key: "salary",
        label: "Target salary",
        placeholder: "Select a range",
        question: "What salary range are you targeting?",
        inputType: "select",
        options: optionsForPreferenceKey("salary") || [],
      },
      {
        key: "workArrangement",
        label: "Work arrangement",
        placeholder: "Select an option",
        question: "Are you open to remote, hybrid, or on-site work?",
        inputType: "select",
        options: optionsForPreferenceKey("workArrangement") || [],
      },
      { key: "locations", label: "Locations", placeholder: "Optional", question: "Which locations are acceptable?", inputType: "text" },
      {
        key: "workAuthorization",
        label: "Work authorization",
        placeholder: "Select an option",
        question: "Are you authorized to work in the target country?",
        inputType: "select",
        options: optionsForPreferenceKey("workAuthorization") || [],
      },
    ];
    return fields.filter((field) => {
      if (field.key === "locations" && city.trim()) return false;
      return !String(prefValues[field.key as keyof typeof prefValues] || "").trim();
    });
  }, [draft, prefValues, city]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setError("");
    try {
      const result = await api<{
        pending?: boolean;
        email?: string;
        message?: string;
        devLink?: string;
        devCode?: string;
        user?: unknown;
      }>("/api/onboarding/activate", {
        method: "POST",
        body: JSON.stringify({
          draftId: draft.draftId,
          name,
          email,
          phone,
          address,
          city,
          summary,
          password: usePassword ? password : "",
          mode: usePassword ? "password" : "magic",
          salary,
          workArrangement,
          locations,
          workAuthorization,
          consent,
        }),
      });
      if (result.pending) {
        setPendingEmail(result.email || email);
        setDevLink(result.devLink || "");
        setDevCode(result.devCode || "");
        notify(result.message || "Check your email to activate.");
        return;
      }
      sessionStorage.removeItem("jp-draft");
      await refresh();
      notify("Account created from your resume.");
      navigate("/account");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the account.");
    }
  }

  async function onDirect(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await api("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: directName,
          email: directEmail,
          password: directPassword,
          consent: directConsent,
        }),
      });
      await refresh();
      notify("Account created.");
      navigate("/account");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the account.");
    }
  }

  if (pendingEmail) {
    return (
      <div className="container auth-wrap">
        <div className="auth-card">
          <p className="eyebrow">Check your email</p>
          <h1>Confirm {pendingEmail}</h1>
          <p className="lede">
            We sent an activation link and a one-time code. Open the link, or enter the code on the verify page, to finish your account.
          </p>
          {devLink ? (
            <p className="role">
              Dev activation link: <Link to={devLink.replace(/^https?:\/\/[^/]+/, "")}>{devLink}</Link>
            </p>
          ) : null}
          {devCode ? <p className="role">Dev code: {devCode}</p> : null}
          <Link className="btn btn-primary btn-block" to={`/verify?email=${encodeURIComponent(pendingEmail)}`}>
            Enter activation code
          </Link>
          <p className="fine-print">
            Wrong email? <button className="text-btn" type="button" onClick={() => setPendingEmail("")}>Go back</button>
          </p>
        </div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="container start-grid">
        <div className="page-hero">
          <p className="eyebrow">Get started</p>
          <h1>Create your account.</h1>
          <p className="lede">
            Upload a resume and confirm the details, or enter your name and email directly. Either way, agree to the terms before the account is created.
          </p>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <div className="start-stack">
          <UploadPanel showSample />
          <form className="auth-card direct-card" onSubmit={onDirect}>
            <h2>Create an account directly</h2>
            <p className="lede">Use this if you do not have a resume to upload yet.</p>
            <label className="field">
              <span>Full name</span>
              <input value={directName} onChange={(event) => setDirectName(event.target.value)} required />
            </label>
            <label className="field">
              <span>Email</span>
              <input type="email" value={directEmail} onChange={(event) => setDirectEmail(event.target.value)} required />
            </label>
            <label className="field">
              <span>Password</span>
              <input type="password" value={directPassword} onChange={(event) => setDirectPassword(event.target.value)} minLength={8} required />
            </label>
            <TermsAgreement checked={directConsent} onChange={setDirectConsent} />
            <button className="btn btn-primary btn-block" type="submit">
              Create account
            </button>
            <p className="fine-print">
              Already have an account? <Link to="/signin">Sign in</Link>
            </p>
          </form>
        </div>
      </div>
    );
  }

  const setters: Record<string, (value: string) => void> = {
    salary: setSalary,
    workArrangement: setWorkArrangement,
    locations: setLocations,
    workAuthorization: setWorkAuthorization,
  };

  const topTitle = draft.profile.employment?.[0]?.title || "Professional";
  const topEmployer = draft.profile.employment?.[0]?.employer;
  const headlineBits = [topTitle, topEmployer ? `most recently at ${topEmployer}` : null].filter(Boolean).join(" · ");
  const skillPreview = draft.profile.skills.slice(0, 6);

  return (
    <div className="container start-grid">
      <div className="page-hero">
        <p className="eyebrow">Your career profile is ready</p>
        <h1>{draft.profile.name ? `${draft.profile.name.split(" ")[0]}, we built your draft profile.` : "We built your draft profile."}</h1>
        <p className="lede activation-summary">
          {headlineBits}
          {draft.profile.city ? ` · ${draft.profile.city}` : ""}
        </p>
        {skillPreview.length ? (
          <div className="chips" aria-label="Skills from your resume">
            {skillPreview.map((skill) => (
              <span className="chip" key={skill}>
                {skill}
              </span>
            ))}
          </div>
        ) : null}
        <div className="activation-teaser" role="status">
          <p className="activation-teaser-title">We found relevant opportunities based on your background.</p>
          <p className="role">
            Complete the remaining required details to view your strongest matches. Nothing is sent until you review.
          </p>
        </div>
        {(draft.warnings || []).map((warning) => (
          <p className="form-error" role="alert" key={warning}>
            {warning}
          </p>
        ))}
        {draft.questions.length ? (
          <div className="pref-questions" role="status">
            <p className="role">Please review these details before activating:</p>
            <ul className="fact-list">
              {draft.questions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {missingPrefs.length ? (
          <div className="pref-questions">
            <p className="role">Only these preferences are still needed for matching:</p>
            <ul className="fact-list">
              {missingPrefs.map((field) => (
                <li key={field.key}>{field.question}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="role">Preferences look complete enough to unlock strongest matches after activation.</p>
        )}
        <ul className="fact-list">
          {draft.facts
            .filter((fact) => fact.statement && !/[\uE000-\uF8FF≡¼½¾¤¦§☒ØÐÞ]/.test(fact.statement))
            .slice(0, 6)
            .map((fact) => (
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
        {missingPrefs.map((field) => {
          const options = field.options?.length ? field.options : optionsForPreferenceKey(field.key);
          const value = prefValues[field.key as keyof typeof prefValues];
          if (field.inputType === "select" || options) {
            return (
              <label className="field" key={field.key}>
                <span>{field.label}</span>
                <select value={value} onChange={(event) => setters[field.key]?.(event.target.value)} required>
                  {(options || []).map((option) => (
                    <option key={`${field.key}-${option.value || "empty"}`} value={option.value} disabled={!option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            );
          }
          return (
            <label className="field" key={field.key}>
              <span>{field.label}</span>
              <input
                value={value}
                onChange={(event) => setters[field.key]?.(event.target.value)}
                placeholder={field.placeholder}
              />
            </label>
          );
        })}
        <label className="check-row">
          <input type="checkbox" checked={usePassword} onChange={(event) => setUsePassword(event.target.checked)} />
          <span>Set a password now instead of email activation</span>
        </label>
        {usePassword ? (
          <label className="field">
            <span>Password</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
          </label>
        ) : (
          <p className="role">We will email a one-time activation link and code to confirm this address.</p>
        )}
        <TermsAgreement checked={consent} onChange={setConsent} includeResume />
        <button className="btn btn-primary btn-block" type="submit" disabled={Boolean(user)}>
          {usePassword ? "Create account" : "Email me an activation link"}
        </button>
        <p className="fine-print">
          Already have an account? <Link to="/signin">Sign in</Link>
        </p>
      </form>
    </div>
  );
}
