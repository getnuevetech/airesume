import { useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useSiteContent } from "../content/siteContent";
import { FileText, GoogleG } from "./Icons";
import { TermsAgreement } from "./TermsAgreement";

type UploadPanelProps = {
  showSample?: boolean;
};

function isAllowedResume(file: File) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".doc") && !name.endsWith(".docx")) {
    return "Save the older Word .doc file as DOCX, then upload that.";
  }
  const allowed = name.endsWith(".pdf") || name.endsWith(".docx") || name.endsWith(".txt") || name.endsWith(".md");
  if (!allowed) return "Use a PDF, DOCX, or TXT file.";
  if (file.size > 10 * 1024 * 1024) return "That file is over 10MB.";
  if (file.size === 0) return "That file is empty.";
  return "";
}

export function UploadPanel({ showSample = false }: UploadPanelProps) {
  const inputId = useId();
  const navigate = useNavigate();
  const { notify } = useApp();
  const { content } = useSiteContent();
  const hero = content.hero;
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [selected, setSelected] = useState<File | null>(null);
  const [error, setError] = useState("");

  function chooseFile(file: File | undefined | null) {
    if (!file) return;
    const problem = isAllowedResume(file);
    if (problem) {
      setError(problem);
      return;
    }
    setSelected(file);
    setError(consent ? "" : "Resume selected. Check the agreement box, then continue.");
  }

  async function uploadFile(file: File) {
    if (!consent) {
      setSelected(file);
      setError("Agree to the terms before we read your resume. Your file is still selected.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const body = new FormData();
      body.append("resume", file);
      body.append("consent", "1");
      const response = await fetch("/api/onboarding/extract", { method: "POST", body, credentials: "include" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "We could not read that file.");
      sessionStorage.setItem("jp-draft", JSON.stringify(data));
      window.dispatchEvent(new Event("jp-draft"));
      notify("We read your resume. Confirm the details to finish your account.");
      navigate("/get-started");
    } catch (err) {
      setError(err instanceof Error ? err.message : "We could not read that file.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadSelected() {
    if (!selected) {
      setError("Choose a resume file first.");
      return;
    }
    await uploadFile(selected);
  }

  async function useSample() {
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/sample-resume.txt");
      if (!response.ok) throw new Error("missing");
      const text = await response.text();
      const file = new File([text], "sample-resume.txt", { type: "text/plain" });
      setSelected(file);
      setBusy(false);
      await uploadFile(file);
    } catch {
      setError("The sample resume could not be loaded.");
      setBusy(false);
    }
  }

  return (
    <div
      className={drag ? "drop drag" : "drop"}
      onDragOver={(event) => {
        event.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDrag(false);
        chooseFile(event.dataTransfer.files?.[0]);
      }}
    >
      <input
        id={inputId}
        className="file-input"
        type="file"
        accept=".pdf,.docx,.txt,.md,application/pdf,text/plain"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          chooseFile(file);
        }}
      />
      <span className="drop-icon">
        <FileText size={28} />
      </span>
      <p className="drop-title">{busy ? "Reading your resume..." : hero.dropTitle}</p>
      <p className="drop-hint">{hero.dropHint}</p>
      {selected ? (
        <p className="drop-file" aria-live="polite">
          Selected: <strong>{selected.name}</strong>
          <button className="text-btn" type="button" onClick={() => setSelected(null)} disabled={busy}>
            Clear
          </button>
        </p>
      ) : null}
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <TermsAgreement checked={consent} onChange={setConsent} includeResume />
      <div className="drop-actions">
        <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => document.getElementById(inputId)?.click()}>
          {selected ? hero.changeFileLabel || "Choose a different file" : hero.uploadLabel}
        </button>
        <button className="btn btn-primary" type="button" disabled={busy || !selected || !consent} onClick={() => void uploadSelected()}>
          {busy ? "Reading..." : selected ? hero.continueSelectedLabel || "Continue with this resume" : hero.continueLabel || "Select a resume to continue"}
        </button>
      </div>
      <p className="or-text">{hero.orLabel}</p>
      <button
        className="btn btn-google btn-block"
        type="button"
        disabled={busy}
        onClick={() => {
          if (!consent) {
            setError("Agree to the terms before creating an account.");
            return;
          }
          window.location.href = "/api/auth/google?consent=1";
        }}
      >
        <GoogleG />
        {hero.googleLabel}
      </button>
      <p className="fine-print">{hero.finePrint}</p>
      {showSample ? (
        <button className="text-btn" type="button" onClick={() => void useSample()} disabled={busy}>
          Use a sample resume
        </button>
      ) : null}
    </div>
  );
}
