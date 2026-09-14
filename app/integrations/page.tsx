import { PublicInfoPage } from "@/components/marketing/public-info-page";
import { PublicIntegrations } from "@/components/marketing/public-integrations";
import { publicMetadata } from "@/lib/marketing/metadata";
export const metadata = publicMetadata(
  "/integrations",
  "Integrations — Opryn",
  "Bring knowledge into Opryn from supported sources and make approved guidance available to your team and connected AI.",
);
export default function IntegrationsPage() {
  return (
    <PublicInfoPage
      title="Connect what your business already uses."
      intro="Bring knowledge into Opryn and use approved guidance wherever your business works."
    >
      <PublicIntegrations />
    </PublicInfoPage>
  );
}
