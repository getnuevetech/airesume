import { useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { useSiteContent } from "../content/siteContent";
import { FileText, GoogleG } from "./Icons";

type UploadPanelProps = {
  showSample?: boolean;
};

export function UploadPanel({ showSample = false }: UploadPanelProps) {
  const inputId = useId();
  const navigate = useNavigate();
  const { openGoogle, notify } = useApp();
  const { content } = useSiteContent();
  const hero = content.hero;
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function take(file: File) {
    const name = file.name.toLowerCase();
    const allowed =
      name.endsWith(".pdf") || name.endsWith(".docx") || name.endsWith(".txt") || name.endsWith(".md");
    if (!allowed) {
      setError("Use a PDF, DOCX, or TXT file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("That file is over 10MB.");
      return;
    }
    if (file.size === 0) {
      setError("That file is empty.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const body = new FormData();
      body.append("resume", file);
      const response = await fetch("/api/onboarding/extract", { method: "POST", body, credentials: "include" });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "We could not read that file.");
      sessionStorage.setItem("jp-draft", JSON.stringify(data));
      window.dispatchEvent(new Event("jp-draft"));
      notify("We read your resume. Confirm the details to finish your account.");
      navigate("/get-started");
    } catch (error) {
      setError(error instanceof Error ? error.message : "We could not read that file.");
    } finally {
      setBusy(false);
    }
  }

  async function useSample() {
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/sample-resume.txt");
      if (!response.ok) throw new Error("missing");
      const text = await response.text();
      const file = new File([text], "sample-resume.txt", { type: "text/plain" });
      setBusy(false);
      await take(file);
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
        const file = event.dataTransfer.files?.[0];
        if (file) void take(file);
      }}
    >
      <input
        id={inputId}
        className="file-input"
        type="file"
        accept=".pdf,.doc,.docx,.txt,application/pdf,text/plain"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void take(file);
        }}
      />
      <span className="drop-icon">
        <FileText size={28} />
      </span>
      <p className="drop-title">{busy ? "Reading your resume..." : hero.dropTitle}</p>
      <p className="drop-hint">{hero.dropHint}</p>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button
        className="btn btn-primary btn-block"
        type="button"
        disabled={busy}
        onClick={() => document.getElementById(inputId)?.click()}
      >
        {busy ? "Reading..." : hero.uploadLabel}
      </button>
      <p className="or-text">{hero.orLabel}</p>
      <button
        className="btn btn-google btn-block"
        type="button"
        disabled={busy}
        onClick={openGoogle}
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
