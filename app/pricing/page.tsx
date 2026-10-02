import { publicMetadata } from "@/lib/marketing/metadata";
import { AuthProvider } from "@/components/auth";
import { Footer, Navbar } from "@/components/navigation";
import { PricingPage } from "@/components/pricing-page";
import { getOptionalAppContext } from "@/lib/app-context";
import { trialConfiguration } from "@/lib/billing/trial";
import {
  annualBillingConfigured,
  billingConfigured,
  getStripe,
  getStripePriceId,
  isCurrentMonthlyPrice,
} from "@/lib/billing/stripe";
import "@/components/marketing/cinematic-public.css";
import "@/components/marketing/public-light.css";

export const metadata = publicMetadata(
  "/pricing",
  "Pricing — Opryn Starter and Pro",
  "Compare Starter and Pro company knowledge plans, including Pro call and video learning.",
);

export default async function PublicPricingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string; interval?: string }>;
}) {
  const [context, params] = await Promise.all([
    getOptionalAppContext(),
    searchParams,
  ]);
  const requested = params.checkout;
  let annualEnabled = false;
  let billingReady = false;
  let annualMonthlyPrices: { core: number; premium: number } | null = null;
  if (billingConfigured()) {
    try {
      const stripe = getStripe();
      const [core, premium] = await Promise.all([
        stripe.prices.retrieve(getStripePriceId("core", "month")),
        stripe.prices.retrieve(getStripePriceId("premium", "month")),
      ]);
      billingReady =
        isCurrentMonthlyPrice(core, "core") &&
        isCurrentMonthlyPrice(premium, "premium");
      if (billingReady && annualBillingConfigured()) {
        const [coreAnnual, premiumAnnual] = await Promise.all([
          stripe.prices.retrieve(getStripePriceId("core", "year")),
          stripe.prices.retrieve(getStripePriceId("premium", "year")),
        ]);
        if (
          [coreAnnual, premiumAnnual].every(
            (price) =>
              price.active &&
              price.currency === "usd" &&
              price.recurring?.interval === "year" &&
              price.unit_amount != null,
          )
        ) {
          annualEnabled = true;
          annualMonthlyPrices = {
            core: coreAnnual.unit_amount! / 1200,
            premium: premiumAnnual.unit_amount! / 1200,
          };
        }
      }
    } catch {
      // Checkout stays disabled until Stripe can confirm the displayed prices.
    }
  }
  let trial: { days: number; plan: "core" | "premium" } | null = null;
  if (billingReady) {
    try {
      const configured = trialConfiguration();
      trial = { days: configured.days, plan: configured.plan };
    } catch {
      // An incomplete trial configuration must not prevent paid plan selection.
    }
  }
  return (
    <AuthProvider initialUser={context?.authUser ?? null}>
      <div className="knowledge-public-site opryn-public-editorial opryn-public-light">
        <Navbar />
        <PricingPage
          signedIn={Boolean(context)}
          canManage={Boolean(context?.isAdmin)}
          annualEnabled={annualEnabled}
          annualMonthlyPrices={annualMonthlyPrices}
          billingReady={billingReady}
          initialInterval={
            params.interval === "year" && annualEnabled ? "year" : "month"
          }
          trial={trial}
          initialCheckout={
            requested === "core" || requested === "premium"
              ? requested
              : undefined
          }
        />
        <Footer />
      </div>
    </AuthProvider>
  );
}
