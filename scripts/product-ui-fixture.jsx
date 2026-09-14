// Browser-only component fixture. Not an authenticated or production route.
import React from "react";
import { createRoot } from "react-dom/client";
import { AppShell } from "../components/app/app-shell";
import { AskOpryn } from "../components/app/ask-opryn";
import { NeedsYouCenter } from "../components/app/needs-you-center";
import { IntegrationsCatalog } from "../components/app/integrations-catalog";
import { INTEGRATION_CATALOG } from "../lib/integrations/catalog";
import { ProcessReview } from "../components/app/process-review";
import { TrainingButton } from "../components/app/training-button";
import { TrainingManager } from "../components/app/training-manager";
import { TeamManager } from "../components/app/team-manager";
import { PendingApprovals } from "../components/app/pending-approvals";
import { PageHeading } from "../components/app/page-heading";
import { FirstRunWelcome } from "../components/app/first-run-welcome";
import { SourceFirstLearning } from "../components/onboarding/source-first-learning";
import { CaptureProcess } from "../components/app/capture-process";
import { KnowledgeLibrary } from "../components/app/knowledge-library";
import { TeachWorkspace } from "../components/app/teach-workspace";

const screen =
  new URLSearchParams(location.search).get("screen") ??
  (location.pathname === "/app/needs-you" ? "needs" : "ask");
const employee = new URLSearchParams(location.search).has("employee");
const longText =
  "Clients receive two standard revision rounds. Additional revisions need approval before a commitment is made. ";
