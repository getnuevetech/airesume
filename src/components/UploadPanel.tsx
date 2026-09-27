import { useId, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { FileText, GoogleG } from "./Icons";

type UploadPanelProps = {
  showSample?: boolean;
};

export function UploadPanel({ showSample = false }: UploadPanelProps) {
  const inputId = useId();
  const navigate = useNavigate();
  const { user, setResume, openGoogle, notify } = useApp();
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function take(file: File) {
    const name = file.name.toLowerCase();
    const allowed =
      name.endsWith(".pdf") || name.endsWith(".docx") || name.endsWith(".doc") || name.endsWith(".txt");
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
      let text: string | null = null;
      if (name.endsWith(".txt") || file.type.startsWith("text/")) {
        text = (await file.text()).slice(0, 20000);
      }
      await new Promise((resolve) => window.setTimeout(resolve, 700));
      setResume({ name: file.name, size: file.size, text, uploadedAt: Date.now() });
      notify("Resume added. Your profile is ready.");
      navigate(user ? "/dashboard" : "/get-started");
    } catch {
      setError("We could not read that file. Try another one.");
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
      setResume({
        name: "sample-resume.txt",
        size: new Blob([text]).size,
        text,
        uploadedAt: Date.now(),
      });
      notify("Sample resume loaded.");
      navigate(user ? "/dashboard" : "/get-started");
    } catch {
      setError("The sample resume could not be loaded.");
    } finally {
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
      <p className="drop-title">{busy ? "Reading your resume..." : "Drag & drop your resume here"}</p>
      <p className="drop-hint">PDF, DOCX or TXT (up to 10MB)</p>
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
        {busy ? "Uploading..." : "Upload Resume"}
      </button>
      <p className="or-text">or</p>
      <button
        className="btn btn-google btn-block"
        type="button"
        disabled={busy}
        onClick={openGoogle}
      >
        <GoogleG />
        Continue with Google
      </button>
      <p className="fine-print">It&apos;s free and takes less than a minute.</p>
      {showSample ? (
        <button className="text-btn" type="button" onClick={() => void useSample()} disabled={busy}>
          Use a sample resume
        </button>
      ) : null}
    </div>
  );
}
