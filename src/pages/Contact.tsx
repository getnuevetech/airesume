import { useState, type FormEvent } from "react";

export function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (name.trim().length < 2) {
      setError("Enter your name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email.");
      return;
    }
    if (message.trim().length < 10) {
      setError("Write a message of at least 10 characters.");
      return;
    }
    const notes = JSON.parse(localStorage.getItem("jobpilot-notes") ?? "[]") as unknown[];
    notes.push({ name: name.trim(), email: email.trim(), message: message.trim(), at: Date.now() });
    localStorage.setItem("jobpilot-notes", JSON.stringify(notes));
    setError("");
    setSent(true);
  }

  return (
    <div className="container contact-grid">
      <header className="page-hero">
        <p className="eyebrow">Contact</p>
        <h1>We would like to hear how the search is going.</h1>
        <p className="lede">
          Questions about your profile, a plan, or the product. This demo keeps the note in your browser and does not send email.
        </p>
        <p className="who">hello@jobpilot.app</p>
      </header>
      {sent ? (
        <div className="auth-card" role="status">
          <h2>Thanks, {name.split(" ")[0]}.</h2>
          <p>Your note is saved in this browser only. No email was sent.</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setSent(false);
              setMessage("");
            }}
          >
            Send another note
          </button>
        </div>
      ) : (
        <form className="auth-card" onSubmit={onSubmit}>
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <label className="field">
            <span>Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} required />
          </label>
          <label className="field">
            <span>Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="field">
            <span>Message</span>
            <textarea rows={5} value={message} onChange={(event) => setMessage(event.target.value)} required />
          </label>
          <button className="btn btn-primary btn-block" type="submit">
            Send message
          </button>
        </form>
      )}
    </div>
  );
}
