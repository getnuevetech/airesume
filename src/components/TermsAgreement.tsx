import { Link } from "react-router-dom";

type TermsAgreementProps = {
  checked: boolean;
  onChange: (value: boolean) => void;
  includeResume?: boolean;
  required?: boolean;
};

export function TermsAgreement({ checked, onChange, includeResume = false, required = true }: TermsAgreementProps) {
  return (
    <div className="check-row terms">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        required={required}
      />
      <span>
        I agree to the{" "}
        <Link to="/terms" onClick={(event) => event.stopPropagation()}>
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link to="/privacy" onClick={(event) => event.stopPropagation()}>
          Privacy &amp; Data Use Policy
        </Link>
        {includeResume
          ? ". I confirm this resume is mine or I am authorized to upload it, and JobPilot may extract its contents to create a temporary draft profile"
          : ""}
        .
      </span>
    </div>
  );
}
