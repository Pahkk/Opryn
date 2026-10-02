"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { MotionTabs, ActiveIndicator } from "@/components/motion/motion-tabs";
import { MotionPanel } from "@/components/motion/motion-panel";
import { PresenceSwap } from "@/components/motion/presence-swap";
import { OprynAction } from "@/components/motion/opryn-action";
import { SystemLoading } from "@/components/motion/system-loading";
import SoftBlurIn from "@/components/smoothui/soft-blur-in";
import {
  EditorialAction,
  EditorialHeading,
} from "@/components/marketing/editorial-motion";
import { useProductReducedMotion } from "@/lib/motion/use-product-motion";
import type { BillingInterval, PlanId } from "@/lib/billing/plans";
import { PLAN_DETAILS, PLAN_FEATURES } from "@/lib/billing/plans";
import "@/components/marketing/editorial-home.css";
import "@/components/marketing/public-editorial.css";

const features = {
  core: [
    `One owner + ${PLAN_FEATURES.core.teamLimit} employees`,
    "Ask, teach and review knowledge",
    "Documents, text and audio learning",
    "Google file imports",
    "Configured Slack and Teams",
    "External AI connections + Agent API",
  ],
  premium: [
    "Everything in Starter",
    `One owner + ${PLAN_FEATURES.premium.teamLimit} employees`,
    "Video and screen-recording learning",
    "Learn from selected calls",
    "Supported ChatGPT / Claude connections",
    "Conversation learning + advanced insights",
  ],
};

type Props = {
  signedIn: boolean;
  canManage: boolean;
  annualEnabled: boolean;
  annualMonthlyPrices?: { core: number; premium: number } | null;
  billingReady: boolean;
  initialCheckout?: PlanId;
  initialInterval?: BillingInterval;
  trial?: { days: number; plan: PlanId } | null;
};

