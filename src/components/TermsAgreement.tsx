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
          terms
        </Link>{" "}
        and{" "}
        <Link to="/privacy" onClick={(event) => event.stopPropagation()}>
          privacy policy
        </Link>
        {includeResume ? ", and I agree that my resume can be read to fill this account" : ""}.
      </span>
    </div>
  );
}
