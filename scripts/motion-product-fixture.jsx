// Real product components with explicit sample data. Never mounted by Next.js.
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { TeachSources, TeachPipeline } from "../components/app/teach-sources";
import { TeachProvider } from "../components/app/teach-provider";
import { NeedsYouCenter } from "../components/app/needs-you-center";
import { DashboardPulse } from "../components/app/dashboard-pulse";
import { DashboardDecision } from "../components/app/dashboard-decision";
import { KnowledgeLibrary } from "../components/app/knowledge-library";
const proposal = {
  id: "proposal-1",
  targetId: "1",
  type: "knowledge_proposal",
  kind: "approve",
  priority: "soon",
  title: "Refund approval limits",
  summary:
    "Managers may approve up to $500. Above $500 requires owner approval.",
  detail: "Source: Refund policy",
  source: "Notion",
  createdAt: "2026-09-15",
  targetUrl: "/app/needs-you",
  primaryAction: "accept",
  secondaryActions: ["deny", "edit"],
  metadata: { version: 1, updatedAt: "2026-09-15T00:00:00Z" },
};
const knowledge = {
  id: "10000000-0000-4000-8000-000000000001",
  entity: "process",
  title: "Refund approval limits",
  content: proposal.summary,
  category: "policy",
  tags: [],
  status: "approved",
  source: "Notion",
  source_title: "Refund policy",
  source_url: null,
  process_id: "10000000-0000-4000-8000-000000000001",
  updated_at: "2026-09-15T00:00:00Z",
  confirmed_at: "2026-09-15T00:00:00Z",
  usage_count: 3,
  version: 3,
  review_required: false,
};
function Fixture() {
  const [screen, setScreen] = useState("Teach");
  const [count, setCount] = useState(6);
  return (
    <div className="opryn-app">
      <nav className="fixture-nav">
        {["Teach", "Needs You", "Knowledge", "Home"].map((name) => (
          <button key={name} onClick={() => setScreen(name)}>
            {name}
          </button>
        ))}
      </nav>
      <main
        className="page-shell"
        style={{ maxWidth: 1120, margin: "auto", padding: 24 }}
      >
        {screen === "Teach" && (
          <>
            <h1 className="opryn-page-title">Teach Opryn</h1>
            <p>Bring in what your business already knows.</p>
            <TeachPipeline />
            <TeachSources
              google={<button>Choose files</button>}
              notion={
                <TeachProvider
                  provider="notion"
                  organizationId="fixture-org"
                  organizationName="Example workspace"
                  initialConnectionId="notion-connection"
                />
              }
              confluence={
                <TeachProvider
                  provider="confluence"
                  organizationId="fixture-org"
                  organizationName="Example workspace"
                  initialConnectionId="confluence-connection"
                />
              }
              summaries={["google_drive", "notion", "confluence"].map((id) => ({
                id,
                connected: true,
                connectionId: `${id}-connection`,
                selectedCount: 2,
                status: "healthy",
                lastLearned: null,
              }))}
              recent={[]}
              useElsewhere={[
                { id: "slack", name: "Slack", connected: true },
                { id: "teams", name: "Microsoft Teams", connected: true },
                { id: "chatgpt", name: "ChatGPT", connected: false },
                { id: "claude", name: "Claude", connected: false },
              ]}
              onExplain={() => {}}
              onUpload={() => {}}
            />
          </>
        )}
        {screen === "Needs You" && (
          <NeedsYouCenter
            initialItems={[
              proposal,
              {
                ...proposal,
                id: "proposal-2",
                targetId: "2",
                title: "Cancellation process",
              },
            ]}
            initialItemId={null}
            initialFilter={null}
          />
        )}
        {screen === "Knowledge" && (
          <KnowledgeLibrary
            items={[knowledge]}
            reviewItems={[]}
            usedItems={[]}
            total={1}
            categories={{ policy: 1 }}
            sources={["Notion"]}
            filters={{ view: "all" }}
            page={1}
            pageSize={30}
            canManage
            organizationName="Example workspace"
          />
        )}
        {screen === "Home" && (
          <>
            <DashboardPulse
              answeredCount={count}
              askedCount={10}
              handledRate={count * 10}
              needsYou={2}
              approvedCount={count}
              reviewCount={2}
              returnedTime={null}
              nextAction={{
                label: "Teach next",
                title: "Refund exceptions",
                description:
                  "Review the questions your business still needs to answer.",
                href: "/app/needs-you",
              }}
            />
            <button onClick={() => setCount(8)}>
              Receive confirmed update
            </button>
            <DashboardDecision
              questionId="question-1"
              question="Can a manager approve $300?"
            />
          </>
        )}
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<Fixture />);
