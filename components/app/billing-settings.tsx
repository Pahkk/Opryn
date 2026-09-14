"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  LoaderCircle,
} from "lucide-react";
import type { BillingInterval, PlanId } from "@/lib/billing/plans";
import { PLAN_DETAILS } from "@/lib/billing/plans";

type Props = {
  plan: PlanId;
  interval: BillingInterval;
  status: string;
  periodEnd: string | null;
  trialEnd?: string | null;
  cancelAtPeriodEnd: boolean;
  hasStripeCustomer: boolean;
  hasSubscription: boolean;
  billingReady: boolean;
  success?: boolean;
};

export function BillingSettings(props: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const details = PLAN_DETAILS[props.plan];
  const statusLabel = props.hasSubscription
    ? props.status.replaceAll("_", " ")
    : "No paid plan";
  async function manage() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/billing/portal", { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.url) {
        setError(body.error ?? "Billing could not be opened right now.");
        setLoading(false);
        return;
      }
      window.location.assign(body.url);
    } catch {
      setError(
        "Billing could not be opened. Check your connection and try again.",
      );
      setLoading(false);
    }
  }
  return (
    <section className="rounded-2xl border border-[#dfe5ed] bg-white p-5 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-xl bg-[#edf2ff] text-[#3158d8]">
              <CreditCard className="size-4" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Billing</h2>
              <p className="text-sm text-[#718095]">
                Manage your plan, payments, and invoices.
              </p>
            </div>
          </div>
        </div>
        <span
          className={`w-fit rounded-full px-3 py-1 text-xs font-bold capitalize ${props.hasSubscription && (props.status === "active" || props.status === "trialing") ? "bg-[#eaf7f1] text-[#177257]" : "bg-[#eef3f8] text-[#53627a]"}`}
        >
          {statusLabel}
        </span>
      </div>
      {props.status === "trialing" && props.trialEnd && (
        <p className="mt-4 text-sm text-[#536b82]">
          {details.name} trial · Ends{" "}
          {new Date(props.trialEnd).toLocaleDateString()}.{" "}
          {props.cancelAtPeriodEnd
            ? "Cancellation is scheduled. Check Billing for your final access date."
            : "Manage payment and cancellation below."}
        </p>
      )}
      {props.success ? (
        <div
          role="status"
          className="mt-5 flex items-center gap-2 rounded-xl bg-[#eaf7f1] px-4 py-3 text-sm font-medium text-[#177257]"
        >
          <CheckCircle2 className="size-4" /> Checkout completed. Your plan will
          update as soon as Stripe confirms the subscription.
        </div>
      ) : null}
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <BillingValue
          label="Current plan"
          value={props.hasSubscription ? details.name : "No paid plan"}
        />
        <BillingValue
          label="Price"
          value={
            props.hasSubscription
              ? `$${props.interval === "year" ? details.annualMonthlyEquivalent : details.monthlyPrice}/month`
              : "Not billing"
          }
          note={
            props.hasSubscription
              ? props.interval === "year"
                ? "billed annually"
                : "billed monthly"
              : undefined
          }
        />
        <BillingValue
          label={props.cancelAtPeriodEnd ? "Access ends" : "Next billing date"}
          value={
            props.hasSubscription && props.periodEnd
              ? new Date(props.periodEnd).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : "Not scheduled"
          }
        />
      </div>
      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-[#fff0f1] p-3 text-sm text-[#a83f49]"
        >
          {error}
        </p>
      ) : null}
      <div className="mt-6 flex flex-wrap gap-3 border-t border-[#edf0f4] pt-5">
        {props.hasStripeCustomer ? (
          <button
            onClick={() => void manage()}
            disabled={loading}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#3158d8] px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <CreditCard className="size-4" />
            )}{" "}
            Manage subscription
          </button>
        ) : null}
        <Link
          href="/pricing"
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#d9e0e9] px-4 text-sm font-semibold text-[#354156] hover:bg-[#f7f9fc]"
        >
          {!props.hasSubscription
            ? "Choose a plan"
            : props.plan === "core"
              ? "Upgrade plan"
              : "View pricing"}
          <ArrowUpRight className="size-4" />
        </Link>
      </div>
      {!props.billingReady ? (
        <p className="mt-4 text-xs text-[#8a6217]">
          Checkout is being configured. Your current Opryn access is unchanged.
        </p>
      ) : null}
    </section>
  );
}

function BillingValue({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-xl bg-[#f7f9fc] p-4">
      <p className="text-[11px] font-bold uppercase tracking-[.1em] text-[#7a8798]">
        {label}
      </p>
      <p className="mt-2 font-semibold">{value}</p>
      {note ? <p className="mt-1 text-xs text-[#7a8798]">{note}</p> : null}
    </div>
  );
}
