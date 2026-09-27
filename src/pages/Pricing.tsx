import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { plans, type Billing } from "../data";
import { Check } from "../components/Icons";

type LivePlan = {
  id: string;
  name: string;
  blurb: string;
  monthlyCents: number;
  yearlyCents: number;
  featureLabels: string[];
  popular: boolean;
};

const faqs = [
  {
    q: "Do you apply without asking me?",
    a: "Only if your plan includes auto apply and you turn it on. Each application is saved in your tracker with its own resume version.",
  },
  {
    q: "Which files can I upload?",
    a: "PDF, DOCX, or TXT, up to 10MB. JobPilot reads the file and asks you to confirm the facts before the account is created.",
  },
  {
    q: "Where does my resume go?",
    a: "It is stored with your account. You can edit the profile, keep versions, and publish one at a shareable link.",
  },
  {
    q: "Can I change plans?",
    a: "Yes, when an admin has upgrades or downgrades enabled. Proration and refunds follow the billing rules in admin.",
  },
];

export function PricingPage() {
  const { billing, user } = useApp();
  const [cycle, setCycle] = useState<Billing>(billing);
  const [open, setOpen] = useState<number | null>(0);
  const [live, setLive] = useState<LivePlan[] | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    void fetch("/api/plans")
      .then((response) => response.json())
      .then((data: { plans?: LivePlan[] }) => setLive(data.plans ?? null))
      .catch(() => setLive(null));
  }, []);

  const cards: (LivePlan & { cta: string })[] = live
    ? live.map((item) => ({ ...item, cta: item.monthlyCents === 0 ? "Get started" : `Choose ${item.name}` }))
    : plans.map((item) => ({
        id: item.id,
        name: item.name,
        blurb: item.blurb,
        monthlyCents: Math.round(item.monthly * 100),
        yearlyCents: Math.round(item.yearly * 12 * 100),
        featureLabels: item.features,
        popular: Boolean(item.popular),
        cta: item.cta,
      }));

  function choose() {
    navigate(user ? "/account/plan" : "/get-started");
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
        {cards.map((item) => {
          const cents = cycle === "monthly" ? item.monthlyCents : item.yearlyCents;
          const current = user?.planId === item.id;
          return (
            <article key={item.id} className={item.popular ? "price-card popular" : "price-card"}>
              {item.popular ? <span className="badge">Most popular</span> : null}
              <h2>{item.name}</h2>
              <p className="price">
                <strong>{cents === 0 ? "$0" : `$${(cents / 100).toFixed(0)}`}</strong>
                <span>{cents === 0 ? "" : cycle === "yearly" ? "/yr" : "/mo"}</span>
              </p>
              <p className="role">{item.blurb}</p>
              <ul>
                {item.featureLabels.map((feature) => (
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
                onClick={choose}
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
