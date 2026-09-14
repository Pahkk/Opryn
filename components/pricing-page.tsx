"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, LoaderCircle } from "lucide-react";
import type { BillingInterval, PlanId } from "@/lib/billing/plans";
import { PLAN_DETAILS, PLAN_FEATURES } from "@/lib/billing/plans";

const coreFeatures = [
  "Ask Opryn and employee Q&A",
  `One owner + up to ${PLAN_FEATURES.core.teamLimit} employees`,
  "Processes, company rules and training",
  "Text and audio learning",
  "Document uploads and Google Drive import",
  "External AI Connections and secure Agent API",
  "Knowledge gaps and owner review",
];
const premiumFeatures = [
  "Everything in Core",
  `One owner + up to ${PLAN_FEATURES.premium.teamLimit} employees`,
  "Video and screen-recording learning",
  "Learn From Calls",
  "Call insights and reviewed examples",
  "ChatGPT and Claude connections",
  "Secure remote MCP access",
];

export function PricingPage({
  signedIn,
  canManage,
  annualEnabled,
  billingReady,
  initialCheckout,
}: {
  signedIn: boolean;
  canManage: boolean;
  annualEnabled: boolean;
  billingReady: boolean;
  initialCheckout?: PlanId;
}) {
  const [interval, setInterval] = useState<BillingInterval>("month");
  const started = useRef(false);
  const [redirecting, setRedirecting] = useState(false);
  useEffect(() => {
    if (
      !initialCheckout ||
      !signedIn ||
      !canManage ||
      !billingReady ||
      started.current
    )
      return;
    started.current = true;
    setRedirecting(true);
    void fetch("/api/billing/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan: initialCheckout, interval: "month" }),
    })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok || !body.url) throw new Error();
        window.location.assign(body.url);
      })
      .catch(() => setRedirecting(false));
  }, [initialCheckout, signedIn, canManage, billingReady]);
  return (
    <main className="pricing-experience px-4 pb-24 pt-32 text-[var(--editorial-ink)] sm:px-6">
      {redirecting ? (
        <div
          role="status"
          className="fixed inset-0 z-[100] grid place-items-center bg-white/85 backdrop-blur-sm"
        >
          <div className="text-center">
            <LoaderCircle className="mx-auto size-8 animate-spin text-[var(--editorial-brand)]" />
            <p className="mt-4 text-sm font-semibold">
              Opening secure checkout…
            </p>
          </div>
        </div>
      ) : null}
      <div className="mx-auto max-w-6xl">
        {signedIn ? (
          <Link
            href="/app"
            className="mb-9 inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#d8dfe8] bg-white px-4 text-sm font-semibold text-[var(--editorial-deep)] shadow-[0_6px_20px_rgba(25,38,59,.04)] transition hover:-translate-y-0.5 hover:border-[#b9c5d4] hover:bg-[var(--editorial-secondary)]"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Home
          </Link>
        ) : null}
        <div className="pricing-hero text-center">
          <p className="editorial-index justify-center">Pricing</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-.055em] sm:text-6xl">
            Company knowledge for people and AI.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[var(--editorial-copy)] sm:text-lg">
            Start with a shared company memory. Add deeper learning and AI
            connections when you need them.
          </p>
          {annualEnabled ? (
            <div className="mx-auto mt-8 inline-flex border border-[#cfd6df] bg-white p-1">
              <ToggleButton
                active={interval === "month"}
                onClick={() => setInterval("month")}
              >
                Monthly
              </ToggleButton>
              <ToggleButton
                active={interval === "year"}
                onClick={() => setInterval("year")}
              >
                Annual
              </ToggleButton>
            </div>
          ) : null}
        </div>
        <div className="pricing-grid mt-14 grid items-stretch overflow-hidden border-y border-[#cbd3dd] lg:grid-cols-2">
          <PlanCard
            plan="core"
            title="Opryn Core"
            price={
              interval === "year"
                ? PLAN_DETAILS.core.annualMonthlyEquivalent
                : PLAN_DETAILS.core.monthlyPrice
            }
            billingNote={
              interval === "year"
                ? `$${PLAN_DETAILS.core.annualMonthlyEquivalent * 12} USD billed annually`
                : "USD billed monthly"
            }
            copy="Build company knowledge for your team and API-connected systems."
            features={coreFeatures}
            interval={interval}
            signedIn={signedIn}
            canManage={canManage}
            billingReady={billingReady}
          />
          <PlanCard
            plan="premium"
            title="Opryn Premium"
            price={
              interval === "year"
                ? PLAN_DETAILS.premium.annualMonthlyEquivalent
                : PLAN_DETAILS.premium.monthlyPrice
            }
            billingNote={
              interval === "year"
                ? `$${PLAN_DETAILS.premium.annualMonthlyEquivalent * 12} USD billed annually`
                : "USD billed monthly"
            }
            copy="Learn from richer business activity and connect directly to supported AI clients."
            features={premiumFeatures}
            interval={interval}
            signedIn={signedIn}
            canManage={canManage}
            billingReady={billingReady}
            featured
          />
        </div>
        <p className="launch-fine mt-6">
          Pending invitations count toward the employee limit; one owner is
          excluded. At the limit, new invitations are blocked. Upgrade Core to
          Premium or remove a pending invitation. Standard plans have no paid
          extra-seat option.{" "}
          <Link href="/contact">Contact us for larger teams</Link>.
        </p>
        <section
          className="plan-comparison"
          aria-labelledby="plan-comparison-title"
        >
          <h2 id="plan-comparison-title">The details, side by side.</h2>
          <div className="comparison-scroll">
            <table>
              <caption>Core and Premium capabilities</caption>
              <thead>
                <tr>
                  <th scope="col">Capability</th>
                  <th scope="col">Core</th>
                  <th scope="col">Premium</th>
                </tr>
              </thead>
              <tbody>
                {[
                  [
                    "Employees, plus one owner",
                    `Up to ${PLAN_FEATURES.core.teamLimit}`,
                    `Up to ${PLAN_FEATURES.premium.teamLimit}`,
                  ],
                  [
                    "Ask, processes, training and review",
                    "Included",
                    "Included",
                  ],
                  [
                    "Documents, Google files, text and audio",
                    "Included",
                    "Included",
                  ],
                  [
                    "External AI Connections / Agent API",
                    "Included",
                    "Included",
                  ],
                  [
                    "ChatGPT / Claude through remote MCP",
                    "Not included",
                    "Included; supported client required",
                  ],
                  [
                    "Video / screen recordings / call learning",
                    "Not included",
                    "Included",
                  ],
                  [
                    "Knowledge gaps and role-based learning",
                    "Included",
                    "Included",
                  ],
                  [
                    "Insights",
                    "Basic time-saved tracking",
                    "Advanced insights and call analysis",
                  ],
                  [
                    "Trial",
                    "No Core trial",
                    "5-day trial available during onboarding, once per organization",
                  ],
                ].map(([label, core, premium]) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    <td>{core}</td>
                    <td>{premium}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <PricingFAQ />
      </div>
    </main>
  );
}

