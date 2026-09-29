import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useApp } from "../context/AppContext";

type MfaStatus = {
  required: boolean;
  enrolled: boolean;
  verified: boolean;
  when?: string | null;
  role?: string;
};

type MfaSetup = {
  secret: string;
  otpauthUrl: string;
  qrDataUrl?: string;
};

export function MfaGate({
  title = "Authenticator required",
  lede = "This account type requires an authenticator app. Scan the QR code once, then enter a 6-digit code for this session.",
  onVerified,
}: {
  title?: string;
  lede?: string;
  onVerified?: () => void | Promise<void>;
}) {
  const { user, refresh } = useApp();
  const [mfa, setMfa] = useState<MfaStatus | null>(null);
  const [mfaSetup, setMfaSetup] = useState<MfaSetup | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaError, setMfaError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showManualSecret, setShowManualSecret] = useState(false);

  useEffect(() => {
    void api<MfaStatus>("/api/mfa")
      .then(setMfa)
      .catch((err: Error & { mfaRequired?: boolean }) => {
        const message = String(err.message || "");
        if (err.mfaRequired || /mfa/i.test(message)) {
          setMfa({
            required: true,
            enrolled: Boolean(user?.mfaEnrolled),
            verified: Boolean(user?.mfaVerified),
          });
        }
      });
  }, [user]);

  async function setupMfa() {
    setMfaError("");
    setBusy(true);
    setShowManualSecret(false);
    try {
      const data = await api<MfaSetup>("/api/mfa/setup", { method: "POST", body: "{}" });
      setMfaSetup(data);
    } catch (err) {
      setMfaError(err instanceof Error ? err.message : "MFA setup failed.");
    } finally {
      setBusy(false);
    }
  }

  async function enableOrVerifyMfa(event?: FormEvent) {
    event?.preventDefault();
    setMfaError("");
    setBusy(true);
    try {
      const path = mfa?.enrolled || user?.mfaEnrolled ? "/api/mfa/verify" : "/api/mfa/enable";
      await api(path, { method: "POST", body: JSON.stringify({ code: mfaCode }) });
      setMfaCode("");
      setMfaSetup(null);
      await refresh();
      const status = await api<MfaStatus>("/api/mfa");
      setMfa(status);
      await onVerified?.();
    } catch (err) {
      setMfaError(err instanceof Error ? err.message : "Invalid code.");
    } finally {
      setBusy(false);
    }
  }

  const enrolled = Boolean(mfa?.enrolled || user?.mfaEnrolled);

  return (
    <div className="admin-gate">
      <section className="admin-card">
        <h1>{title}</h1>
        <p className="lede">{lede}</p>
        {mfaError ? <p className="form-error">{mfaError}</p> : null}
        {!enrolled ? (
          <button className="btn btn-primary btn-sm" type="button" disabled={busy} onClick={() => void setupMfa()}>
            {mfaSetup ? "Regenerate QR code" : "Show authenticator QR code"}
          </button>
        ) : null}
        {mfaSetup ? (
          <div className="mfa-secret">
            {mfaSetup.qrDataUrl ? (
              <div className="mfa-qr">
                <img src={mfaSetup.qrDataUrl} alt="Authenticator QR code" width={220} height={220} />
                <p className="role">Scan with Google Authenticator, Authy, 1Password, or any TOTP app.</p>
              </div>
            ) : (
              <p className="form-error">QR code could not be generated. Enter the secret manually below.</p>
            )}
            <button className="text-btn" type="button" onClick={() => setShowManualSecret((value) => !value)}>
              {showManualSecret ? "Hide manual secret" : "Can't scan? Enter secret manually"}
            </button>
            {showManualSecret || !mfaSetup.qrDataUrl ? (
              <div className="mfa-manual">
                <p>
                  Secret: <code>{mfaSetup.secret}</code>
                </p>
                <p className="role">Account type: TOTP · 6 digits · 30 seconds</p>
              </div>
            ) : null}
          </div>
        ) : null}
        <form onSubmit={(event) => void enableOrVerifyMfa(event)}>
          <label className="field">
            <span>Authenticator code</span>
            <input
              value={mfaCode}
              onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              required
            />
          </label>
          <button className="btn btn-primary btn-sm" type="submit" disabled={busy || mfaCode.length < 6}>
            {busy ? "Saving…" : enrolled ? "Verify MFA" : "Enable MFA"}
          </button>
        </form>
        <p className="role">
          <Link to="/">Back to site</Link>
        </p>
      </section>
    </div>
  );
}

export function useMfaGate() {
  const { user } = useApp();
  const [mfa, setMfa] = useState<MfaStatus | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!user) {
      setMfa(null);
      setChecked(true);
      return;
    }
    setChecked(false);
    void api<MfaStatus>("/api/mfa")
      .then((status) => {
        setMfa(status);
        setChecked(true);
      })
      .catch((err: Error & { mfaRequired?: boolean }) => {
        const message = String(err.message || "");
        if (err.mfaRequired || /mfa/i.test(message)) {
          setMfa({
            required: true,
            enrolled: Boolean(user.mfaEnrolled),
            verified: Boolean(user.mfaVerified),
          });
        } else {
          setMfa({ required: false, enrolled: Boolean(user.mfaEnrolled), verified: Boolean(user.mfaVerified) });
        }
        setChecked(true);
      });
  }, [user]);

  const needsGate = Boolean(checked && mfa?.required && (!mfa.enrolled || !mfa.verified));
  return { mfa, checked, needsGate, setMfa };
}
