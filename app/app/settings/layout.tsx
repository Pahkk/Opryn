import { requireAppContext } from "@/lib/app-context";
import { SettingsLayout } from "@/components/app/settings/settings-layout";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const context = await requireAppContext();
  return (
    <SettingsLayout
      isAdmin={context.isAdmin}
      workspace={context.organization.name}
    >
      {children}
    </SettingsLayout>
  );
}