function PlanCard({
  plan,
  title,
  price,
  billingNote,
  copy,
  features,
  interval,
  signedIn,
  canManage,
  billingReady,
  featured = false,
}: {
  plan: PlanId;
  title: string;
  price: number;
  billingNote: string;
  copy: string;
  features: string[];
  interval: BillingInterval;
  signedIn: boolean;
  canManage: boolean;
  billingReady: boolean;
  featured?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  async function checkout() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan, interval }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? "Unable to start checkout.");
      window.location.assign(body.url);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to start checkout.",
      );
      setLoading(false);
    }
  }
  const signupPath = `/signup?next=${encodeURIComponent(`/onboarding?next=${encodeURIComponent(`/pricing?checkout=${plan}`)}`)}`;
  return (
    <article
      className={`pricing-plan relative flex flex-col bg-white p-7 sm:p-10 ${featured ? "pricing-plan--featured border-t border-[#cbd3dd] bg-[var(--editorial-active)] lg:border-l lg:border-t-0" : ""}`}
    >
      {featured ? (
        <span className="absolute right-7 top-8 text-[10px] font-bold uppercase tracking-[.12em] text-[var(--editorial-brand)] sm:right-10 sm:top-10">
          Recommended
        </span>
      ) : null}
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-3 min-h-14 max-w-lg text-sm leading-6 text-[var(--editorial-copy)]">
        {copy}
      </p>
      <div className="pricing-price-line mt-6 flex items-baseline gap-3">
        <strong className="text-5xl font-semibold tracking-[-.055em]">
          ${price}
        </strong>
        <span className="whitespace-nowrap text-base tracking-normal text-[var(--editorial-copy)]">
          /month
        </span>
      </div>
      <p className="mt-1 text-xs text-[var(--editorial-copy)]">{billingNote}</p>
      {featured ? (
        <p className="mt-4 text-xs font-semibold text-[var(--editorial-brand)]">
          5-day Premium trial available during onboarding
        </p>
      ) : null}
      {featured ? (
        <p className="mt-2 text-sm leading-6 text-[var(--editorial-copy)]">
          Choose a trial after your first sourced answer in onboarding, or
          purchase now. This page starts a paid plan without a trial. Checkout
          confirms the payment method and renewal amount.
        </p>
      ) : null}
      {!signedIn ? (
        <Link href={signupPath} className={buttonClass(featured)}>
          {plan === "premium" ? "Start Premium" : "Start with Core"}
          <span aria-hidden="true">→</span>
        </Link>
      ) : canManage ? (
        <button
          type="button"
          onClick={() => void checkout()}
          disabled={loading || !billingReady}
          className={buttonClass(featured)}
        >
          {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
          {!billingReady
            ? "Billing setup required"
            : plan === "premium"
              ? "Start Premium"
              : "Start with Core"}
          {!loading && billingReady ? <span aria-hidden="true">→</span> : null}
        </button>
      ) : (
        <p className="border border-[#d9dfe6] bg-[var(--editorial-secondary)] p-3 text-center text-xs font-semibold text-[var(--editorial-copy)]">
          Ask a workspace owner to change the plan.
        </p>
      )}
      {error ? (
        <p role="alert" className="mt-3 text-xs text-[var(--editorial-error)]">
          {error}
        </p>
      ) : null}
      <ul className="my-8 border-t border-[#d7dde5]">
        {features.map((feature) => (
          <li
            key={feature}
            className="pricing-feature border-b border-[#dce2e8] py-3 text-sm text-[var(--editorial-copy)]"
          >
            {feature}
          </li>
        ))}
      </ul>
    </article>
  );
}

