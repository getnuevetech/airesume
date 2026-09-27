import { useEffect } from "react";
import { useApp } from "../context/AppContext";
import { demoGoogleAccounts, initials } from "../data";

export function GoogleModal() {
  const { googleOpen, closeGoogle, loginGoogle } = useApp();

  useEffect(() => {
    if (!googleOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeGoogle();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [googleOpen, closeGoogle]);

  if (!googleOpen) return null;

  return (
    <div className="modal-back" role="presentation" onMouseDown={closeGoogle}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="google-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <p className="eyebrow">Demo sign-in</p>
        <h2 id="google-title">Continue with Google</h2>
        <p className="modal-copy">
          Choose an account. This demo stays in your browser and does not contact Google.
        </p>
        <div className="account-list">
          {demoGoogleAccounts.map((account) => (
            <button
              key={account.email}
              type="button"
              className="account-row"
              onClick={() => loginGoogle(account.name, account.email)}
            >
              <span className="user-chip">{initials(account.name)}</span>
              <span>
                <strong>{account.name}</strong>
                <em>{account.email}</em>
              </span>
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-ghost btn-block" onClick={closeGoogle}>
          Cancel
        </button>
      </div>
    </div>
  );
}
