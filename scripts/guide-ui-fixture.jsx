// Local QA only: real app components, synthetic data, mocked HTTP responses.
import React from "react";
import { createRoot } from "react-dom/client";
import { usePathname, useSearchParams } from "next/navigation";
import { AppShell } from "../components/app/app-shell";
import { TeachWorkspace } from "../components/app/teach-workspace";
import { KnowledgeLibrary } from "../components/app/knowledge-library";
import { NeedsYouCenter } from "../components/app/needs-you-center";
import { TeamManager } from "../components/app/team-manager";
import { KnowledgeExperts } from "../components/app/knowledge-experts";
import { IntegrationsCatalog } from "../components/app/integrations-catalog";
import { INTEGRATION_CATALOG } from "../lib/integrations/catalog";
import { AskOpryn } from "../components/app/ask-opryn";
import { PageHeading } from "../components/app/page-heading";

function Fixture() {
  const path = usePathname();
  const params = useSearchParams();
  const employee = params.has("employee");
  const org = params.get("org") || "fixture-org";
  const names = {
    "/app": "Home",
    "/app/processes/new": "Teach Opryn",
    "/app/processes": "Knowledge",
    "/app/team": "Team",
    "/app/ask": "Ask Opryn",
  };
  return (
    <AppShell
      key={org}
      organizationId={org}
      organizations={[{ id: org, name: "Example workspace" }]}
      organization={{ name: "Example workspace", logoUrl: null }}
      user={{ fullName: "Alex Example", email: "alex@example.test" }}
      isAdmin={!employee}
      notifications={[]}
      notificationCount={0}
      pendingApprovalCount={0}
      needsYouCount={0}
      plan="premium"
    >
      {names[path] && (
        <PageHeading
          title={names[path]}
          description="Local product-guidance test workspace. No customer data."
        />
      )}
      {path === "/app" && (
        <p>
          Teach a company rule, review what becomes official, and test an
          answer.
        </p>
      )}
      {path === "/app/processes/new" && (
        <TeachWorkspace
          organizationId={org}
          organizationName="Example workspace"
          roles={[]}
          plan="premium"
          returnTo="/app/processes"
        />
      )}
      {path === "/app/processes" && (
        <KnowledgeLibrary
          items={[]}
          reviewItems={[]}
          usedItems={[]}
          total={0}
          categories={{}}
          sources={[]}
          filters={{ view: params.get("view") || "overview" }}
          page={1}
          pageSize={30}
          canManage={!employee}
          organizationName="Example workspace"
        />
      )}
      {path === "/app/needs-you" && (
        <NeedsYouCenter
          initialItems={[]}
          initialItemId={null}
          initialFilter={null}
        />
      )}
      {path === "/app/team" && (
        <>
          <TeamManager
            roles={[]}
            invites={[]}
            invitedCount={0}
            currentUserId="fixture-user"
            canManage={!employee}
            members={[]}
          />
          <KnowledgeExperts people={[]} experts={[]} />
        </>
      )}
      {path === "/app/integrations" && (
        <IntegrationsCatalog
          organizationId={org}
          organizationName="Example workspace"
          providers={INTEGRATION_CATALOG}
          connections={[]}
          recommendedIds={["google_drive"]}
          plan="premium"
          nangoProviders={["google_drive"]}
        />
      )}
      {path === "/app/ask" && (
        <AskOpryn hasKnowledge={false} prompts={[]} initialQuestion="" />
      )}
    </AppShell>
  );
}
createRoot(document.getElementById("root")).render(<Fixture />);