export function PricingPage({
  signedIn,
  canManage,
  annualEnabled,
  annualMonthlyPrices,
  billingReady,
  initialCheckout,
  initialInterval = "month",
  trial,
}: Props) {
  const [interval, setInterval] = useState<BillingInterval>(initialInterval);
  const [pending, setPending] = useState<PlanId | null>(null);
  const [error, setError] = useState("");
  const [compare, setCompare] = useState(false);
  const started = useRef(false);
  const lock = useRef(false);
  const reduced = useProductReducedMotion();

  const checkout = useCallback(
    async (plan: PlanId, cadence: BillingInterval) => {
      if (lock.current || !signedIn || !canManage || !billingReady) return;
      lock.current = true;
      setPending(plan);
      setError("");
      try {
        const response = await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ plan, interval: cadence }),
        });
        const body = await response.json();
        if (!response.ok || typeof body.url !== "string" || !body.url)
          throw new Error(
            body.error ?? "Checkout couldn’t open. Please try again.",
          );
        // Checkout URL only comes from the existing, authenticated billing handler.
        window.location.assign(body.url);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Checkout couldn’t open. Please try again.",
        );
        setPending(null);
        lock.current = false;
      }
    },
    [signedIn, canManage, billingReady],
  );

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
    void checkout(initialCheckout, initialInterval);
  }, [
    initialCheckout,
    initialInterval,
    signedIn,
    canManage,
    billingReady,
    checkout,
  ]);

  const comparison = [
    [
      "Employees, plus one owner",
      `Up to ${PLAN_FEATURES.core.teamLimit}`,
      `Up to ${PLAN_FEATURES.premium.teamLimit}`,
    ],
    ["Ask, processes, training and review", "Included", "Included"],
    ["Documents, Google files, text and audio", "Included", "Included"],
    ["External AI connections / Agent API", "Included", "Included"],
    [
      "Supported ChatGPT / Claude connections",
      "Not included",
      "Included; supported provider setup required",
    ],
    [
      "Conversation learning",
      PLAN_FEATURES.core.ai_conversation_learning ? "Included" : "Not included",
      PLAN_FEATURES.premium.ai_conversation_learning
        ? "Included; explicitly sent context"
        : "Not included",
    ],
    ["Video, screen recordings and call learning", "Not included", "Included"],
    ["Knowledge gaps and role-based learning", "Included", "Included"],
    [
      "Insights",
      "Basic time-saved tracking",
      "Advanced insights and call analysis",
    ],
  ];

  return (
    <main id="top" className="opryn-editorial-pricing">
      {pending && (
        <div role="status" className="pricing-checkout-overlay">
          <SystemLoading label="Opening secure checkout…" />
        </div>
      )}
      <div className="editorial-wrap">
        {signedIn && (
          <Link className="pricing-editorial-back" href="/app">
            ← Back to Home
          </Link>
        )}
        {error && (
          <p role="alert" className="opryn-action-error mb-6">
            {error} Your workspace hasn’t changed.
          </p>
        )}
        <div className="pricing-editorial-choice">
          <header className="pricing-editorial-intro">
            <p className="editorial-eyebrow">
              <SoftBlurIn stagger={10}>Room for what your business knows</SoftBlurIn>
            </p>
            <EditorialHeading hero>
              Choose what fits your business today.
            </EditorialHeading>
            <p>
              Start with what your team needs today. Add richer learning and AI
              connections when you’re ready.
            </p>
            {annualEnabled && (
              <MotionTabs>
                <div
                  className="pricing-editorial-toggle"
                  role="group"
                  aria-label="Billing interval"
                >
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
              </MotionTabs>
            )}
            <p className="pricing-plan-note">
              One workspace subscription. One owner is included; employees and
              pending invitations count toward the plan limit.{" "}
              <Link href="/contact">Talk to us about larger teams →</Link>
            </p>
            <p className="pricing-no-surprises">
              USD. Checkout confirms your payment method and renewal amount.
              This page starts a paid plan, not a trial.
            </p>
          </header>
          <div className="pricing-editorial-plans">
            {(["core", "premium"] as const).map((plan) => (
              <PlanSurface
                key={plan}
                plan={plan}
                interval={interval}
                annualMonthlyPrice={annualMonthlyPrices?.[plan] ?? null}
                signedIn={signedIn}
                canManage={canManage}
                billingReady={billingReady}
                pending={pending}
                trial={trial}
                reduced={reduced}
                onSelect={() => void checkout(plan, interval)}
              />
            ))}
          </div>
        </div>

        <section
          className="pricing-editorial-comparison"
          aria-label="Plan comparison"
        >
          <button
            type="button"
            aria-expanded={compare}
            aria-controls="pricing-comparison-detail"
            onClick={() => setCompare((value) => !value)}
          >
            Compare all features{" "}
            <motion.span
              aria-hidden="true"
              animate={{ rotate: compare && !reduced ? 45 : 0 }}
              transition={{ duration: reduced ? 0 : 0.18 }}
            >
              {compare && reduced ? "−" : "+"}
            </motion.span>
          </button>
          <div id="pricing-comparison-detail">
            <MotionPanel open={compare}>
              <table>
                <caption>Starter and Pro capabilities</caption>
                <thead>
                  <tr>
                    <th scope="col">Capability</th>
                    <th scope="col">Starter</th>
                    <th scope="col">Pro</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map(([label, core, premium]) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      <td>{core}</td>
                      <td>{premium}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="editorial-footnote">
                At the employee limit, new invitations are blocked. Standard
                plans have no paid extra-seat option. Provider eligibility is
                separate from your Opryn plan.
              </p>
            </MotionPanel>
          </div>
        </section>
        <PricingFAQ trial={trial} />
      </div>
      <section className="editorial-section editorial-cobalt editorial-final editorial-texture">
        <div className="editorial-ring" aria-hidden="true" />
        <div className="editorial-wrap">
          <p className="editorial-eyebrow">Begin with one real thing</p>
          <EditorialHeading>
            Less repeating. More useful answers.
          </EditorialHeading>
          <EditorialAction href="/signup">Get started</EditorialAction>
        </div>
      </section>
    </main>
  );
}

