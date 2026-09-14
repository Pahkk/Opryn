import { PageHeading } from "@/components/app/page-heading";
import { CommunicationIntegration } from "@/components/app/communication-integration";
import { requireAdminContext } from "@/lib/app-context";
import { getCommunicationIntegrationPageData } from "@/lib/communication/page-data";

export default async function SlackIntegrationPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const context = await requireAdminContext();
  const query = await searchParams;
  const data = await getCommunicationIntegrationPageData(
    context.organization.id,
    "slack",
  );
  return (
    <>
      <PageHeading
        eyebrow="Opryn Everywhere"
        title="Opryn in Slack"
        description="Let your team ask Opryn directly from the conversations where work is already happening."
      />
      <CommunicationIntegration
        provider="slack"
        connected={Boolean(data.integration)}
        workspaceName={data.integration?.external_workspace_name ?? null}
        status={data.integration?.status ?? null}
        mappedUsers={data.mappedUsers}
        totalMembers={data.totalMembers}
        accessMode={data.accessMode}
        justConnected={query.connected === "1"}
        error={query.error}
        roles={data.roles}
        members={data.members}
        selectedRoleIds={data.selectedRoleIds}
        selectedUserIds={data.selectedUserIds}
      />
    </>
  );
}