function buttonClass(featured: boolean) {
  return `mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold transition duration-300 disabled:cursor-not-allowed disabled:opacity-55 ${featured ? "bg-[var(--editorial-brand)] text-white hover:-translate-y-0.5 hover:bg-[var(--editorial-deep)]" : "border border-[#cbd3dd] bg-white text-[var(--editorial-deep)] hover:-translate-y-0.5 hover:bg-[var(--editorial-secondary)]"}`;
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`pricing-toggle px-4 py-2 text-xs font-semibold transition-colors duration-300 ${active ? "is-active bg-[var(--editorial-brand)] text-white" : "text-[var(--editorial-copy)]"}`}
    >
      {children}
    </button>
  );
}

function PricingFAQ() {
  const items = [
    [
      "Can I upgrade later?",
      "Yes. Organizations can upgrade from Core to Premium at any time.",
    ],
    [
      "What happens if I downgrade?",
      "Approved company knowledge remains available. New video and call analysis becomes unavailable.",
    ],
    [
      "Do employees need separate subscriptions?",
      "No. Employee access is included up to the plan's team limit.",
    ],
    [
      "Is call recording automatic?",
      "You can upload selected recordings. Configured Twilio call learning can automatically process eligible recordings according to your organization's settings and consent responsibilities.",
    ],
    [
      "Does Opryn listen without permission?",
      "The business must authorize recordings and comply with applicable consent rules. Opryn accepts selected uploads and recordings from explicitly configured call integrations; it does not monitor employees' microphones or screens in the background.",
    ],
  ];
  return (
    <section className="pricing-faq mx-auto mt-20 max-w-3xl">
      <h2 className="text-center text-3xl font-semibold tracking-[-.04em]">
        Pricing questions
      </h2>
      <div className="mt-8 divide-y divide-[#d8dee6] border-y border-[#cfd6df] px-1 sm:px-3">
        {items.map(([question, answer]) => (
          <details key={question} className="group py-5">
            <summary className="cursor-pointer list-none text-sm font-semibold">
              {question}
            </summary>
            <p className="mt-3 text-sm leading-6 text-[var(--editorial-copy)]">
              {answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