const common = {
  source: "ChatGPT conversation · UI fixture",
  createdAt: "2026-09-08",
  secondaryActions: ["deny", "edit"],
};
const items = [
  {
    ...common,
    id: "proposal-1",
    targetId: "1",
    type: "knowledge_proposal",
    kind: "approve",
    priority: "soon",
    title: "Client revision limits",
    summary: longText,
    detail:
      "Accept makes this available to people and AI connections with access.",
    targetUrl: "/app/needs-you?item=proposal-1",
    primaryAction: "accept",
    metadata: { version: 2, updatedAt: "2026-09-08T12:00:00Z" },
  },
  {
    ...common,
    id: "proposal-2",
    targetId: "2",
    type: "knowledge_proposal",
    kind: "approve",
    priority: "soon",
    title: "Client delivery process",
    summary: longText.repeat(16),
    detail:
      "Review this complete proposal. Nothing becomes company policy until accepted.",
    targetUrl: "/app/needs-you?item=proposal-2",
    primaryAction: "accept",
    metadata: { version: 1, updatedAt: "2026-09-08T12:00:00Z" },
  },
];
const org = { name: "Example workspace", logoUrl: null };
const processData = {
  id: "fixture-process",
  title: "Client onboarding",
  summary: "Set up a new client with clear responsibilities.",
  purpose: "Give clients a consistent start.",
  status: "needs_review",
  roleId: null,
  expertId: null,
  criticality: "normal",
  steps: [
    { title: "Confirm the agreement", description: longText.repeat(4) },
    { title: "Schedule a kickoff", description: longText.repeat(4) },
  ],
  rules: [{ title: "Revision rounds", text: longText }],
  exceptions: [],
  clarifications: [],
};
const libraryItems = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    entity: "process",
    title: "Refund approval limits",
    content:
      "Managers can approve refunds up to $500. Larger refunds require owner approval.",
    category: "policy",
    tags: ["Refunds", "Finance"],
    revision: 1,
    status: "approved",
    source: "Google Workspace",
    source_title: "Refund Policy",
    source_url: "https://docs.google.com/document/d/fixture",
    process_id: "10000000-0000-4000-8000-000000000001",
    updated_at: "2026-09-12T12:00:00Z",
    confirmed_at: "2026-09-12T12:00:00Z",
    usage_count: 12,
    version: 2,
    review_required: true,
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    entity: "proposal",
    title: "Website revision process",
    content:
      "Website projects include two revision rounds. Additional rounds require project lead approval.",
    category: "process",
    tags: ["Customer Support"],
    revision: 1,
    status: "needs_review",
    source: "Owner answers",
    source_title: null,
    source_url: null,
    process_id: null,
    updated_at: "2026-09-11T12:00:00Z",
    confirmed_at: null,
    usage_count: 0,
    version: 1,
    review_required: false,
  },
];
const panels = {
  knowledge: (
    <KnowledgeLibrary
      items={libraryItems}
      reviewItems={[libraryItems[1]]}
      usedItems={[libraryItems[0]]}
      total={2}
      categories={{ policy: 1, process: 1 }}
      sources={["Google Workspace", "Owner answers"]}
      filters={{ view: "overview" }}
      page={1}
      pageSize={30}
      canManage={!employee}
      organizationName={org.name}
    />
  ),
  "teach-google": (
    <>
      <PageHeading
        title="Teach Opryn"
        description="Start with what your company already knows."
      />
      <TeachWorkspace
        organizationId="fixture-org"
        organizationName={org.name}
        roles={[]}
        plan="premium"
        returnTo="/app/processes"
      />
    </>
  ),
  team: (
    <>
      <PageHeading title="Team" description="People, access, and learning." />
      <TeamManager
        roles={[]}
        invites={[]}
        invitedCount={0}
        currentUserId="owner"
        canManage={true}
        members={[
          {
            id: "owner",
            user_id: "owner",
            permission_level: "owner",
            role_id: null,
            joined_at: "2026-09-01",
            profile: { full_name: "Alex Example", email: "alex@example.test" },
          },
          {
            id: "member",
            user_id: "member",
            permission_level: "employee",
            role_id: null,
            joined_at: "2026-09-01",
            profile: {
              full_name: "Sarah Example",
              email: "sarah@example.test",
            },
          },
        ]}
      />
    </>
  ),
  approvals: (
    <>
      <PageHeading
        title="Knowledge"
        description="The information your business can rely on."
      />
      <PendingApprovals
        items={[]}
        proposals={[
          {
            id: "policy",
            title: "Revision policy",
            content: longText,
            source: "ChatGPT conversation",
            createdAt: "2026-09-08",
            version: 1,
            updatedAt: "2026-09-08",
            highRisk: false,
            reviewRequired: false,
            reviewReason: null,
            reviewUrl: "/app/needs-you?item=policy",
          },
        ]}
      />
    </>
  ),
  welcome: (
    <FirstRunWelcome
      firstName="Alex"
      organizationName="Example workspace"
      selectedSources={[]}
      currentStep="knowledge"
      hasApprovedKnowledge={false}
      hasSuccessfulTest={false}
    />
  ),
  sources: (
    <SourceFirstLearning
      organizationId="fixture-org"
      name="Example workspace"
      connected={{ chatgpt: true, google_drive: true }}
      onExplain={() => {}}
      onConnect={() => {}}
    />
  ),
  "teach-files": (
    <CaptureProcess
      roles={[]}
      plan="core"
      returnTo="/app/processes"
      initialMode="documents"
    />
  ),
  ask: (
    <>
      <PageHeading
        eyebrow="Ask Opryn"
        title="What do you need to know?"
        description="Answers from your approved company knowledge."
      />
      <AskOpryn
        hasKnowledge
        prompts={[
          {
            category: "Approved process",
            text: "Walk me through client onboarding.",
          },
        ]}
        initialQuestion=""
      />
    </>
  ),
  needs: (
    <NeedsYouCenter
      initialItems={items}
      initialItemId={new URLSearchParams(location.search).get("item")}
      initialFilter={null}
    />
  ),
  integrations: (
    <IntegrationsCatalog
      organizationId="10000000-0000-4000-8000-000000000001"
      organizationName="Example workspace"
      nangoProviders={
        new URLSearchParams(location.search).has("nango")
          ? ["google_drive"]
          : []
      }
      providers={INTEGRATION_CATALOG}
      connections={[
        {
          providerId: "github",
          id: "saved-github",
          connected: false,
          setupOnly: true,
          detail: "Setup details saved. Not verified.",
        },
        {
          providerId: "chatgpt",
          connected: true,
          authorizationOnly: true,
          detail: "Access authorized. Test a question.",
        },
      ]}
      recommendedIds={["slack", "chatgpt"]}
      plan="premium"
    />
  ),
  process: (
    <>
      <PageHeading
        eyebrow="Review"
        title="Client onboarding"
        description="Review the exact steps before making this available."
      />
      <ProcessReview
        initial={processData}
        returnTo="/app/processes"
        roleOptions={[]}
        expertOptions={[]}
      />
    </>
  ),
  "learning-overview": (
    <>
      <PageHeading
        eyebrow="Team"
        title="Learning"
        description="Help your team learn how your business works."
      />
      <TrainingManager
        people={[
          {
            id: "fixture-person",
            name: "Alex Example",
            email: "example@example.test",
            roleName: "Operations",
          },
        ]}
        processes={[
          {
            id: "fixture-process",
            title: "Client onboarding",
            summary: "An approved process for welcoming clients.",
            roleNames: ["Operations"],
            hasVideo: false,
            imageCount: 0,
          },
        ]}
        initialAssignments={[
          {
            id: "fixture-assignment",
            user_id: "fixture-person",
            process_id: "fixture-process",
            status: "assigned",
            completed_at: null,
          },
        ]}
      />
    </>
  ),
  learning: (
    <>
      <PageHeading
        eyebrow="My Learning"
        title="What you need to know"
        description="Work through an approved process, then ask about anything unclear."
      />
      <h2 className="mb-4 text-xl">Client onboarding</h2>
      <TrainingButton processId="fixture-process" status="assigned" />
    </>
  ),
};
createRoot(document.getElementById("root")).render(
  <AppShell
    organizationId="fixture-org"
    organizations={[{ id: "fixture-org", name: org.name }]}
    organization={org}
    user={{ fullName: "Alex Example", email: "example@example.test" }}
    isAdmin={!employee}
    notifications={[
      {
        id: "fixture-notification",
        notificationId: "fixture-notification",
        title: "Client delivery process needs review",
        body: "ChatGPT proposed a process. Review the exact wording.",
        href: "/app/needs-you?item=proposal-2",
        unread: true,
        kind: "update",
        createdAt: "2026-09-08T12:00:00Z",
      },
    ]}
    notificationCount={1}
    pendingApprovalCount={2}
    needsYouCount={2}
    plan="premium"
  >
    {panels[screen] ?? panels.ask}
  </AppShell>,
);