function PlanSurface({
  plan,
  interval,
  annualMonthlyPrice,
  signedIn,
  canManage,
  billingReady,
  pending,
  trial,
  reduced,
  onSelect,
}: {
  plan: PlanId;
  interval: BillingInterval;
  annualMonthlyPrice: number | null;
  signedIn: boolean;
  canManage: boolean;
  billingReady: boolean;
  pending: PlanId | null;
  trial?: Props["trial"];
  reduced: boolean;
  onSelect: () => void;
}) {
  const price =
    interval === "year" && annualMonthlyPrice !== null
      ? annualMonthlyPrice
      : PLAN_DETAILS[plan].monthlyPrice;
  const returnPath = `/pricing?checkout=${plan}&interval=${interval}`;
  const signupPath = `/signup?next=${encodeURIComponent(`/onboarding?next=${encodeURIComponent(returnPath)}`)}`;
  const label = plan === "core" ? "Choose Starter" : "Choose Pro";
  return (
    <motion.article
      className={`pricing-editorial-plan ${plan === "premium" ? "featured" : ""}`}
      whileHover={reduced ? undefined : { y: -2 }}
      transition={{ duration: reduced ? 0 : 0.18 }}
    >
      <h2>{PLAN_DETAILS[plan].name}</h2>
      <p className="mt-2">
        {plan === "core"
          ? "Shared company guidance for your team and connected systems."
          : "Richer learning and supported AI conversation connections."}
      </p>
      <div className="pricing-price-line flex items-baseline gap-3">
        <strong className="tracking-[-.055em]">
          <PresenceSwap value={String(price)}>${price}</PresenceSwap>
        </strong>
        <span className="text-sm text-[#566279]">/month</span>
      </div>
      <p className="plan-cadence">
        {interval === "year"
          ? `$${price * 12} USD billed annually`
          : "USD billed monthly"}
      </p>
      <ul className="plan-feature-list">
        {features[plan].map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>
      {!signedIn ? (
        <EditorialAction href={signupPath}>{label}</EditorialAction>
      ) : canManage ? (
        <OprynAction
          label={billingReady ? label : "Billing setup required"}
          state={pending === plan ? "pending" : "idle"}
          pendingLabel="Opening checkout…"
          disabled={Boolean(pending) || !billingReady}
          onClick={onSelect}
          arrow
          rolling
        />
      ) : (
        <p className="editorial-footnote">
          Ask a workspace owner to change the plan.
        </p>
      )}
      {trial?.plan === plan && (
        <p className="plan-trial-note">
          {trial.days}-day trial available to eligible workspaces during
          onboarding, after your first sourced answer. Paid checkout here does
          not start a trial.
        </p>
      )}
      {plan === "premium" && (
        <p className="plan-trial-note">
          ChatGPT / Claude require supported provider plans and setup. Opryn
          learns only context you explicitly send.
        </p>
      )}
    </motion.article>
  );
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
      aria-pressed={active}
      className={`pricing-toggle relative px-4 py-2 text-xs font-semibold ${active ? "text-white" : "text-[#566279]"}`}
    >
      {active && <ActiveIndicator />}
      <span>{children}</span>
    </button>
  );
}

function PricingFAQ({ trial }: { trial?: Props["trial"] }) {
  const [open, setOpen] = useState<number | null>(null);
  const items = [
    [
      "How does the trial work?",
      trial
        ? `Eligible workspaces can choose a ${trial.days}-day ${PLAN_DETAILS[trial.plan].name} trial during onboarding, after the first sourced answer. It is available once per workspace. Onboarding and Checkout show the configured payment-method and renewal terms. Choosing a plan on this page starts a paid subscription instead.`
        : "Onboarding shows the currently available trial and payment terms after your first sourced answer. Choosing a plan here starts a paid subscription, not a trial.",
    ],
    [
      "Can I upgrade later?",
      "Yes. Workspaces can upgrade from Starter to Pro through Billing.",
    ],
    [
      "What happens if I move from Pro to Starter?",
      "Starter retains approved company knowledge. Pro-only learning formats and remote ChatGPT / Claude connections require Pro. Starter’s employee limit still applies.",
    ],
    [
      "Do employees need separate subscriptions?",
      "No. Employee access is included up to the plan’s limit, plus one owner. Pending invitations count toward the employee limit.",
    ],
    [
      "Will connecting AI import all my conversations?",
      "No. Supported connections retrieve only permitted guidance. Conversation learning is Pro and processes only context you explicitly send. External provider eligibility is separate.",
    ],
  ];
  return (
    <section
      className="pricing-editorial-faq"
      aria-labelledby="pricing-faq-heading"
    >
      <p className="editorial-eyebrow">A few useful details</p>
      <h2 id="pricing-faq-heading">Before you choose.</h2>
      {items.map(([question, answer], index) => (
        <div className="pricing-question" key={question}>
          <button
            type="button"
            aria-expanded={open === index}
            aria-controls={`pricing-faq-${index}`}
            onClick={() => setOpen(open === index ? null : index)}
          >
            {question}
            <span aria-hidden="true">{open === index ? "−" : "+"}</span>
          </button>
          <div id={`pricing-faq-${index}`}>
            <MotionPanel open={open === index}>
              <p>{answer}</p>
            </MotionPanel>
          </div>
        </div>
      ))}
    </section>
  );
}
