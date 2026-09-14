import { publicMetadata } from "@/lib/marketing/metadata";
import { AuthProvider } from "@/components/auth";
import { Footer, Navbar } from "@/components/navigation";
import { PricingPage } from "@/components/pricing-page";
import { getOptionalAppContext } from "@/lib/app-context";
import {
  annualBillingConfigured,
  billingConfigured,
} from "@/lib/billing/stripe";

export const metadata = publicMetadata(
  "/pricing",
  "Pricing — Opryn Core and Premium",
  "Compare company knowledge for your team and API-connected systems with Premium call/video learning and supported remote MCP clients.",
);

export default async function PublicPricingPage({
  searchParams,
}: {
  searchParams: Promise<{ checkout?: string }>;
}) {
  const [context, params] = await Promise.all([
    getOptionalAppContext(),
    searchParams,
  ]);
  const requested = params.checkout;
  return (
    <AuthProvider initialUser={context?.authUser ?? null}>
      <div className="knowledge-public-site">
        <Navbar />
        <PricingPage
          signedIn={Boolean(context)}
          canManage={Boolean(context?.isAdmin)}
          annualEnabled={annualBillingConfigured()}
          billingReady={billingConfigured()}
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
