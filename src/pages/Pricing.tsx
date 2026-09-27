import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { plans, type Billing, type PlanId } from "../data";
import { Check } from "../components/Icons";

const faqs = [
  {
    q: "Do you apply without asking me?",
    a: "Autopilot prepares an application for each strong match. In this demo the application is simulated in your browser. Nothing is sent to an employer.",
  },
  {
    q: "Which files can I upload?",
    a: "PDF, DOCX, or TXT, up to 10MB. TXT files can be read for a summary and skills. PDF and DOCX are stored by name in this browser.",
  },
  {
    q: "Where does my resume go?",
    a: "It stays in this browser. JobPilot does not upload your file to a server.",
  },
  {
    q: "Can I change plans?",
    a: "Yes. Pick another plan on this page. The choice is saved with your session on this device.",
  },
];

export function PricingPage() {
  const { plan, billing, setPlan, user } = useApp();
  const [cycle, setCycle] = useState<Billing>(billing);
  const [open, setOpen] = useState<number | null>(0);
  const navigate = useNavigate();

  function choose(id: PlanId) {
    setPlan(id, cycle);
    navigate(user ? "/dashboard" : "/get-started");
  }

  return (
    <div className="container narrow-page">
      <header className="page-hero center">
        <p className="eyebrow">Pricing</p>
        <h1>Simple pricing for a search on autopilot.</h1>
        <p className="lede">Start free. Move to Pro or Autopilot when you want the resume tailored for every role.</p>
        <div className="toggle" role="group" aria-label="Billing period">
          <button type="button" className={cycle === "monthly" ? "on" : ""} onClick={() => setCycle("monthly")}>
            Monthly
          </button>
          <button type="button" className={cycle === "yearly" ? "on" : ""} onClick={() => setCycle("yearly")}>
            Yearly
            <span className="save">Save 20%</span>
          </button>
        </div>
      </header>
      <div className="price-grid">
        {plans.map((item) => {
          const amount = cycle === "monthly" ? item.monthly : item.yearly;
          const current = plan === item.id && billing === cycle;
          return (
            <article key={item.id} className={item.popular ? "price-card popular" : "price-card"}>
              {item.popular ? <span className="badge">Most popular</span> : null}
              <h2>{item.name}</h2>
              <p className="price">
                <strong>{amount === 0 ? "$0" : `$${amount}`}</strong>
                <span>{amount === 0 ? "" : "/mo"}</span>
              </p>
              <p className="role">{item.blurb}</p>
              {cycle === "yearly" && amount > 0 ? <p className="role">Billed annually</p> : null}
              <ul>
                {item.features.map((feature) => (
                  <li key={feature}>
                    <span className="check-dot">
                      <Check />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={item.popular ? "btn btn-primary btn-block" : "btn btn-ghost btn-block"}
                onClick={() => choose(item.id)}
                disabled={current}
              >
                {current ? "Current plan" : item.cta}
              </button>
            </article>
          );
        })}
      </div>
      <div className="faq">
        <h2>Questions</h2>
        {faqs.map((item, index) => {
          const expanded = open === index;
          return (
            <div className="faq-item" key={item.q}>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? null : index)}
              >
                {item.q}
                <span aria-hidden="true">{expanded ? "–" : "+"}</span>
              </button>
              {expanded ? <p>{item.a}</p> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
