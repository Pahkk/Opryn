"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
type Plan = {
  plan: "core" | "premium";
  interval: "month" | "year";
  name: string;
  amount: number;
  currency: string;
  teamLimit: number;
};
type Options = {
  plans: Plan[];
  trial: {
    plan: Plan["plan"];
    interval: Plan["interval"];
    days: number;
    requiresPaymentMethod: boolean;
    eligible: boolean;
  };
  status: string;
};
export function PlanChoice({
  organizationId,
  onComplete,
}: {
  organizationId: string;
  onComplete: () => void;
}) {
  const [options, setOptions] = useState<Options | null>(null);
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [checking, setChecking] = useState(true);
  const [verified, setVerified] = useState(false),
    [trialEnd, setTrialEnd] = useState<string | null>(null);
  const [interval, setInterval] = useState<"month" | "year">("month");
  const [retry, setRetry] = useState(0);
  const pending = useRef(false);
  const headers = {
    "Content-Type": "application/json",
    "x-opryn-organization": organizationId,
  };
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    const requestHeaders = { "x-opryn-organization": organizationId };
    async function poll() {
      try {
        const r = await fetch("/api/billing/status", {
          headers: requestHeaders,
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        if (controller.signal.aborted) return;
        setVerified(data.verified);
        setTrialEnd(data.status === "trialing" ? data.trialEnd : null);
        if (data.verified) {
          setChecking(false);
          return;
        }
        const returning =
          new URLSearchParams(location.search).get("billing") === "confirming";
        if (returning && Date.now() - started < 60000)
          timer = setTimeout(poll, 2500);
        else {
          setChecking(false);
          if (returning)
            setError(
              "Confirmation is taking longer than usual. Check again; don't start another checkout.",
            );
        }
      } catch (e) {
        if (!controller.signal.aborted) {
          setChecking(false);
          setError(
            e instanceof Error ? e.message : "Status unavailable. Try again.",
          );
        }
      }
    }
    void poll();
    void fetch("/api/billing/options", {
      headers: requestHeaders,
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        if (!controller.signal.aborted) setOptions(data);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [organizationId, retry]);
  async function checkout(plan: Plan, intent: "purchase" | "trial") {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/billing/checkout", {
        method: "POST",
        headers,
        body: JSON.stringify({
          plan: plan.plan,
          interval: plan.interval,
          intent,
          source: "onboarding",
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      const url = new URL(data.url);
      if (url.origin !== "https://checkout.stripe.com")
        throw new Error("Checkout couldn't open safely.");
      window.location.assign(url.href);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout unavailable.");
      pending.current = false;
      setBusy(false);
    }
  }
  const money = (p: Plan) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: p.currency,
    }).format(p.amount / 100);
  const trialPlan = options?.plans.find(
    (p) =>
      p.plan === options.trial.plan && p.interval === options.trial.interval,
  );
  return (
    <section className="setup-plan-choice" aria-label="Choose how to continue">
      <p className="activation-status approved">
        Company profile ✓ · Approved knowledge ✓ · First answer ✓
      </p>
      {checking && <p role="status">Confirming your subscription…</p>}
      {verified ? (
        <div className="setup-trial">
          <h2>{trialEnd ? "Your trial is active." : "Your plan is active."}</h2>
          {trialEnd && (
            <p>
              Trial ends {new Date(trialEnd).toLocaleDateString()}. Manage
              billing and cancellation in Settings.
            </p>
          )}
          <button
            className="activation-primary"
            disabled={busy}
            onClick={async () => {
              if (pending.current) return;
              pending.current = true;
              setBusy(true);
              try {
                const r = await fetch("/api/onboarding/activation", {
                  method: "POST",
                  headers,
                  body: JSON.stringify({ action: "complete" }),
                });
                const d = await r.json();
                if (!r.ok) throw new Error(d.error);
                onComplete();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Try again.");
              } finally {
                pending.current = false;
                setBusy(false);
              }
            }}
          >
            {busy ? "Saving…" : "Continue to Opryn →"}
          </button>
        </div>
      ) : (
        options && (
          <>
            {trialPlan && options.trial.eligible && (
              <section className="setup-trial">
                <p className="activation-eyebrow">Explore before committing</p>
                <h2>5 days with {trialPlan.name}.</h2>
                <p>
                  Includes {trialPlan.teamLimit} employees, approved knowledge
                  and{" "}
                  {trialPlan.plan === "premium"
                    ? "supported ChatGPT / Claude connections, remote MCP and call/video learning."
                    : "Agent API access."}
                </p>
                <p className="activation-note">
                  {options.trial.requiresPaymentMethod
                    ? `$0 today. ${money(trialPlan)} per ${trialPlan.interval} after the 5-day trial unless canceled. Payment method required.`
                    : `No card required. Without a payment method, the subscription cancels after 5 days. If you add one, ${money(trialPlan)} per ${trialPlan.interval} begins after the trial unless canceled.`}
                </p>
                <button
                  className="activation-primary"
                  disabled={busy || checking}
                  onClick={() => void checkout(trialPlan, "trial")}
                >
                  Start 5-day free trial
                </button>
              </section>
            )}
            <div className="setup-plan-heading">
              <h2>Or choose a plan now.</h2>
              {options.plans.some((p) => p.interval === "year") && (
                <div aria-label="Billing frequency">
                  <button
                    aria-pressed={interval === "month"}
                    onClick={() => setInterval("month")}
                  >
                    Monthly
                  </button>
                  <button
                    aria-pressed={interval === "year"}
                    onClick={() => setInterval("year")}
                  >
                    Annual
                  </button>
                </div>
              )}
            </div>
            <div className="setup-paid-plans">
              {options.plans
                .filter((p) => p.interval === interval)
                .map((p) => (
                  <section key={p.plan}>
                    <h3>{p.name}</h3>
                    <p>
                      {p.plan === "core"
                        ? "Company knowledge for your team and API-connected systems."
                        : "Richer sources and direct access from supported AI clients."}
                    </p>
                    <p className="setup-price">
                      {money(p)} <small>/ {p.interval}</small>
                    </p>
                    <ul>
                      <li>{p.teamLimit} employees included</li>
                      <li>Teach, review and approved knowledge</li>
                      <li>Team answers and Agent API</li>
                      {p.plan === "premium" && (
                        <>
                          <li>ChatGPT / Claude and remote MCP</li>
                          <li>Call and video learning</li>
                        </>
                      )}
                    </ul>
                    <button
                      disabled={busy || checking}
                      className="activation-primary"
                      onClick={() => void checkout(p, "purchase")}
                    >
                      Choose {p.name.replace("Opryn ", "")}
                    </button>
                    <p className="activation-note">
                      Billed now. No trial on this option.
                    </p>
                  </section>
                ))}
            </div>
            <p className="activation-note">
              Amounts shown are the configured Stripe prices. Applicable tax or
              discounts are confirmed in Checkout. Cancel or manage your
              subscription in Billing.
            </p>
          </>
        )
      )}
      {error && (
        <p role="alert" className="activation-error">
          {error}
        </p>
      )}
      <div className="setup-plan-footer">
        <Link href="/app/settings/data">Workspace data controls</Link>
        <button
          disabled={busy || checking}
          onClick={() => {
            setError("");
            setChecking(true);
            setRetry((i) => i + 1);
          }}
        >
          Check subscription / retry
        </button>
        <button
          disabled={busy}
          onClick={async () => {
            if (pending.current) return;
            pending.current = true;
            setBusy(true);
            setError("");
            try {
              const r = await fetch("/api/billing/portal", {
                method: "POST",
                headers,
              });
              const d = await r.json();
              if (!r.ok) throw new Error(d.error);
              const url = new URL(d.url);
              if (url.origin !== "https://billing.stripe.com")
                throw new Error("Billing couldn't open safely.");
              window.location.assign(url.href);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Billing unavailable.");
              pending.current = false;
              setBusy(false);
            }
          }}
        >
          Manage existing subscription
        </button>
      </div>
    </section>
  );
}
